
export const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3';

export class DerivService {
  private socket: WebSocket | null = null;
  private appId: string;
  private token: string;
  private callbacks: { [id: string]: (data: any) => void } = {};
  private msgId = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private keepAliveInterval: any = null;

  constructor(appId: string, token: string = '') {
    this.appId = appId;
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(`${DERIV_WS_URL}?app_id=${this.appId}`);

      this.socket.onopen = () => {
        console.log('Connected to Deriv WebSocket');
        this.reconnectAttempts = 0;
        this.startKeepAlive();
        if (this.token) {
          this.authorize();
        }
        resolve();
      };

      this.socket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.req_id && this.callbacks[data.req_id]) {
          this.callbacks[data.req_id](data);
        }
        // Handle streams
        if (data.msg_type === 'tick' && this.callbacks[`tick_stream_${data.tick.symbol}`]) {
          this.callbacks[`tick_stream_${data.tick.symbol}`](data);
        }
        if (data.msg_type === 'ohlc' && this.callbacks[`ohlc_stream_${data.ohlc.symbol}`]) {
           this.callbacks[`ohlc_stream_${data.ohlc.symbol}`](data);
        }
      };

      this.socket.onerror = (err) => {
        console.error('Deriv WS Error:', err);
        this.handleReconnect();
        reject(err);
      };

      this.socket.onclose = () => {
        console.log('Deriv WS Closed');
        this.stopKeepAlive();
        this.handleReconnect();
      };
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      this.send({ ping: 1 });
    }, 30000);
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private authorize() {
    this.send({ authorize: this.token });
  }

  send(payload: any, callback?: (data: any) => void): number {
    const req_id = ++this.msgId;
    const data = { ...payload, req_id };
    if (callback) {
      this.callbacks[req_id] = callback;
    }
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('Socket not open, message queued');
    }
    return req_id;
  }

  subscribeTicks(symbol: string, callback: (data: any) => void) {
    this.callbacks[`tick_stream_${symbol}`] = callback;
    this.send({ subscribe: 1, ticks: symbol });
  }

  subscribeOHLC(symbol: string, granularity: number, callback: (data: any) => void) {
    this.callbacks[`ohlc_stream_${symbol}`] = callback;
    this.send({ subscribe: 1, ohlc: symbol, granularity });
  }

  getHistory(symbol: string, granularity: number, count: number): Promise<any> {
    return new Promise((resolve) => {
      this.send({
        ticks_history: symbol,
        adjust_start_time: 1,
        count,
        end: 'latest',
        start: 1,
        style: 'candles',
        granularity
      }, (data) => resolve(data));
    });
  }

  disconnect() {
    this.socket?.close();
  }
}
