import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('EdgeCacheCompression');
/**
 * Edge Cache Compression Utilities
 * Compression strategy for edge-optimized cache entries
 */

import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

export interface CompressionConfig {
  compressionThreshold: number;
}

export class EdgeCacheCompression {
  constructor(private config: CompressionConfig) {}

  estimateSize<T>(data: T): number {
    if (data === null || data === undefined) return 0;
    return JSON.stringify(data).length * 2;
  }

  shouldCompress<T>(data: T): boolean {
    return this.estimateSize(data) > this.config.compressionThreshold;
  }

  compress<T>(data: T): T {
    try {
      const jsonString = JSON.stringify(data);
      const compressed = compressToUTF16(jsonString);
      return compressed as unknown as T;
    } catch (error: unknown) {
      logger.warn('Failed to compress data:', error);
      return data;
    }
  }

  decompress<T>(data: T): T {
    try {
      if (typeof data !== 'string') return data;
      const decompressed = decompressFromUTF16(data as string);
      return JSON.parse(decompressed);
    } catch (error: unknown) {
      logger.warn('Failed to decompress data:', error);
      return data;
    }
  }
}
