import { describe, test, expect, beforeEach, vi } from 'vitest';
import { EdgeCacheCompression, CompressionConfig } from './edgeCacheCompression';

describe('EdgeCacheCompression', () => {
  let compression: EdgeCacheCompression;
  let config: CompressionConfig;

  beforeEach(() => {
    config = { compressionThreshold: 100 };
    compression = new EdgeCacheCompression(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('estimateSize', () => {
    test('should return 0 for null data', () => {
      const size = compression.estimateSize(null);
      expect(size).toBe(0);
    });

    test('should return 0 for undefined data', () => {
      const size = compression.estimateSize(undefined);
      expect(size).toBe(0);
    });

    test('should estimate size for small object', () => {
      const data = { name: 'test' };
      const size = compression.estimateSize(data);
      expect(size).toBeGreaterThan(0);
    });

    test('should estimate size for large object', () => {
      const data = { data: 'x'.repeat(100) };
      const size = compression.estimateSize(data);
      expect(size).toBeGreaterThan(config.compressionThreshold);
    });

    test('should estimate size for nested objects', () => {
      const data = { nested: { deep: { value: 'test' } } };
      const size = compression.estimateSize(data);
      expect(size).toBeGreaterThan(0);
    });

    test('should estimate size for arrays', () => {
      const data = [1, 2, 3, 4, 5];
      const size = compression.estimateSize(data);
      expect(size).toBeGreaterThan(0);
    });

    test('should estimate size for strings', () => {
      const data = 'test string';
      const size = compression.estimateSize(data);
      expect(size).toBeGreaterThan(0);
    });

    test('should estimate size for numbers', () => {
      const data = 12345;
      const size = compression.estimateSize(data);
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('shouldCompress', () => {
    test('should return false for data below threshold', () => {
      const data = { small: 'data' };
      const shouldCompress = compression.shouldCompress(data);
      expect(shouldCompress).toBe(false);
    });

    test('should return true for data above threshold', () => {
      const data = { large: 'x'.repeat(100) };
      const shouldCompress = compression.shouldCompress(data);
      expect(shouldCompress).toBe(true);
    });

    test('should handle data at threshold boundary', () => {
      const jsonString = JSON.stringify({ data: 'x'.repeat(25) });
      const exactSize = jsonString.length * 2;
      const configExact = { compressionThreshold: exactSize };
      const compressionExact = new EdgeCacheCompression(configExact);
      const data = { data: 'x'.repeat(25) };
      const shouldCompress = compressionExact.shouldCompress(data);
      expect(shouldCompress).toBe(false);
    });

    test('should return false for null data', () => {
      const shouldCompress = compression.shouldCompress(null);
      expect(shouldCompress).toBe(false);
    });

    test('should return false for undefined data', () => {
      const shouldCompress = compression.shouldCompress(undefined);
      expect(shouldCompress).toBe(false);
    });

    test('should work with different compression thresholds', () => {
      const lowThreshold = { compressionThreshold: 10 };
      const highThreshold = { compressionThreshold: 1000 };
      
      const compressionLow = new EdgeCacheCompression(lowThreshold);
      const compressionHigh = new EdgeCacheCompression(highThreshold);
      
      const data = { test: 'data' };
      
      expect(compressionLow.shouldCompress(data)).toBe(true);
      expect(compressionHigh.shouldCompress(data)).toBe(false);
    });
  });

  describe('compress', () => {
    test('should compress data successfully', () => {
      const data = { message: 'Hello, World!' };
      const compressed = compression.compress(data);
      
      expect(typeof compressed).toBe('string');
      expect(compressed).not.toEqual(JSON.stringify(data));
    });

    test('should compress large data', () => {
      const data = { large: 'x'.repeat(1000) };
      const compressed = compression.compress(data);
      
      expect(typeof compressed).toBe('string');
      expect((compressed as unknown as string).length).toBeLessThan(JSON.stringify(data).length);
    });

    test('should handle compression of nested objects', () => {
      const data = { 
        level1: { 
          level2: { 
            level3: { value: 'nested' } 
          } 
        } 
      };
      
      const compressed = compression.compress(data);
      expect(typeof compressed).toBe('string');
    });

    test('should handle compression of arrays', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item-${i}` }));
      const compressed = compression.compress(data);
      
      expect(typeof compressed).toBe('string');
    });

    test('should return original data on compression failure', () => {
      const circularData: any = { name: 'circular' };
      circularData.self = circularData;
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = compression.compress(circularData);
      
      expect(result).toBe(circularData);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to compress data:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle special characters in data', () => {
      const data = { 
        special: 'Special chars: ñ, é, 中文, 日本語',
        unicode: '\u{1F600} \u{1F604} \u{1F60A}'
      };
      
      const compressed = compression.compress(data);
      expect(typeof compressed).toBe('string');
    });

    test('should handle numeric data', () => {
      const data = 12345;
      const compressed = compression.compress(data);
      expect(typeof compressed).toBe('string');
    });

    test('should handle boolean data', () => {
      const data = true;
      const compressed = compression.compress(data);
      expect(typeof compressed).toBe('string');
    });

    test('should handle empty objects', () => {
      const data = {};
      const compressed = compression.compress(data);
      expect(typeof compressed).toBe('string');
    });

    test('should handle empty arrays', () => {
      const data = [];
      const compressed = compression.compress(data);
      expect(typeof compressed).toBe('string');
    });
  });

  describe('decompress', () => {
    test('should decompress compressed data successfully', () => {
      const originalData = { message: 'Hello, World!' };
      const compressed = compression.compress(originalData);
      const decompressed = compression.decompress(compressed);
      
      expect(decompressed).toEqual(originalData);
    });

    test('should decompress large data successfully', () => {
      const originalData = { large: 'x'.repeat(1000) };
      const compressed = compression.compress(originalData);
      const decompressed = compression.decompress(compressed);
      
      expect(decompressed).toEqual(originalData);
    });

    test('should decompress nested objects', () => {
      const originalData = { 
        level1: { 
          level2: { 
            level3: { value: 'nested' } 
          } 
        } 
      };
      
      const compressed = compression.compress(originalData);
      const decompressed = compression.decompress(compressed);
      
      expect(decompressed).toEqual(originalData);
    });

    test('should decompress arrays', () => {
      const originalData = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item-${i}` }));
      const compressed = compression.compress(originalData);
      const decompressed = compression.decompress(compressed);
      
      expect(decompressed).toEqual(originalData);
    });

    test('should return original data if not a string', () => {
      const nonStringData = { not: 'compressed' };
      const result = compression.decompress(nonStringData);
      
      expect(result).toBe(nonStringData);
    });

    test('should return null on decompression failure', () => {
      const invalidString = 'not-a-valid-compressed-string';
      const result = compression.decompress(invalidString);
      
      expect(result).toBe(null);
    });

    test('should handle decompression of special characters', () => {
      const originalData = { 
        special: 'Special chars: ñ, é, 中文, 日本語',
        unicode: '\u{1F600} \u{1F604} \u{1F60A}'
      };
      
      const compressed = compression.compress(originalData);
      const decompressed = compression.decompress(compressed);
      
      expect(decompressed).toEqual(originalData);
    });

    test('should handle decompression of numeric strings', () => {
      const originalData = 12345;
      const compressed = compression.compress(originalData);
      const decompressed = compression.decompress(compressed);
      
      expect(decompressed).toBe(originalData);
    });

    test('should handle decompression of boolean strings', () => {
      const originalData = true;
      const compressed = compression.compress(originalData);
      const decompressed = compression.decompress(compressed);
      
      expect(decompressed).toBe(originalData);
    });

    test('should handle decompression of empty objects', () => {
      const originalData = {};
      const compressed = compression.compress(originalData);
      const decompressed = compression.decompress(compressed);
      
      expect(decompressed).toEqual(originalData);
    });

    test('should handle decompression of empty arrays', () => {
      const originalData = [];
      const compressed = compression.compress(originalData);
      const decompressed = compression.decompress(compressed);
      
      expect(decompressed).toEqual(originalData);
    });
  });

  describe('compression roundtrip', () => {
    test('should maintain data integrity through compress-decompress cycle', () => {
      const originalData = {
        string: 'test',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        nested: { deep: { value: 'test' } },
        special: 'ñ é 中文 日本语'
      };
      
      const compressed = compression.compress(originalData);
      const decompressed = compression.decompress(compressed);
      
      expect(decompressed).toEqual(originalData);
    });

    test('should handle multiple compress-decompress cycles', () => {
      const originalData = { counter: 0, items: Array.from({ length: 50 }, (_, i) => i) };
      
      let data = originalData;
      for (let i = 0; i < 5; i++) {
        const compressed = compression.compress(data);
        data = compression.decompress(compressed);
      }
      
      expect(data).toEqual(originalData);
    });
  });

  describe('integration with shouldCompress', () => {
    test('should only compress data above threshold', () => {
      const smallData = { small: 'data' };
      const largeData = { large: 'x'.repeat(100) };
      
      const shouldCompressSmall = compression.shouldCompress(smallData);
      const shouldCompressLarge = compression.shouldCompress(largeData);
      
      expect(shouldCompressSmall).toBe(false);
      expect(shouldCompressLarge).toBe(true);
    });
  });
});
