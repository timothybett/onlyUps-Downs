
export interface Tick {
  epoch: number;
  quote: number;
  symbol: string;
}

export interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface HistoryResponse {
  candles?: Candle[];
  history?: {
    prices: number[];
    times: number[];
  };
}

export interface IndicatorLevels {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  ema: {
    ema8: number;
    ema21: number;
    ema50: number;
  };
}

export interface FVGZone {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  epoch: number;
}

export interface Signal {
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  score: number;
  timestamp: number;
  reasons: string[];
}
