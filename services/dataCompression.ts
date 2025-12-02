import { Robot } from '../types';
import { compressToUTF16, decompressFromUTF16, compressToUint8Array, decompressFromUint8Array } from 'lz-string';

interface AdvancedCompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  savings: number;
  compressionTime: number;
  decompressionTime: number;
}

interface CompressionConfig {
  threshold: number; // Minimum size to compress (in bytes)
  algorithm: 'LZ-UTF16' | 'LZ-Uint8Array';
  maxCompressionRatio: number; // If compression ratio is worse than this, return original
}

/**
 * Data compression service for optimizing database storage and network transfer
 */
export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  savings: number;
}

class DataCompressionService {
  private config: CompressionConfig = {
    threshold: 1024, // 1KB threshold
    algorithm: 'LZ-UTF16',
    maxCompressionRatio: 0.95, // Don't compress if ratio is > 95%
  };

  constructor(config?: Partial<CompressionConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Compress robot data for efficient storage
   */
  compressRobot(robot: Robot): { compressed: string; stats: CompressionStats } {
    const originalData = JSON.stringify(robot);
    const originalSize = new Blob([originalData]).size;
    
    let compressed = originalData;
    let compressedSize = originalSize;
    
    if (originalSize > this.config.threshold) {
      try {
        let compressedString: string;
        switch (this.config.algorithm) {
          case 'LZ-UTF16':
            compressedString = compressToUTF16(originalData);
            break;
          case 'LZ-Uint8Array':
            const compressedArray = compressToUint8Array(originalData);
            compressedString = this.uint8ArrayToString(compressedArray);
            break;
          default:
            compressedString = compressToUTF16(originalData);
        }
        
        compressedSize = new Blob([compressedString]).size;
        const compressionRatio = compressedSize / originalSize;
        
        // Only use compressed data if it's actually smaller
        if (compressionRatio <= this.config.maxCompressionRatio) {
          compressed = compressedString;
        } else {
          // Compression didn't help, keep original
          compressedSize = originalSize;
        }
      } catch (error) {
        console.warn('Compression failed, using original data:', error);
        // If compression fails, return original with zero savings
        compressed = originalData;
        compressedSize = originalSize;
      }
    }
    
    const stats: CompressionStats = {
      originalSize,
      compressedSize,
      compressionRatio: originalSize > 0 ? compressedSize / originalSize : 0,
      savings: originalSize - compressedSize,
    };
    
    return { compressed, stats };
  }

  /**
   * Decompress robot data
   */
  decompressRobot(compressedData: string): Robot | null {
    try {
      // Check if the data appears to be compressed by looking at length ratio
      const isCompressed = compressedData.length < 100 || 
        compressedData.charCodeAt(0) > 255 || 
        compressedData.includes('\u0000'); // Check for null chars often found in compressed data
      
      if (isCompressed) {
        let decompressed: string;
        // Try to determine the algorithm used based on the data characteristics
        // For now, default to UTF16
        try {
          decompressed = decompressFromUTF16(compressedData);
        } catch {
          // If UTF16 fails, try Uint8Array approach
          const uint8Array = this.stringToUint8Array(compressedData);
          decompressed = decompressFromUint8Array(uint8Array);
        }
        
        if (decompressed) {
          return JSON.parse(decompressed) as Robot;
        }
      }
      
      // If not compressed or decompression failed, try parsing directly
      return JSON.parse(compressedData) as Robot;
    } catch (error) {
      console.error('Failed to decompress robot data:', error);
      return null;
    }
  }

  /**
   * Compress multiple robots efficiently
   */
  compressRobots(robots: Robot[]): { compressed: string[]; stats: CompressionStats[] } {
    const compressed: string[] = [];
    const stats: CompressionStats[] = [];
    
    for (const robot of robots) {
      const result = this.compressRobot(robot);
      compressed.push(result.compressed);
      stats.push(result.stats);
    }
    
    return { compressed, stats };
  }

  /**
   * Decompress multiple robots efficiently
   */
  decompressRobots(compressedData: string[]): (Robot | null)[] {
    return compressedData.map(data => this.decompressRobot(data));
  }

  /**
   * Get compression ratio for a single piece of data
   */
  getCompressionRatio(data: any): number {
    const original = JSON.stringify(data);
    const originalSize = new Blob([original]).size;
    
    if (originalSize <= this.config.threshold) {
      return 1; // No compression applied
    }
    
    try {
      let compressedString: string;
      switch (this.config.algorithm) {
        case 'LZ-UTF16':
          compressedString = compressToUTF16(original);
          break;
        case 'LZ-Uint8Array':
          const compressedArray = compressToUint8Array(original);
          compressedString = this.uint8ArrayToString(compressedArray);
          break;
        default:
          compressedString = compressToUTF16(original);
      }
      
      const compressedSize = new Blob([compressedString]).size;
      const compressionRatio = compressedSize / originalSize;
      
      return compressionRatio <= this.config.maxCompressionRatio ? compressionRatio : 1;
    } catch (error) {
      return 1; // No compression applied
    }
  }

  /**
   * Calculate potential storage savings for robot data
   */
  calculateStorageSavings(robots: Robot[]): CompressionStats {
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    
    for (const robot of robots) {
      const originalSize = new Blob([JSON.stringify(robot)]).size;
      totalOriginalSize += originalSize;
      
      if (originalSize > this.config.threshold) {
        try {
          let compressedString: string;
          switch (this.config.algorithm) {
            case 'LZ-UTF16':
              compressedString = compressToUTF16(JSON.stringify(robot));
              break;
            case 'LZ-Uint8Array':
              const compressedArray = compressToUint8Array(JSON.stringify(robot));
              compressedString = this.uint8ArrayToString(compressedArray);
              break;
            default:
              compressedString = compressToUTF16(JSON.stringify(robot));
          }
          
          const compressedSize = new Blob([compressedString]).size;
          const compressionRatio = compressedSize / originalSize;
          
          if (compressionRatio <= this.config.maxCompressionRatio) {
            totalCompressedSize += compressedSize;
          } else {
            totalCompressedSize += originalSize;
          }
        } catch {
          totalCompressedSize += originalSize;
        }
      } else {
        totalCompressedSize += originalSize;
      }
    }
    
    return {
      originalSize: totalOriginalSize,
      compressedSize: totalCompressedSize,
      compressionRatio: totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 0,
      savings: totalOriginalSize - totalCompressedSize,
    };
  }

  /**
   * Compress any data if it meets the threshold requirements
   */
  compress(data: any): { compressed: any; stats: AdvancedCompressionStats } {
    const startTime = performance.now();
    const originalSize = this.getSize(data);
    
    // Don't compress if below threshold
    if (originalSize < this.config.threshold) {
      return {
        compressed: data,
        stats: {
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
          savings: 0,
          compressionTime: performance.now() - startTime,
          decompressionTime: 0
        }
      };
    }

    let compressedData: any;
    let compressedSize: number;

    try {
      // Convert data to string for compression
      const stringData = JSON.stringify(data);
      
      let compressedString: string;
      switch (this.config.algorithm) {
        case 'LZ-UTF16':
          compressedString = compressToUTF16(stringData);
          break;
        case 'LZ-Uint8Array':
          const compressedArray = compressToUint8Array(stringData);
          compressedString = this.uint8ArrayToString(compressedArray);
          break;
        default:
          compressedString = compressToUTF16(stringData);
      }
      
      compressedData = compressedString;
      compressedSize = new Blob([compressedString]).size;
      
      const compressionRatio = compressedSize / originalSize;
      
      // If compression didn't help, return original data
      if (compressionRatio > this.config.maxCompressionRatio) {
        return {
          compressed: data,
          stats: {
            originalSize,
            compressedSize: originalSize,
            compressionRatio: 1,
            savings: 0,
            compressionTime: performance.now() - startTime,
            decompressionTime: 0
          }
        };
      }
      
      return {
        compressed: {
          __compressed__: true,
          __algorithm__: this.config.algorithm,
          __data__: compressedData
        },
        stats: {
          originalSize,
          compressedSize,
          compressionRatio,
          savings: originalSize - compressedSize,
          compressionTime: performance.now() - startTime,
          decompressionTime: 0
        }
      };
    } catch (error) {
      console.warn('Compression failed, returning original data:', error);
      return {
        compressed: data,
        stats: {
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
          savings: 0,
          compressionTime: performance.now() - startTime,
          decompressionTime: 0
        }
      };
    }
  }

  /**
   * Decompress data if it was compressed
   */
  decompress(compressedData: any): { data: any; stats: Omit<AdvancedCompressionStats, 'compressedSize' | 'compressionRatio' | 'savings' | 'compressionTime'> } {
    const startTime = performance.now();
    
    // Check if data is actually compressed
    if (
      typeof compressedData === 'object' && 
      compressedData !== null && 
      compressedData.__compressed__ === true &&
      compressedData.__data__ !== undefined
    ) {
      try {
        let decompressedString: string;
        
        switch (compressedData.__algorithm__) {
          case 'LZ-UTF16':
            decompressedString = decompressFromUTF16(compressedData.__data__);
            break;
          case 'LZ-Uint8Array':
            const uint8Array = this.stringToUint8Array(compressedData.__data__);
            decompressedString = decompressFromUint8Array(uint8Array);
            break;
          default:
            decompressedString = decompressFromUTF16(compressedData.__data__);
        }
        
        const data = JSON.parse(decompressedString);
        
        return {
          data,
          stats: {
            originalSize: this.getSize(data),
            decompressionTime: performance.now() - startTime
          }
        };
      } catch (error) {
        console.warn('Decompression failed, returning compressed data:', error);
        return {
          data: compressedData,
          stats: {
            originalSize: this.getSize(compressedData),
            decompressionTime: performance.now() - startTime
          }
        };
      }
    }
    
    // Data wasn't compressed, return as is
    return {
      data: compressedData,
      stats: {
        originalSize: this.getSize(compressedData),
        decompressionTime: performance.now() - startTime
      }
    };
  }

  /**
   * Estimate the size of data in bytes
   */
  private getSize(data: any): number {
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      return new Blob([str]).size;
    } catch {
      // Fallback for complex objects that can't be serialized
      return JSON.stringify(data).length;
    }
  }

  /**
   * Convert Uint8Array to string
   */
  private uint8ArrayToString(uint8Array: Uint8Array): string {
    // Convert each byte to a character
    let str = '';
    for (let i = 0; i < uint8Array.length; i++) {
      str += String.fromCharCode(uint8Array[i]);
    }
    return str;
  }

  /**
   * Convert string to Uint8Array
   */
  private stringToUint8Array(str: string): Uint8Array {
    const uint8Array = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      uint8Array[i] = str.charCodeAt(i);
    }
    return uint8Array;
  }

  /**
   * Batch compress multiple items
   */
  batchCompress(items: any[]): { compressedItems: any[]; stats: AdvancedCompressionStats[] } {
    const compressedItems: any[] = [];
    const stats: AdvancedCompressionStats[] = [];
    
    for (const item of items) {
      const result = this.compress(item);
      compressedItems.push(result.compressed);
      stats.push(result.stats);
    }
    
    return { compressedItems, stats };
  }

  /**
   * Batch decompress multiple items
   */
  batchDecompress(compressedItems: any[]): { items: any[]; stats: Array<Omit<AdvancedCompressionStats, 'compressedSize' | 'compressionRatio' | 'savings' | 'compressionTime'>> } {
    const items: any[] = [];
    const stats: Array<Omit<AdvancedCompressionStats, 'compressedSize' | 'compressionRatio' | 'savings' | 'compressionTime'>> = [];
    
    for (const item of compressedItems) {
      const result = this.decompress(item);
      items.push(result.data);
      stats.push(result.stats);
    }
    
    return { items, stats };
  }

  /**
   * Get compression configuration
   */
  getConfig(): CompressionConfig {
    return { ...this.config };
  }

  /**
   * Update compression configuration
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculate overall compression statistics for a batch
   */
  getBatchStats(stats: AdvancedCompressionStats[]): {
    totalOriginalSize: number;
    totalCompressedSize: number;
    averageCompressionRatio: number;
    totalSavings: number;
    totalCompressionTime: number;
  } {
    const totalOriginalSize = stats.reduce((sum, s) => sum + s.originalSize, 0);
    const totalCompressedSize = stats.reduce((sum, s) => sum + s.compressedSize, 0);
    const averageCompressionRatio = stats.length > 0 
      ? stats.reduce((sum, s) => sum + s.compressionRatio, 0) / stats.length 
      : 0;
    const totalSavings = stats.reduce((sum, s) => sum + s.savings, 0);
    const totalCompressionTime = stats.reduce((sum, s) => sum + s.compressionTime, 0);
    
    return {
      totalOriginalSize,
      totalCompressedSize,
      averageCompressionRatio,
      totalSavings,
      totalCompressionTime
    };
  }
}

export const dataCompression = new DataCompressionService();