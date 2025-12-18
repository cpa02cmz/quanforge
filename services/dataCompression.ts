import { Robot } from '../types';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

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
  private compressionThreshold = 1024; // 1KB threshold

  /**
   * Compress robot data for efficient storage
   */
  compressRobot(robot: Robot): { compressed: string; stats: CompressionStats } {
    const originalData = JSON.stringify(robot);
    const originalSize = new Blob([originalData]).size;
    
    let compressed = originalData;
    let compressedSize = originalSize;
    
    if (originalSize > this.compressionThreshold) {
      try {
        compressed = compressToUTF16(originalData);
        compressedSize = new Blob([compressed]).size;
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
        const decompressed = decompressFromUTF16(compressedData);
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
    
    if (originalSize <= this.compressionThreshold) {
      return 1; // No compression applied
    }
    
    try {
      const compressed = compressToUTF16(original);
      const compressedSize = new Blob([compressed]).size;
      return compressedSize / originalSize;
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
      
      if (originalSize > this.compressionThreshold) {
        try {
          const compressed = compressToUTF16(JSON.stringify(robot));
          totalCompressedSize += new Blob([compressed]).size;
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
}

export const dataCompression = new DataCompressionService();