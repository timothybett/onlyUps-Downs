import { RSI, MACD, EMA, ATR } from 'technicalindicators';
import { Candle, FVGZone, IndicatorLevels, Signal } from '../types/deriv';

export class TechnicalAnalysis {
  static calculateRSI(prices: number[], period = 14): number {
    if (prices.length <= period) return 50;
    const rsi = RSI.calculate({ values: prices, period });
    return rsi[rsi.length - 1] || 50;
  }

  static calculateMACD(prices: number[]) {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
    const macd = MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const last = macd[macd.length - 1];
    return last ? { macd: last.MACD || 0, signal: last.signal || 0, histogram: last.histogram || 0 } : { macd: 0, signal: 0, histogram: 0 };
  }

  static calculateEMAs(prices: number[]) {
    const ema8 = EMA.calculate({ period: 8, values: prices });
    const ema21 = EMA.calculate({ period: 21, values: prices });
    const ema50 = EMA.calculate({ period: 50, values: prices });
    return {
      ema8: ema8[ema8.length - 1] || 0,
      ema21: ema21[ema21.length - 1] || 0,
      ema50: ema50[ema50.length - 1] || 0,
    };
  }

  static calculateATR(candles: Candle[], period = 14): number {
    if (candles.length < period + 1) return 0;
    const input = {
      high: candles.map(c => c.high),
      low: candles.map(c => c.low),
      close: candles.map(c => c.close),
      period
    };
    const atr = ATR.calculate(input);
    return atr[atr.length - 1] || 0;
  }

  static findFVGs(candles: Candle[]): FVGZone[] {
    const fvgs: FVGZone[] = [];
    if (candles.length < 3) return fvgs;

    for (let i = 2; i < candles.length; i++) {
        const c1 = candles[i - 2];
        const c2 = candles[i - 1]; 
        const c3 = candles[i];

        if (c3.low > c1.high) {
            fvgs.push({
                type: 'bullish',
                top: c3.low,
                bottom: c1.high,
                epoch: c2.epoch
            });
        }
        else if (c3.high < c1.low) {
            fvgs.push({
                type: 'bearish',
                top: c1.low,
                bottom: c3.high,
                epoch: c2.epoch
            });
        }
    }
    return fvgs;
  }

  static calculateOFI(ticks: { quote: number; direction: number }[]): number {
    return ticks.reduce((acc, tick) => acc + (1 * tick.direction), 0);
  }

  static getPremiumDiscount(price: number, high: number, low: number): number {
    if (high === low) return 50;
    return ((price - low) / (high - low)) * 100;
  }
}

export interface PredictiveWeights {
  fvg: number;
  ofi: number;
  rsi: number;
  macd: number;
  ema: number;
  pattern: number;
  premDisc: number;
}

export class DerivVolatilityPredictor {
  private weights: PredictiveWeights = {
    fvg: 2.0,
    ofi: 2.0,
    rsi: 1.5,
    macd: 1.5,
    ema: 1.5,
    pattern: 2.0,
    premDisc: 1.0
  };

  private lastSignal: Signal | null = null;
  private performanceHistory: { score: number; outcome: number }[] = [];

  constructor() {}

  public adjustWeights(atr: number, recentAccuracy: number) {
    // Dynamically adjust weights based on volatility (ATR)
    // High Volatility: Prioritize EMA (trend) and OFI (momentum)
    // Low Volatility: Prioritize FVG (reversion) and RSI (overbought/sold)
    
    if (atr > 0.05) { // Arbitrary threshold for "high" volatility
      this.weights.ema += 0.1;
      this.weights.ofi += 0.1;
      this.weights.fvg -= 0.1;
    } else {
      this.weights.fvg += 0.1;
      this.weights.rsi += 0.1;
      this.weights.ema -= 0.1;
    }

    // Adjust based on recent accuracy if performance is tracked
    if (recentAccuracy < 0.5) {
      // If accuracy low, revert to base or shuffle slightly to find better correlation
      Object.keys(this.weights).forEach(k => {
        const key = k as keyof PredictiveWeights;
        this.weights[key] = Math.max(0.5, this.weights[key] * 0.95);
      });
    }

    // Normalize weights to maintain average impact
    const total = Object.values(this.weights).reduce((a, b) => a + b, 0);
    const target = 11.5; // sum of initial weights
    Object.keys(this.weights).forEach(k => {
       const key = k as keyof PredictiveWeights;
       this.weights[key] = (this.weights[key] / total) * target;
    });
  }

  public generateSignal(
    currentPrice: number,
    indicators: IndicatorLevels,
    fvgs: { [tf: string]: FVGZone[] },
    ofi: number,
    premiumDiscount: number,
    tickTrend: 'up' | 'down' | 'neutral',
    candleStartTicks: { quote: number; direction: number }[]
  ): Signal {
    let score = 0;
    const reasons: string[] = [];

    const isCandleStart = candleStartTicks.length >= 2 && candleStartTicks.length <= 4;
    const initialTrend = candleStartTicks.every(t => t.direction === -1) ? 'DOWN' : candleStartTicks.every(t => t.direction === 1) ? 'UP' : 'MIXED';

    const hasBullishFVG = Object.values(fvgs).some(list => list.some(fvg => fvg.type === 'bullish' && currentPrice >= fvg.bottom && currentPrice <= fvg.top));
    const hasBearishFVG = Object.values(fvgs).some(list => list.some(fvg => fvg.type === 'bearish' && currentPrice >= fvg.bottom && currentPrice <= fvg.top));

    let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';

    // BULLISH SCORE
    let bScore = 0;
    if (isCandleStart && initialTrend === 'DOWN' && indicators.rsi < 40) {
      bScore += this.weights.pattern;
      reasons.push("Bullish Reversal Pattern detected");
    }
    if (hasBullishFVG) {
      bScore += this.weights.fvg;
      reasons.push("Inside High-TF Bullish FVG");
    }
    if (ofi > 2) bScore += this.weights.ofi;
    if (indicators.rsi < 50) bScore += this.weights.rsi / 2; // Partial impact
    if (indicators.macd.histogram > 0) bScore += this.weights.macd;
    if (indicators.ema.ema8 > indicators.ema.ema21) bScore += this.weights.ema;
    if (premiumDiscount < 50) bScore += this.weights.premDisc;

    // BEARISH SCORE
    let dScore = 0;
    if (isCandleStart && initialTrend === 'UP' && indicators.rsi > 60) {
      dScore += this.weights.pattern;
      reasons.push("Bearish Reversal Pattern detected");
    }
    if (hasBearishFVG) {
      dScore += this.weights.fvg;
      reasons.push("Inside High-TF Bearish FVG");
    }
    if (ofi < -2) dScore += this.weights.ofi;
    if (indicators.rsi > 50) dScore += this.weights.rsi / 2;
    if (indicators.macd.histogram < 0) dScore += this.weights.macd;
    if (indicators.ema.ema8 < indicators.ema.ema21) dScore += this.weights.ema;
    if (premiumDiscount > 50) dScore += this.weights.premDisc;

    if (bScore >= 6 && bScore > dScore) {
      direction = 'UP';
      score = Math.min(10, bScore);
    } else if (dScore >= 6 && dScore > bScore) {
      direction = 'DOWN';
      score = Math.min(10, dScore);
    }

    const sig: Signal = { direction, score, timestamp: Date.now(), reasons };
    this.lastSignal = sig;
    return sig;
  }

  public getWeights() {
    return this.weights;
  }
}
