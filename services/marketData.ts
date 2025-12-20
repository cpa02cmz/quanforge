
import { settingsManager } from './settingsManager';

type PriceUpdateCallback = (data: MarketData) => void;

export interface MarketData {
  symbol: string;
  bid: number;
  ask: number;
  spread: number; // in points
  digits: number;
  timestamp: number;
  status: 'connecting' | 'connected' | 'error';
}

class MarketDataService {
  private subscribers: Map<string, Set<PriceUpdateCallback>> = new Map();
  private lastKnownData: Map<string, MarketData> = new Map();
  
  // Binance WebSocket
  private binanceWs: WebSocket | null = null;
  private binanceSubscriptions: Set<string> = new Set();
  private binanceReconnectAttempts: number = 0;
  private binanceReconnectTimer: NodeJS.Timeout | null = null;
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectDelay = 1000; // 1 second
  
  // Twelve Data WebSocket
  private twelveDataWs: WebSocket | null = null;
  private twelveDataSubscriptions: Set<string> = new Set();
  private twelveDataReconnectAttempts: number = 0;
  private twelveDataReconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Listen for setting changes to reconnect Twelve Data if API key changes
    window.addEventListener('ai-settings-changed', () => {
        this.reconnectTwelveData();
    });
  }

  // --- Binance Implementation (Crypto) ---
  
  private ensureBinanceConnection() {
      if (this.binanceWs && (this.binanceWs.readyState === WebSocket.OPEN || this.binanceWs.readyState === WebSocket.CONNECTING)) {
          return;
      }

      // Clear any existing reconnect timer
      if (this.binanceReconnectTimer) {
          clearTimeout(this.binanceReconnectTimer);
          this.binanceReconnectTimer = null;
      }

      this.binanceWs = new WebSocket('wss://stream.binance.com:9443/ws');
      
      this.binanceWs.onopen = () => {
          console.log("Binance WS Connected");
          this.binanceReconnectAttempts = 0; // Reset on successful connection
          this.resubscribeBinance();
      };

      this.binanceWs.onmessage = (event) => {
          const data = JSON.parse(event.data);
          // Handle ticker stream payload: { s: "BTCUSDT", b: "64000.00", a: "64001.00", ... }
          if (data.e === '24hrTicker') {
              this.processBinanceMessage(data);
          }
      };

      this.binanceWs.onclose = (event) => {
          console.log(`Binance WS Closed. Code: ${event.code}, Reason: ${event.reason}`);
          this.scheduleBinanceReconnect();
      };
      
      this.binanceWs.onerror = (err) => {
          console.warn("Binance WS Error", err);
      };
  }

  private scheduleBinanceReconnect() {
      if (this.binanceReconnectAttempts >= this.maxReconnectAttempts) {
          console.error("Binance WS: Max reconnect attempts reached. Giving up.");
          return;
      }

      // Exponential backoff with jitter
      const maxDelay = parseInt(process.env['VITE_MAX_RECONNECT_DELAY'] || '30000');
      const delay = Math.min(
          this.baseReconnectDelay * Math.pow(2, this.binanceReconnectAttempts) + Math.random() * 1000,
          maxDelay // Max delay from environment
      );

      console.log(`Binance WS: Reconnecting in ${Math.round(delay / 1000)}s... (Attempt ${this.binanceReconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      this.binanceReconnectTimer = setTimeout(() => {
          this.binanceReconnectAttempts++;
          this.ensureBinanceConnection();
      }, delay);
  }

  private resubscribeBinance() {
      if (!this.binanceWs || this.binanceWs.readyState !== WebSocket.OPEN) return;
      if (this.binanceSubscriptions.size === 0) return;

      const params = Array.from(this.binanceSubscriptions).map(s => `${s.toLowerCase()}@ticker`);
      const msg = {
          method: "SUBSCRIBE",
          params: params,
          id: Date.now()
      };
      this.binanceWs?.send(JSON.stringify(msg));
  }

  private processBinanceMessage(data: any) {
      const symbol = data.s; // e.g. BTCUSDT
      const bid = parseFloat(data.b);
      const ask = parseFloat(data.a);
      
      // Calculate spread in points. 
      // For crypto, let's assume standard 2 decimals for USD pairs usually.
      // But Binance sends strings, so we can detect precision.
      const bidStr = data.b as string;
      const decimals = bidStr.includes('.') ? (bidStr.split('.')[1]?.length || 0) : 0;
      
      const multiplier = Math.pow(10, decimals);
      const spread = Math.round((ask - bid) * multiplier);

      const marketData: MarketData = {
          symbol: symbol,
          bid,
          ask,
          spread,
          digits: decimals,
          timestamp: Date.now(),
          status: 'connected'
      };
      
      this.notifySubscribers(symbol, marketData);
  }

  // --- Twelve Data Implementation (Forex/Metals) ---

  private ensureTwelveDataConnection() {
      const settings = settingsManager.getSettings();
      const apiKey = settings.twelveDataApiKey;

      if (!apiKey) return; // Cannot connect without key

      if (this.twelveDataWs && (this.twelveDataWs.readyState === WebSocket.OPEN || this.twelveDataWs.readyState === WebSocket.CONNECTING)) {
          return;
      }

      // Clear any existing reconnect timer
      if (this.twelveDataReconnectTimer) {
          clearTimeout(this.twelveDataReconnectTimer);
          this.twelveDataReconnectTimer = null;
      }

      this.twelveDataWs = new WebSocket(`wss://ws.twelvedata.com/v1/quotes?apikey=${apiKey}`);

      this.twelveDataWs.onopen = () => {
          console.log("Twelve Data WS Connected");
          this.twelveDataReconnectAttempts = 0; // Reset on successful connection
          this.resubscribeTwelveData();
      };

      this.twelveDataWs.onmessage = (event) => {
          try {
              const data = JSON.parse(event.data);
              if (data.event === 'price') {
                 this.processTwelveDataMessage(data);
              }
              if (data.event === 'error') {
                  console.warn("Twelve Data Error:", data.message);
                  // Handle authentication errors
                  if (data.message?.includes('apikey')) {
                      console.error("Twelve Data API key invalid. Stopping reconnection attempts.");
                      this.twelveDataReconnectAttempts = this.maxReconnectAttempts;
                  }
              }
          } catch (error) {
              console.error("Twelve Data: Failed to parse message:", error);
          }
      };

      this.twelveDataWs.onclose = (event) => {
          console.log(`Twelve Data WS Closed. Code: ${event.code}, Reason: ${event.reason}`);
          // Only reconnect if we still have subscribers needing it and haven't exceeded max attempts
           if (this.twelveDataSubscriptions.size > 0 && this.twelveDataReconnectAttempts < this.maxReconnectAttempts) {
               this.scheduleTwelveDataReconnect();
           }
      };

      this.twelveDataWs.onerror = (err) => {
          console.warn("Twelve Data WS Error", err);
      };
  }

  private scheduleTwelveDataReconnect() {
      if (this.twelveDataReconnectAttempts >= this.maxReconnectAttempts) {
          console.error("Twelve Data WS: Max reconnect attempts reached. Giving up.");
          return;
      }

      // Exponential backoff with jitter
      const maxDelay = parseInt(process.env['VITE_MAX_RECONNECT_DELAY'] || '30000');
      const delay = Math.min(
          this.baseReconnectDelay * Math.pow(2, this.twelveDataReconnectAttempts) + Math.random() * 1000,
          maxDelay // Max delay from environment
      );

      console.log(`Twelve Data WS: Reconnecting in ${Math.round(delay / 1000)}s... (Attempt ${this.twelveDataReconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      this.twelveDataReconnectTimer = setTimeout(() => {
          this.twelveDataReconnectAttempts++;
          this.ensureTwelveDataConnection();
      }, delay);
  }

  private reconnectTwelveData = () => {
       if (this.twelveDataWs) {
           this.twelveDataWs.close();
           this.twelveDataWs = null;
       }
       this.ensureTwelveDataConnection();
   }

  private resubscribeTwelveData() {
      if (!this.twelveDataWs || this.twelveDataWs.readyState !== WebSocket.OPEN) return;
      if (this.twelveDataSubscriptions.size === 0) return;

      const symbols = Array.from(this.twelveDataSubscriptions).join(',');
      const msg = {
          action: "subscribe",
          params: { symbols: symbols }
      };
      this.twelveDataWs?.send(JSON.stringify(msg));
  }

  private processTwelveDataMessage(data: any) {
      // Data format: { symbol: "EUR/USD", bid: 1.0850, ask: 1.0851, timestamp: ... }
      const symbol = data.symbol;
      const bid = data.bid;
      const ask = data.ask;
      
      // Auto-detect digits
      const bidStr = bid.toString();
      const digits = bidStr.includes('.') ? bidStr.split('.')[1].length : 0;
      const multiplier = Math.pow(10, digits);
      const spread = Math.round((ask - bid) * multiplier);

      const marketData: MarketData = {
          symbol: symbol,
          bid,
          ask,
          spread,
          digits,
          timestamp: data.timestamp * 1000,
          status: 'connected'
      };

      this.notifySubscribers(symbol, marketData);
  }

  // --- Public API ---

  public subscribe(symbol: string, callback: PriceUpdateCallback) {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(callback);

    // If we have cached data, send it immediately
    if (this.lastKnownData.has(symbol)) {
        callback(this.lastKnownData.get(symbol)!);
    } else {
        // Send initial "Connecting" state
        callback({
            symbol,
            bid: 0,
            ask: 0,
            spread: 0,
            digits: 2,
            timestamp: Date.now(),
            status: 'connecting'
        });
    }

    // Determine Provider
    const upperSymbol = symbol.toUpperCase();
    
    // Logic: 
    // If it contains '/', it's Forex (Twelve Data).
    // If it is XAUUSD or Gold, it's Twelve Data (usually).
    // If it ends in USDT, BUSD, etc, it's Binance.
    
    if (upperSymbol.includes('/') || upperSymbol === 'XAUUSD' || upperSymbol.includes('XAU/')) {
        this.twelveDataSubscriptions.add(upperSymbol);
        this.ensureTwelveDataConnection();
        if (this.twelveDataWs?.readyState === WebSocket.OPEN) {
            this.twelveDataWs?.send(JSON.stringify({ action: "subscribe", params: { symbols: upperSymbol } }));
        }
    } else {
        // Default to Binance for things that look like Crypto pairs (no slash)
        // Clean symbol for Binance (remove slash if any, though logic above handles slash)
        // e.g. BTCUSDT
        this.binanceSubscriptions.add(upperSymbol);
        this.ensureBinanceConnection();
        if (this.binanceWs?.readyState === WebSocket.OPEN) {
             this.binanceWs?.send(JSON.stringify({ method: "SUBSCRIBE", params: [`${upperSymbol.toLowerCase()}@ticker`], id: Date.now() }));
        }
    }
  }

  public unsubscribe(symbol: string, callback: PriceUpdateCallback) {
    if (this.subscribers.has(symbol)) {
      this.subscribers.get(symbol)!.delete(callback);
      if (this.subscribers.get(symbol)!.size === 0) {
        this.subscribers.delete(symbol);
        
        // Unsubscribe from Socket
        const upperSymbol = symbol.toUpperCase();
        if (this.twelveDataSubscriptions.has(upperSymbol)) {
            this.twelveDataSubscriptions.delete(upperSymbol);
            if (this.twelveDataWs?.readyState === WebSocket.OPEN) {
                // Twelve data doesn't strictly require unsubscribe if connection persists, but good practice
                // Not strictly implemented in their basic docs for single symbol unsubscribe easily mixed with others
            }
        }
        if (this.binanceSubscriptions.has(upperSymbol)) {
            this.binanceSubscriptions.delete(upperSymbol);
             if (this.binanceWs?.readyState === WebSocket.OPEN) {
                 this.binanceWs?.send(JSON.stringify({ method: "UNSUBSCRIBE", params: [`${upperSymbol.toLowerCase()}@ticker`], id: Date.now() }));
            }
        }
      }
    }
  }

  private notifySubscribers(symbol: string, data: MarketData) {
       this.lastKnownData.set(symbol, data);
       const subs = this.subscribers.get(symbol);
       if (subs && subs.size > 0) {
           // Create a copy of the callbacks set to prevent issues if one callback unsubscribes during execution
           const callbacks = Array.from(subs);
           for (const cb of callbacks) {
               try {
                   cb(data);
               } catch (error) {
                   console.error("Error in market data callback:", error);
                   // Remove the problematic callback
                   subs.delete(cb);
               }
           }
       }
   }

  public cleanup() {
      // Clear reconnect timers
      if (this.binanceReconnectTimer) {
          clearTimeout(this.binanceReconnectTimer);
          this.binanceReconnectTimer = null;
      }
      if (this.twelveDataReconnectTimer) {
          clearTimeout(this.twelveDataReconnectTimer);
          this.twelveDataReconnectTimer = null;
      }

      // Close WebSocket connections
      if (this.binanceWs) {
          this.binanceWs.close();
          this.binanceWs = null;
      }
      if (this.twelveDataWs) {
          this.twelveDataWs.close();
          this.twelveDataWs = null;
      }
      
      // Clear all subscriptions and data
      this.subscribers.clear();
      this.lastKnownData.clear();
      this.binanceSubscriptions.clear();
      this.twelveDataSubscriptions.clear();
      
      // Reset reconnect attempts
      this.binanceReconnectAttempts = 0;
      this.twelveDataReconnectAttempts = 0;
      
      // Remove event listener
      window.removeEventListener('ai-settings-changed', this.reconnectTwelveData);
  }
}

export const marketService = new MarketDataService();
