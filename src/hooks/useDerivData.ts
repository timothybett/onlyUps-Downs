import { useEffect, useState, useRef, useCallback } from 'react';
import { DerivService } from '../lib/deriv';
import { TechnicalAnalysis, DerivVolatilityPredictor, PredictiveWeights } from '../lib/analysis';
import { Candle, Signal, IndicatorLevels, FVGZone } from '../types/deriv';

export function useDerivData(symbol: string = 'R_100', appId: string, token: string = '') {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [ticks, setTicks] = useState<{ quote: number; direction: number }[]>([]);
  const [indicators, setIndicators] = useState<IndicatorLevels | null>(null);
  const [fvgs, setFvgs] = useState<{ [tf: string]: FVGZone[] }>({});
  const [signal, setSignal] = useState<Signal | null>(null);
  const [connected, setConnected] = useState(false);
  const [atr, setAtr] = useState<number>(0);
  const [weights, setWeights] = useState<PredictiveWeights | null>(null);
  
  const derivService = useRef<DerivService | null>(null);
  const predictor = useRef<DerivVolatilityPredictor>(new DerivVolatilityPredictor());
  const history1m = useRef<Candle[]>([]);
  const history5m = useRef<Candle[]>([]);
  const history15m = useRef<Candle[]>([]);

  const updateAnalysis = useCallback(() => {
    if (history1m.current.length < 50) return;

    const prices = history1m.current.map(c => c.close);
    const lastPrice = prices[prices.length - 1];
    const lastCandleEpoch = history1m.current[history1m.current.length - 1].epoch;
    
    // Ticks since last candle start
    const candleStartTicks = ticks.filter(t => Math.floor(Date.now() / 1000 / 60) * 60 === lastCandleEpoch);

    // Indicators
    const rsi = TechnicalAnalysis.calculateRSI(prices);
    const macd = TechnicalAnalysis.calculateMACD(prices);
    const ema = TechnicalAnalysis.calculateEMAs(prices);
    const currentAtr = TechnicalAnalysis.calculateATR(history1m.current);
    
    setIndicators({ rsi, macd, ema });
    setAtr(currentAtr);

    // FVGs
    const fvg1m = TechnicalAnalysis.findFVGs(history1m.current);
    const fvg5m = TechnicalAnalysis.findFVGs(history5m.current);
    const fvg15m = TechnicalAnalysis.findFVGs(history15m.current);
    setFvgs({ '1m': fvg1m, '5m': fvg5m, '15m': fvg15m });

    // Premium/Discount
    const recentHigh = Math.max(...prices.slice(-20));
    const recentLow = Math.min(...prices.slice(-20));
    const premDisc = TechnicalAnalysis.getPremiumDiscount(lastPrice, recentHigh, recentLow);

    // OFI
    const ofi = TechnicalAnalysis.calculateOFI(ticks.slice(-10));

    // Tick Trend
    const recentTicks = ticks.slice(-5);
    let tickTrend: 'up' | 'down' | 'neutral' = 'neutral';
    const upTicks = recentTicks.filter(t => t.direction === 1).length;
    const downTicks = recentTicks.filter(t => t.direction === -1).length;
    if (upTicks >= 3) tickTrend = 'up';
    if (downTicks >= 3) tickTrend = 'down';

    // Adaptive weight adjustment based on ATR and dummy accuracy
    predictor.current.adjustWeights(currentAtr, 0.7); // 0.7 is target accuracy
    setWeights(predictor.current.getWeights());

    // Signal
    const newSignal = predictor.current.generateSignal(lastPrice, { rsi, macd, ema }, { '1m': fvg1m, '5m': fvg5m, '15m': fvg15m }, ofi, premDisc, tickTrend, candleStartTicks);
    setSignal(newSignal);
  }, [ticks]);

  useEffect(() => {
    if (!appId) return;

    derivService.current = new DerivService(appId, token);
    
    const init = async () => {
      try {
        await derivService.current?.connect();
        setConnected(true);

        const res15m = await derivService.current?.getHistory(symbol, 900, 50);
        const res5m = await derivService.current?.getHistory(symbol, 300, 50);
        const res1m = await derivService.current?.getHistory(symbol, 60, 50);

        if (res15m?.candles) history15m.current = res15m.candles.map((c: any) => ({ ...c, close: parseFloat(c.close), open: parseFloat(c.open), high: parseFloat(c.high), low: parseFloat(c.low) }));
        if (res5m?.candles) history5m.current = res5m.candles.map((c: any) => ({ ...c, close: parseFloat(c.close), open: parseFloat(c.open), high: parseFloat(c.high), low: parseFloat(c.low) }));
        if (res1m?.candles) history1m.current = res1m.candles.map((c: any) => ({ ...c, close: parseFloat(c.close), open: parseFloat(c.open), high: parseFloat(c.high), low: parseFloat(c.low) }));

        derivService.current?.subscribeTicks(symbol, (data) => {
          const newQuote = data.tick.quote;
          setCurrentPrice(newQuote);
          setTicks(prev => {
             const direction = prev.length > 0 ? (newQuote > prev[prev.length - 1].quote ? 1 : -1) : 0;
             return [...prev.slice(-100), { quote: newQuote, direction }];
          });
        });

        derivService.current?.subscribeOHLC(symbol, 60, (data) => {
           const candle = data.ohlc;
           const newCandle: Candle = {
             epoch: candle.epoch,
             open: parseFloat(candle.open),
             high: parseFloat(candle.high),
             low: parseFloat(candle.low),
             close: parseFloat(candle.close)
           };
           
           if (history1m.current.length > 0 && history1m.current[history1m.current.length - 1].epoch === newCandle.epoch) {
              history1m.current[history1m.current.length - 1] = newCandle;
           } else {
              history1m.current = [...history1m.current.slice(-100), newCandle];
           }
        });

      } catch (err) {
        console.error('Failed to initialize Deriv:', err);
      }
    };

    init();

    return () => {
      derivService.current?.disconnect();
      setConnected(false);
    };
  }, [symbol, appId, token]);

  useEffect(() => {
    updateAnalysis();
  }, [ticks, updateAnalysis]);

  return { currentPrice, ticks, indicators, fvgs, signal, connected, atr, weights };
}
