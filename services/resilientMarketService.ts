import { marketService as originalMarketService, MarketData } from './marketData';
import { withIntegrationResilience, enterDegradedMode, exitDegradedMode, isDegraded } from './integrationWrapper';
import { IntegrationType } from './integrationResilience';
import { marketDataFallbacks } from './fallbackStrategies';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('resilient-market-service');

export const resilientMarketService = {
  subscribe(symbol: string, callback: (data: MarketData) => void) {
    if (isDegraded(IntegrationType.MARKET_DATA)) {
      logger.warn('Market data service is in degraded mode');
    }

    try {
      return originalMarketService.subscribe(symbol, callback);
    } catch (error) {
      logger.error('Market data subscription failed:', error);
      throw error;
    }
  },

  unsubscribe(symbol: string, callback: (data: MarketData) => void) {
    try {
      originalMarketService.unsubscribe(symbol, callback);
    } catch (error) {
      logger.error('Market data unsubscribe failed:', error);
    }
  },

  cleanup() {
    try {
      originalMarketService.cleanup();
    } catch (error) {
      logger.error('Market data cleanup failed:', error);
    }
  },

  async getCurrentData(symbol: string): Promise<MarketData | null> {
    const result = await withIntegrationResilience(
      IntegrationType.MARKET_DATA,
      'market_data',
      async () => {
        return new Promise((resolve: any) => {
          let lastData: MarketData | null = null;
          const callback = (data: MarketData) => {
            lastData = data;
          };

          originalMarketService.subscribe(symbol, callback);

          setTimeout(() => {
            try {
              originalMarketService.unsubscribe(symbol, callback);
            } catch {
              // Silently ignore unsubscribe errors - connection may already be closed
            }
            resolve(lastData);
          }, 100);
        });
      },
      {
        operationName: 'get_current_data',
        fallbacks: [
          marketDataFallbacks.simulatedData(() => ({
            symbol,
            bid: 0,
            ask: 0,
            spread: 0,
            digits: 5,
            timestamp: Date.now(),
            status: 'error'
          }) as any)
        ]
      }
    );

    return (result.data as MarketData | null) || null;
  },

  setDegradedMode(level: number = 0.5) {
    enterDegradedMode(IntegrationType.MARKET_DATA, level);
  },

  exitDegradedMode() {
    exitDegradedMode(IntegrationType.MARKET_DATA);
  },

  isDegraded(): boolean {
    return isDegraded(IntegrationType.MARKET_DATA);
  }
};
