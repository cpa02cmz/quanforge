import { Message } from '../types';
import { useRef, useEffect, useCallback } from 'react';

// Circular buffer for efficient message history management
export class MessageBuffer {
    private buffer: Message[] = [];
    private maxSize: number;
    private index = 0;
    private isFull = false;

    constructor(maxSize: number = 50) {
        this.maxSize = maxSize;
    }

    // Add a new message to the buffer
    add(message: Message): void {
        if (this.buffer.length < this.maxSize) {
            this.buffer.push(message);
        } else {
            // Overwrite oldest message
            this.buffer[this.index] = message;
            this.index = (this.index + 1) % this.maxSize;
            this.isFull = true;
        }
    }

    // Get all messages in chronological order
    getAll(): Message[] {
        if (!this.isFull) {
            return [...this.buffer];
        }
        
        // Return messages from oldest to newest
        const result: Message[] = [];
        for (let i = 0; i < this.maxSize; i++) {
            const idx = (this.index + i) % this.maxSize;
            if (this.buffer[idx]) {
                result.push(this.buffer[idx]);
            }
        }
        return result;
    }

    // Get the most recent N messages
    getRecent(count: number): Message[] {
        const all = this.getAll();
        return all.slice(-count);
    }

    // Clear the buffer
    clear(): void {
        this.buffer = [];
        this.index = 0;
        this.isFull = false;
    }

    // Get current size
    size(): number {
        return this.buffer.length;
    }

    // Check if buffer is full
    full(): boolean {
        return this.isFull;
    }

    // Get memory usage estimate
    getMemoryUsage(): number {
        // Rough estimate in bytes
        return this.buffer.reduce((total, msg) => {
            return total + JSON.stringify(msg).length * 2; // 2 bytes per char (UTF-16)
        }, 0);
    }

    // Get buffer statistics
    getStats(): { size: number; maxSize: number; isFull: boolean; memoryUsageKB: number } {
        return {
            size: this.size(),
            maxSize: this.maxSize,
            isFull: this.isFull,
            memoryUsageKB: Math.round(this.getMemoryUsage() / 1024)
        };
    }

    // Trim messages older than specified timestamp
    trimOlderThan(timestamp: number): number {
        const all = this.getAll();
        const filtered = all.filter(msg => msg.timestamp >= timestamp);
        const removed = all.length - filtered.length;
        
        this.clear();
        filtered.forEach(msg => this.add(msg));
        
        return removed;
    }

    // Export messages for persistence
    export(): Message[] {
        return this.getAll();
    }

    // Import messages from persistence
    import(messages: Message[]): void {
        this.clear();
        messages.forEach(msg => this.add(msg));
    }
}

// Memory monitoring for message buffer
export class MessageMemoryMonitor {
    private static readonly WARNING_THRESHOLD_MB = 10; // 10MB
    private static readonly CRITICAL_THRESHOLD_MB = 25; // 25MB
    private static checkInterval: NodeJS.Timeout | null = null;

    static startMonitoring(buffer: MessageBuffer, intervalMs: number = 30000): void {
        this.checkInterval = setInterval(() => {
            const stats = buffer.getStats();
            const memoryUsageMB = stats.memoryUsageKB / 1024;

            if (memoryUsageMB > this.CRITICAL_THRESHOLD_MB) {
                console.warn(`Critical message buffer memory usage: ${memoryUsageMB.toFixed(2)}MB`);
                // Force cleanup
                const recentMessages = buffer.getRecent(20); // Keep only 20 most recent
                buffer.clear();
                recentMessages.forEach(msg => buffer.add(msg));
            } else if (memoryUsageMB > this.WARNING_THRESHOLD_MB) {
                console.warn(`High message buffer memory usage: ${memoryUsageMB.toFixed(2)}MB`);
                // Trim older messages
                const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
                const removed = buffer.trimOlderThan(cutoffTime);
                if (removed > 0) {
                    console.log(`Trimmed ${removed} old messages to reduce memory usage`);
                }
            }
        }, intervalMs);
    }

    static stopMonitoring(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}

// React hook for using message buffer
export const useMessageBuffer = (maxSize: number = 50) => {
    const bufferRef = useRef<MessageBuffer>(new MessageBuffer(maxSize));

    useEffect(() => {
        // Start memory monitoring
        MessageMemoryMonitor.startMonitoring(bufferRef.current);

        return () => {
            // Cleanup on unmount
            MessageMemoryMonitor.stopMonitoring();
            bufferRef.current.clear();
        };
    }, []);

    const addMessage = useCallback((message: Message) => {
        bufferRef.current.add(message);
    }, []);

    const getMessages = useCallback(() => {
        return bufferRef.current.getAll();
    }, []);

    const getRecentMessages = useCallback((count: number) => {
        return bufferRef.current.getRecent(count);
    }, []);

    const clearMessages = useCallback(() => {
        bufferRef.current.clear();
    }, []);

    const getBufferStats = useCallback(() => {
        return bufferRef.current.getStats();
    }, []);

    const trimOlderThan = useCallback((timestamp: number) => {
        return bufferRef.current.trimOlderThan(timestamp);
    }, []);

    return {
        addMessage,
        getMessages,
        getRecentMessages,
        clearMessages,
        getBufferStats,
        trimOlderThan
    };
};