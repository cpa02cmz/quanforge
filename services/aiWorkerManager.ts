// AI Worker Manager - Handles communication with AI processing Web Worker
// Offloads intensive AI context building and processing from main thread

import { Message, StrategyParams } from '../types';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('aiWorkerManager');

type WorkerMessageType = 'BUILD_CONTEXT' | 'PROCESS_RESPONSE' | 'EXTRACT_CODE' | 'FORMAT_MESSAGE' | 'GENERATE_CONTENT' | 'PARSE_RESPONSE';
type WorkerResponseType = 'CONTEXT_BUILT' | 'RESPONSE_PROCESSED' | 'CODE_EXTRACTED' | 'MESSAGE_FORMATTED' | 'SUCCESS' | 'ERROR';

interface WorkerMessage {
  type: WorkerMessageType;
  id: string;
  data: any;
}

interface WorkerResponse {
  type: WorkerResponseType;
  id: string;
  data?: any;
  error?: string;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

class AIWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestId = 0;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker(): Promise<void> {
    if (this.isInitialized || this.initializationPromise) {
      return this.initializationPromise || Promise.resolve();
    }

    this.initializationPromise = new Promise((resolve, reject) => {
      try {
        // Create worker from the enhanced Gemini worker file
        try {
          this.worker = new Worker(
            new URL('/workers/geminiWorker.ts', import.meta.url),
            { type: 'module' }
          );
        } catch (error) {
          logger.error('Failed to create Gemini worker with import.meta.url, trying fallback:', error);
          this.worker = new Worker('/workers/geminiWorker.js', { type: 'module' });
        }

        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          this.handleWorkerMessage(event);
        };

        this.worker.onerror = (error) => {
          logger.error('Worker error:', error);
          reject(new Error('Worker initialization failed'));
        };

        // Worker is ready
        this.isInitialized = true;
        resolve();
      } catch (error) {
        logger.error('Failed to create worker:', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const { type, id, data, error } = event.data;
    const pending = this.pendingRequests.get(id);

    if (!pending) {
      logger.warn(`Received response for unknown request: ${id}`);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(id);

    if (type === 'ERROR' || error) {
      pending.reject(new Error(error || 'Worker operation failed'));
    } else {
      pending.resolve(data);
    }
  }

  private async sendMessage<T>(type: WorkerMessageType, data: any, timeout = 30000): Promise<T> {
    await this.initializeWorker();

    if (!this.worker) {
      throw new Error('Worker not available');
    }

    const requestId = `req_${++this.requestId}_${Date.now()}`;

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Worker request timeout: ${type}`));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutId
      } as PendingRequest);

      const message: WorkerMessage = { type, id: requestId, data };
      this.worker!.postMessage(message);
    });
  }

  // Public API methods
  async buildContext(prompt: string, currentCode?: string, strategyParams?: StrategyParams, history: Message[] = []): Promise<string> {
    try {
      const result = await this.sendMessage<{ context: string }>(
        'BUILD_CONTEXT',
        { prompt, currentCode, strategyParams, history },
        10000 // 10 second timeout for context building
      );
      return result.context;
    } catch (error) {
      logger.error('Context building failed:', error);
      throw error;
    }
  }

  async processResponse(rawResponse: string): Promise<{ thinking?: string; content: string }> {
    try {
      const result = await this.sendMessage<{ thinking?: string; content: string }>(
        'PROCESS_RESPONSE',
        { rawResponse },
        5000 // 5 second timeout for response processing
      );
      return result;
    } catch (error) {
      logger.error('Response processing failed:', error);
      throw error;
    }
  }

  async extractCode(text: string): Promise<string | null> {
    try {
      const result = await this.sendMessage<{ code: string | null }>(
        'EXTRACT_CODE',
        { text },
        3000 // 3 second timeout for code extraction
      );
      return result.code;
    } catch (error) {
      logger.error('Code extraction failed:', error);
      throw error;
    }
  }

  async formatMessage(rawText: string, hasCode: boolean): Promise<string> {
    try {
      const result = await this.sendMessage<{ formatted: string }>(
        'FORMAT_MESSAGE',
        { rawText, hasCode },
        3000 // 3 second timeout for message formatting
      );
      return result.formatted;
    } catch (error) {
      logger.error('Message formatting failed:', error);
      throw error;
    }
  }

  // Enhanced methods for Gemini worker integration
  async generateContent(fullPrompt: string): Promise<{ response: string }> {
    try {
      const result = await this.sendMessage<{ response: string }>(
        'GENERATE_CONTENT',
        { fullPrompt },
        60000 // 60 second timeout for content generation
      );
      return result;
    } catch (error) {
      logger.error('Content generation failed:', error);
      throw error;
    }
  }

  async parseGeminiResponse(response: string): Promise<{ code?: string; analysis?: any; thinking?: string }> {
    try {
      const result = await this.sendMessage<{ code?: string; analysis?: any; thinking?: string }>(
        'PARSE_RESPONSE',
        { response },
        5000 // 5 second timeout for response parsing
      );
      return result;
    } catch (error) {
      logger.error('Response parsing failed:', error);
      throw error;
    }
  }

  // Performance monitoring
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  isWorkerReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  // Cleanup
  async terminate(): Promise<void> {
    // Clear all pending requests
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Worker terminated'));
    }
    this.pendingRequests.clear();

    // Terminate worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.isInitialized = false;
    this.initializationPromise = null;
  }

  // Restart worker if needed
  async restart(): Promise<void> {
    await this.terminate();
    await this.initializeWorker();
    logger.info('Worker restarted successfully');
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.sendMessage('BUILD_CONTEXT', { prompt: 'test', history: [] }, 2000);
      return true;
    } catch (error) {
      logger.warn('Worker health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const aiWorkerManager = new AIWorkerManager();

// Export class for testing
export { AIWorkerManager };

// Fallback functions for when worker is not available
export const fallbackContextBuilder = async (
  prompt: string, 
  currentCode?: string, 
  strategyParams?: StrategyParams, 
  history: Message[] = []
): Promise<string> => {
  // Simple fallback context building
  const parts = [prompt];
  
  if (currentCode) {
    parts.push(`\nCurrent Code:\n${currentCode}`);
  }
  
  if (strategyParams) {
    parts.push(`\nStrategy Parameters:\n${JSON.stringify(strategyParams, null, 2)}`);
  }
  
  if (history.length > 0) {
    parts.push(`\nHistory:\n${history.map(m => `${m.role}: ${m.content}`).join('\n')}`);
  }
  
  return parts.join('\n');
};

export const fallbackResponseProcessor = async (rawResponse: string): Promise<{ thinking?: string; content: string }> => {
  // Simple fallback response processing
  const thinkRegex = /<think(?:ing)?>(.*?)<\/think(?:ing)?>/si;
  const match = rawResponse.match(thinkRegex);
  
  if (match && match[1]) {
    const thinking = match[1].trim();
    const content = rawResponse.replace(thinkRegex, '').trim();
    return { thinking, content };
  }
  
  return { content: rawResponse };
};

export const fallbackCodeExtractor = async (text: string): Promise<string | null> => {
  const codeBlockRegex = /```(?:cpp|c|mql5)?([\s\S]*?)```/i;
  const match = text.match(codeBlockRegex);
  return match?.[1]?.trim() || null;
};

export const fallbackMessageFormatter = async (rawText: string, hasCode: boolean): Promise<string> => {
  if (hasCode) {
    return rawText.replace(/```(?:cpp|c|mql5)?([\s\S]*?)```/i, '\n*(Code updated in Editor)*\n').trim();
  }
  return rawText;
};