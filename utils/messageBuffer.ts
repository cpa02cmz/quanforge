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
        // More accurate estimate in bytes using TextEncoder when available
        if (typeof TextEncoder !== 'undefined') {
            const encoder = new TextEncoder();
            return this.buffer.reduce((total, msg) => {
                const str = JSON.stringify(msg);
                return total + encoder.encode(str).length;
            }, 0);
        } else {
            // Fallback to character length estimation
            return this.buffer.reduce((total, msg) => {
                return total + JSON.stringify(msg).length * 2; // 2 bytes per char (UTF-16)
            }, 0);
        }
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
    private static readonly WARNING_THRESHOLD_MB = 5; // Reduced to 5MB for better memory management
    private static readonly CRITICAL_THRESHOLD_MB = 10; // Reduced to 10MB for better memory management
    private static checkInterval: ReturnType<typeof setInterval> | null = null;

    static startMonitoring(buffer: MessageBuffer, intervalMs: number = 15000): void { // Check more frequently
        this.checkInterval = setInterval(() => {
            const stats = buffer.getStats();
            const memoryUsageMB = stats.memoryUsageKB / 1024;

            if (memoryUsageMB > this.CRITICAL_THRESHOLD_MB) {
                // Force aggressive cleanup
                const recentMessages = buffer.getRecent(10); // Keep only 10 most recent
                buffer.clear();
                recentMessages.forEach(msg => buffer.add(msg));
            } else if (memoryUsageMB > this.WARNING_THRESHOLD_MB) {
                // Trim older messages more aggressively
                const cutoffTime = Date.now() - (4 * 60 * 60 * 1000); // 4 hours ago instead of 24
                buffer.trimOlderThan(cutoffTime);
            }
        }, intervalMs);
    }

    static stopMonitoring(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    
    // Method to get current monitoring status
    static isMonitoring(): boolean {
        return this.checkInterval !== null;
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
    
    // Add a method to manually trigger memory cleanup
    const performMemoryCleanup = useCallback(() => {
        const currentStats = bufferRef.current.getStats();
        if (currentStats.memoryUsageKB > 2048) { // 2MB threshold
            // Keep only the most recent 15 messages if memory is high
            const recentMessages = bufferRef.current.getRecent(15);
            bufferRef.current.clear();
            recentMessages.forEach(msg => bufferRef.current.add(msg));
            // Manual memory cleanup performed
        }
    }, []);

    return {
        addMessage,
        getMessages,
        getRecentMessages,
        clearMessages,
        getBufferStats,
        trimOlderThan,
        performMemoryCleanup
    };
};