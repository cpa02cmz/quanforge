
// Dynamic import for Google GenAI to reduce initial bundle size
type GoogleGenAIConstructor = new (options: { apiKey: string }) => {
  models: {
    generateContent: (options: {
      model: string;
      contents: string;
      config?: Record<string, unknown>;
    }) => Promise<{ text?: string }>;
  };
};

type GenAIType = {
  OBJECT: string;
  NUMBER: string;
  STRING: string;
};

let GoogleGenAI: GoogleGenAIConstructor | null = null;
let Type: GenAIType | null = null;
import { MQL5_SYSTEM_PROMPT } from "../constants";
import { StrategyParams, StrategyAnalysis, Message, MessageRole, AISettings } from "../types";
import { settingsManager } from "./settingsManager";
import { getActiveKey } from "../utils/apiKeyUtils";
import { handleError } from "../utils/errorHandler";
import { apiDeduplicator } from "./apiDeduplicator";
import { createScopedLogger } from "../utils/logger";
import { aiWorkerManager } from "./aiWorkerManager";

const logger = createScopedLogger('gemini');

// Enhanced cache with TTL and size management
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

import { memoryMonitor } from '../utils/memoryManagement';

class EnhancedCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;
  private cacheName: string;
  
  constructor(maxSize: number = 100, cacheName: string = 'enhanced-cache') {
    this.maxSize = maxSize;
    this.cacheName = cacheName;
    
    // Register with memory monitor
    memoryMonitor.registerCache(cacheName, {
      size: () => this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      clear: () => this.clear(),
      cleanup: () => this.cleanup()
    });
    
    // Listen for memory cleanup events
    window.addEventListener('memory-cleanup', (event: any) => {
      if (!event.detail.cacheName || event.detail.cacheName === this.cacheName) {
        this.cleanup(event.detail.level);
      }
    });
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: T, ttl: number = 300000): void { // Default 5 minutes TTL
    // Remove oldest entries if we're at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  size(): number {
    return this.cache.size;
  }
  
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
  
  cleanup(level: 'light' | 'aggressive' | 'emergency' = 'light'): number {
    let cleanedCount = 0;
    const now = Date.now();
    
    switch (level) {
      case 'emergency':
        // Clear everything
        cleanedCount = this.cache.size;
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        break;
        
      case 'aggressive':
        // Clear expired and least recently used entries
        const keysToDelete = Array.from(this.cache.keys());
        for (const key of keysToDelete) {
          const entry = this.cache.get(key);
          if (entry && now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            cleanedCount++;
          }
        }
        // If still too large, remove oldest entries
        while (this.cache.size > this.maxSize * 0.5) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) {
            this.cache.delete(firstKey);
            cleanedCount++;
          } else {
            break;
          }
        }
        break;
        
      case 'light':
      default:
        // Only clear expired entries
        for (const [key, entry] of this.cache.entries()) {
          if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            cleanedCount++;
          }
        }
        break;
    }
    
    // Update memory monitor metrics
    memoryMonitor.updateCacheMetrics(this.cacheName, {
      size: this.cache.size,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      lastCleanup: now
    });
    
    return cleanedCount;
  }
}

// Enhanced security utilities for input sanitization and validation
const sanitizePrompt = (prompt: string): string => {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt: must be a non-empty string');
  }
  
  // Remove potentially dangerous patterns with enhanced regex
  const sanitized = prompt
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: protocol and variants
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^>\s]*/gi, '')
    // Remove iframe and object tags
    .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    // Remove meta tags with refresh
    .replace(/<meta\s+http-equiv\s*=\s*["']refresh["'][^>]*>/gi, '')
    // Remove CSS expressions
    .replace(/expression\s*\(/gi, '')
    // Remove @import and other CSS injections
    .replace(/@import\s+[^;]+;/gi, '')
    // Remove HTML comments that might hide scripts
    .replace(/<!--[\s\S]*?-->/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // Enhanced validation with character checks
  const hasInvalidChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(sanitized);
  if (hasInvalidChars) {
    throw new Error('Invalid characters detected in prompt');
  }
  
  // Check for potential injection patterns
  const suspiciousPatterns = [
    /eval\s*\(/gi,
    /function\s*\(/gi,
    /document\./gi,
    /window\./gi,
    /localStorage/gi,
    /sessionStorage/gi,
    /cookie/gi,
    /location\./gi,
    /navigator\./gi
  ];
  
  const hasSuspiciousContent = suspiciousPatterns.some(pattern => pattern.test(sanitized));
  if (hasSuspiciousContent) {
    logger.warn('Suspicious content detected in prompt, applying additional sanitization');
    // Additional sanitization for suspicious content
    return sanitized.replace(/[<>]/g, '').substring(0, 2000);
  }
  
  // Enforce length limits to prevent token exhaustion attacks
  if (sanitized.length > 10000) {
    throw new Error('Prompt too long: maximum 10,000 characters allowed');
  }
  
  if (sanitized.length < 10) {
    throw new Error('Prompt too short: minimum 10 characters required');
  }
  
  // Rate limiting check (simple implementation)
  const now = Date.now();
  const promptKey = `prompt_${Math.floor(now / 60000)}`; // Per minute bucket
  const currentCount = parseInt(localStorage.getItem(promptKey) || '0');
  if (currentCount >= 30) { // Max 30 prompts per minute
    throw new Error('Rate limit exceeded: please wait before sending another prompt');
  }
  localStorage.setItem(promptKey, (currentCount + 1).toString());
  
  return sanitized;
};

// Enhanced input validation for strategy parameters
const validateStrategyParams = (params: StrategyParams): StrategyParams => {
  if (!params || typeof params !== 'object') {
    throw new Error('Invalid strategy parameters');
  }
  
  // Validate numeric ranges
  const validated = { ...params };
  
  if (validated.stopLoss !== undefined) {
    validated.stopLoss = Math.max(1, Math.min(1000, Number(validated.stopLoss) || 50));
  }
  
  if (validated.takeProfit !== undefined) {
    validated.takeProfit = Math.max(1, Math.min(1000, Number(validated.takeProfit) || 100));
  }
  
  if (validated.riskPercent !== undefined) {
    validated.riskPercent = Math.max(0.1, Math.min(100, Number(validated.riskPercent) || 2));
  }
  
  if (validated.magicNumber !== undefined) {
    validated.magicNumber = Math.max(1000, Math.min(999999, Number(validated.magicNumber) || 12345));
  }
  
  return validated;
};

// Enhanced input validation for strategy parameters (boolean check)
export const isValidStrategyParams = (params: any): boolean => {
  if (!params || typeof params !== 'object') {
    return false;
  }
  
  // Validate required fields
  const requiredFields = ['timeframe', 'symbol', 'riskPercent', 'stopLoss', 'takeProfit'];
  for (const field of requiredFields) {
    if (!(field in params) || params[field] === null || params[field] === undefined) {
      return false;
    }
  }
  
  // Validate numeric ranges
  if (params.riskPercent < 0.1 || params.riskPercent > 100) {
    return false;
  }
  
  if (params.stopLoss < 1 || params.stopLoss > 1000) {
    return false;
  }
  
  if (params.takeProfit < 1 || params.takeProfit > 1000) {
    return false;
  }
  
  // Validate symbol format
  if (!/^[A-Z]{6}$|^[A-Z]{3}\/[A-Z]{3}$|^[A-Z]{6}$/.test(params.symbol)) {
    return false;
  }
  
  return true;
};

// Advanced cache for strategy analysis to avoid repeated API calls
// Uses LRU eviction to prevent memory bloat
class LRUCache<T> {
  private cache = new Map<string, { result: T, timestamp: number }>();
  private readonly ttl: number;
  private readonly maxSize: number;
  private cacheName: string;
  private hits = 0;
  private misses = 0;

  constructor(ttl: number = 5 * 60 * 1000, maxSize: number = 100, cacheName: string = 'lru-cache') { // 5 min TTL, max 100 items
    this.ttl = ttl;
    this.maxSize = maxSize;
    this.cacheName = cacheName;
    
    // Register with memory monitor
    memoryMonitor.registerCache(cacheName, {
      size: () => this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      clear: () => this.clear(),
      cleanup: () => this.cleanup()
    });
    
    // Listen for memory cleanup events
    window.addEventListener('memory-cleanup', (event: any) => {
      if (!event.detail.cacheName || event.detail.cacheName === this.cacheName) {
        this.cleanup(event.detail.level);
      }
    });
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) {
      this.misses++;
      return undefined;
    }

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    this.hits++;
    return item.result;
  }

  set(key: string, value: T): void {
    // Evict oldest if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, { result: value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
  
  private cleanup(level: 'light' | 'aggressive' | 'emergency' = 'light'): number {
    let cleanedCount = 0;
    const now = Date.now();
    
    switch (level) {
      case 'emergency':
        cleanedCount = this.cache.size;
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        break;
        
      case 'aggressive':
        // Clear expired entries
        for (const [key, item] of this.cache.entries()) {
          if (now - item.timestamp > this.ttl) {
            this.cache.delete(key);
            cleanedCount++;
          }
        }
        // If still too large, remove oldest entries
        while (this.cache.size > this.maxSize * 0.5) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) {
            this.cache.delete(firstKey);
            cleanedCount++;
          } else {
            break;
          }
        }
        break;
        
      case 'light':
      default:
        // Only clear expired entries
        for (const [key, item] of this.cache.entries()) {
          if (now - item.timestamp > this.ttl) {
            this.cache.delete(key);
            cleanedCount++;
          }
        }
        break;
    }
    
    // Update memory monitor metrics
    memoryMonitor.updateCacheMetrics(this.cacheName, {
      size: this.cache.size,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      lastCleanup: now
    });
    
    return cleanedCount;
  }
}

const analysisCache = new LRUCache<StrategyAnalysis>(5 * 60 * 1000, 100, 'strategy-analysis'); // 5 min TTL, max 100 items
const enhancedAnalysisCache = new EnhancedCache<StrategyAnalysis>(200, 'strategy-analysis-enhanced'); // Larger cache size for better performance

// Semantic cache for generateMQL5Code responses
const mql5ResponseCache = new EnhancedCache<{ thinking?: string, content: string }>(300, 'mql5-generation'); // Cache for MQL5 generation responses

// Create semantic cache key for similar prompts
const createSemanticCacheKey = (prompt: string, currentCode?: string, strategyParams?: StrategyParams, settings?: AISettings): string => {
  // Normalize prompt by removing common variations and focusing on core intent
  const normalizedPrompt = prompt
    .toLowerCase()
    .replace(/\b(create|generate|build|make|write)\b/g, '') // Remove action words
    .replace(/\b(robot|expert advisor|ea|bot|script)\b/g, '') // Remove object words
    .replace(/\s+/g, ' ')
    .trim();
  
  // Extract key parameters for caching
  const keyParams = {
    symbol: strategyParams?.symbol || 'any',
    timeframe: strategyParams?.timeframe || 'any',
    riskPercent: strategyParams?.riskPercent || 0,
    stopLoss: strategyParams?.stopLoss || 0,
    takeProfit: strategyParams?.takeProfit || 0
  };
  
  // Create hash from normalized components
  const components = [
    normalizedPrompt.substring(0, 200), // First 200 chars of normalized prompt
    currentCode ? currentCode.substring(0, 100) : 'none', // First 100 chars of current code
    JSON.stringify(keyParams),
    settings?.provider || 'google',
    settings?.modelName || 'default'
  ];
  
  return createHash(components.join('|'));
};

// Request deduplication to prevent duplicate API calls
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // If request is already in flight, return the existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    // Create new request and store the promise
    const promise = requestFn().finally(() => {
      // Clean up after request completes (whether success or failure)
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  // Clear all pending requests (useful for cleanup)
  clear(): void {
    this.pendingRequests.clear();
  }

  // Get count of pending requests
  get pendingCount(): number {
    return this.pendingRequests.size;
  }
}

const requestDeduplicator = new RequestDeduplicator();

/**
 * Utility: Retry an async operation with exponential backoff.
 * Useful for handling API rate limits (429) or transient network errors.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000, maxDelay = 10000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (error.name === 'AbortError') throw error; // Do not retry if aborted by user

        if (retries === 0) throw error;
        
        const isRateLimit = error.status === 429 || (error.message && error.message.includes('429'));
        const isServerErr = error.status >= 500;
        const isNetworkErr = error.message?.includes('fetch failed') || 
                             error.message?.includes('network') || 
                             error.message?.includes('timeout') ||
                             error.message?.includes('ETIMEDOUT') ||
                             error.message?.includes('ECONNRESET');

        // Only retry on Rate Limits, Server Errors, or Network Issues
        if (isRateLimit || isServerErr || isNetworkErr) {
// Removed for production: console.warn(`API Error (${error.status || 'Network'}). Retrying in ${delay}ms... (${retries} left)`);
            // Add jitter to prevent thundering herd
            const jitter = Math.random() * 0.1 * delay;
            const nextDelay = Math.min(delay * 1.5 + jitter, maxDelay); // Use 1.5 multiplier instead of 2 for gentler backoff
            await new Promise(resolve => setTimeout(resolve, nextDelay));
            return withRetry(fn, retries - 1, nextDelay, maxDelay);
        }
        
        throw error;
    }
}

// Optimized token budgeting with efficient caching
  class TokenBudgetManager {
      private static readonly MAX_CONTEXT_CHARS = 100000;
      private static readonly MIN_HISTORY_CHARS = 1000;
    
    // LRU cache for context parts
    private contextCache = new Map<string, { content: string, timestamp: number }>();
    private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private static readonly MAX_CACHE_SIZE = 20; // Reduced cache size
    
    private getCachedContext(key: string, builder: () => string): string {
        const cached = this.contextCache.get(key);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < TokenBudgetManager.CACHE_TTL) {
            // Move to end (LRU behavior)
            this.contextCache.delete(key);
            this.contextCache.set(key, cached);
            return cached.content;
        }
        
        const content = builder();
        this.contextCache.set(key, { content, timestamp: now });
        
        // LRU cleanup
        if (this.contextCache.size > TokenBudgetManager.MAX_CACHE_SIZE) {
            const oldestKey = this.contextCache.keys().next().value;
            if (oldestKey) {
                this.contextCache.delete(oldestKey);
            }
        }
        
        return content;
    }
    
    private buildParamsContext(strategyParams?: StrategyParams): string {
        if (!strategyParams) return '';
        
        const cacheKey = `params-${strategyParams.symbol}-${strategyParams.timeframe}-${strategyParams.riskPercent}`;
        return this.getCachedContext(cacheKey, () => {
            const customInputsStr = strategyParams.customInputs.length > 0 
                ? strategyParams.customInputs.map(i => `  - input ${i.type} ${i.name} = ${i.type === 'string' ? `"${i.value}"` : i.value};`).join('\n')
                : '// No custom inputs defined';
                
            return `
 CONFIGURATION CONSTRAINTS (MUST IMPLEMENT THESE):
 - Symbol: ${strategyParams.symbol}
 - Timeframe: ${strategyParams.timeframe}
 - Risk Percent: ${strategyParams.riskPercent}% per trade
 - Magic Number: ${strategyParams.magicNumber}
 - Stop Loss: ${strategyParams.stopLoss} Pips (IMPORTANT: You must implement logic to convert these Pips to Points in the code. Typically: StopLoss * 10 * _Point)
 - Take Profit: ${strategyParams.takeProfit} Pips (IMPORTANT: You must implement logic to convert these Pips to Points in the code. Typically: TakeProfit * 10 * _Point)
 - Custom Inputs:
 ${customInputsStr}

 Ensure these inputs are defined at the top of the file as 'input' variables so the user can change them in MetaTrader.
 For Stop Loss and Take Profit, clearly label the input comments as 'Pips'.
 `;
        });
    }
    
    private buildCodeContext(currentCode?: string, maxLength?: number): string {
        if (!currentCode) return '// No code generated yet\n';
        
        const cacheKey = `code-${currentCode.substring(0, 100)}-${maxLength || 'full'}`;
        return this.getCachedContext(cacheKey, () => {
            if (maxLength && currentCode.length > maxLength) {
                return `\nCURRENT MQL5 CODE (truncated to ${maxLength} chars):\n\`\`\`cpp\n${currentCode.substring(0, maxLength)}\n\`\`\`\n`;
            }
            return `\nCURRENT MQL5 CODE:\n\`\`\`cpp\n${currentCode}\n\`\`\`\n`;
        });
    }
    
    // Optimized history management with diff-based updates
     private buildHistoryContext(history: Message[], currentPrompt: string, remainingBudget: number): string {
         // Filter out duplicate immediate prompt more efficiently
         const effectiveHistory = history.filter((msg, index) => {
             const isLast = index === history.length - 1;
             const isUser = msg.role === MessageRole.USER;
             return !(isLast && isUser && msg.content === currentPrompt);
         });
 
         if (effectiveHistory.length === 0) return '';
         
         // Pre-calculate message sizes and sort by importance
         const messageData = effectiveHistory.map((msg, index) => {
             const content = `${msg.role === MessageRole.USER ? 'User' : 'Model'}: ${msg.content}`;
             return {
                 msg,
                 index,
                 content,
                 length: content.length,
                 importance: 0
             };
         });
         
         // Calculate importance scores with more sophisticated logic
         messageData.forEach(data => {
             // Base importance on recency (more recent = more important)
             const recencyFactor = (data.index + 1) / effectiveHistory.length;
             data.importance = recencyFactor * 10;
             
             // User messages are more important than model messages
             if (data.msg.role === MessageRole.USER) {
                 data.importance += 2;
             }
             
             // Messages with code blocks or technical content may be more important
             if (data.content.includes('```') || data.content.includes('function') || 
                 data.content.includes('if ') || data.content.includes('for ')) {
                 data.importance += 1;
             }
             
             // Shorter messages are more likely to be concise and valuable
             if (data.length < 300) {
                 data.importance += 0.5;
             }
         });
         
         // Sort by importance (descending) then by recency
         messageData.sort((a, b) => {
             if (Math.abs(a.importance - b.importance) > 0.01) {
                 return b.importance - a.importance;
             }
             return b.index - a.index;
         });
         
         // Smart selection algorithm with adaptive truncation
         const selectedMessages = [];
         let usedBudget = 0;
         const separatorLength = 2; // \n\n
         
         // First, try to fit as many complete messages as possible
         for (const data of messageData) {
             const requiredBudget = data.length + (selectedMessages.length > 0 ? separatorLength : 0);
             
             if (usedBudget + requiredBudget <= remainingBudget) {
                 selectedMessages.push(data);
                 usedBudget += requiredBudget;
             } else {
                 // If we're at the limit but still have budget for truncation, try truncating
                 break;
             }
         }
         
         // If we have remaining budget and no messages were selected, select and truncate the most important one
         if (selectedMessages.length === 0 && remainingBudget > TokenBudgetManager.MIN_HISTORY_CHARS && messageData.length > 0) {
             const mostImportant = messageData[0];
             if (mostImportant) {
                 const availableForContent = remainingBudget - 3; // 3 for "..."
                 if (availableForContent >= 50) { // Minimum truncation length
                     const truncatedLength = Math.min(mostImportant.length, availableForContent);
                     const truncatedContent = mostImportant.content.substring(0, truncatedLength) + '...';
                     selectedMessages.push({
                         ...mostImportant,
                         content: truncatedContent,
                         length: truncatedContent.length
                     });
                     usedBudget = truncatedContent.length;
                 }
             }
         }
         
         // If we still have significant budget remaining and have selected messages,
         // consider adding truncated versions of additional messages
         if (selectedMessages.length > 0 && (remainingBudget - usedBudget) > 200) {
             for (const data of messageData) {
                 // Skip if already selected
                 if (selectedMessages.some(selected => selected.index === data.index)) {
                     continue;
                 }
                 
                 const availableForTruncation = remainingBudget - usedBudget - separatorLength;
                 if (availableForTruncation > 50) { // Minimum size for meaningful truncation
                     const truncatedLength = Math.min(data.length, Math.floor(availableForTruncation * 0.7)); // Use 70% of available space
                     if (truncatedLength >= 30) { // Minimum meaningful content
                         const truncatedContent = data.content.substring(0, truncatedLength) + '...';
                         selectedMessages.push({
                             ...data,
                             content: truncatedContent,
                             length: truncatedContent.length
                         });
                         usedBudget += separatorLength + truncatedContent.length;
                     }
                 }
             }
         }
         
         // Sort back to chronological order
         selectedMessages.sort((a, b) => (a.index || 0) - (b.index || 0));
         
         return selectedMessages.map(data => data.content).join('\n\n');
     }
    
    buildContext(prompt: string, currentCode?: string, strategyParams?: StrategyParams, history: Message[] = []): string {
        // Create cache key for context building
        const contextCacheKey = this.createContextCacheKey(prompt, currentCode, strategyParams, history);
        
        return this.getCachedContext(contextCacheKey, () => {
            const footerReminder = `
FINAL REMINDERS:
1. Output COMPLETE code. No placeholders like "// ... rest of code".
2. Ensure strict MQL5 syntax correctness.
3. If changing logic, rewrite the full file.
`;

            // Build base components with optimized calculation
            const paramsContext = this.buildParamsContext(strategyParams);
            let codeContext = this.buildCodeContext(currentCode);
            
            // Calculate total length more efficiently
            const baseLength = paramsContext.length + codeContext.length + prompt.length + footerReminder.length;
            
            // Early truncation with better buffer management
            if (baseLength > TokenBudgetManager.MAX_CONTEXT_CHARS) {
                if (import.meta.env.DEV) {
                  console.warn("Base context exceeds token budget, truncating code block");
                }
                const availableForCode = TokenBudgetManager.MAX_CONTEXT_CHARS - paramsContext.length - prompt.length - footerReminder.length - 1000;
                codeContext = this.buildCodeContext(currentCode, Math.max(availableForCode, 1000));
            }
            
            const currentBaseLength = paramsContext.length + codeContext.length + prompt.length + footerReminder.length;
            const remainingBudget = Math.max(TokenBudgetManager.MAX_CONTEXT_CHARS - currentBaseLength, 0);
            
            // Build history with remaining budget
            const historyContent = this.buildHistoryContext(history, prompt, Math.max(remainingBudget, 0));
            
            return `
${paramsContext}

${codeContext}

${historyContent ? `CONVERSATION HISTORY:\n${historyContent}\n` : ''}

NEW USER REQUEST: 
${prompt}

Please respond based on the history and the request. 
If code changes are needed, output the FULL updated code in a code block. 
If it's just a question, answer with text only.

${footerReminder}
`;
        });
    }

    private createContextCacheKey(prompt: string, currentCode?: string, strategyParams?: StrategyParams, history: Message[] = []): string {
        const paramsHash = strategyParams ? JSON.stringify(strategyParams) : '';
        const codeHash = currentCode ? currentCode.substring(0, 500) : ''; // First 500 chars
        const historyHash = history.map(m => `${m.role}:${m.content.substring(0, 100)}`).join('|');
        return `${prompt.length}:${codeHash}:${paramsHash}:${historyHash}`;
    }
    
    // Clear cache when needed
    clearCache(): void {
        this.contextCache.clear();
    }
}

// Global instance
const tokenBudgetManager = new TokenBudgetManager();

/**
 * Builds the full context prompt string with enhanced Token Budgeting.
 * Uses Web Worker for better performance when available.
 */
const buildContextPrompt = async (prompt: string, currentCode?: string, strategyParams?: StrategyParams, history: Message[] = []): Promise<string> => {
    try {
        // Try to use Web Worker for better performance
        if (aiWorkerManager.isWorkerReady()) {
            return await aiWorkerManager.buildContext(prompt, currentCode, strategyParams, history);
        } else {
            // Fallback to main thread if worker is not available
            return tokenBudgetManager.buildContext(prompt, currentCode, strategyParams, history);
        }
    } catch (error) {
        logger.warn('Web Worker context building failed, using fallback:', error);
        // Fallback to main thread
        return tokenBudgetManager.buildContext(prompt, currentCode, strategyParams, history);
    }
};

/**
 * Constructs the effective system instruction by appending user custom rules.
 */
const getEffectiveSystemPrompt = (settings: AISettings): string => {
    let basePrompt = MQL5_SYSTEM_PROMPT;
    
    // Inject Language Instruction
    if (settings.language === 'id') {
        basePrompt += `\n\n[LANGUAGE INSTRUCTION]:\nPlease interact, explain logic, and add code comments in INDONESIAN (Bahasa Indonesia). However, keep standard MQL5 reserved keywords and variable names in English for code standard compliance.`;
    } else {
        basePrompt += `\n\n[LANGUAGE INSTRUCTION]:\nPlease interact, explain logic, and add code comments in ENGLISH.`;
    }

    if (!settings.customInstructions || settings.customInstructions.trim() === '') {
        return basePrompt;
    }
    return `${basePrompt}\n\n[USER CUSTOM INSTRUCTIONS]:\n${settings.customInstructions}\n\nEnsure you strictly follow the User Custom Instructions above.`;
};

/**
 * Executes a call to the Google Gemini API.
 */
// Dynamic loader for GoogleGenAI to reduce initial bundle size
const getGoogleGenAI = async () => {
  if (!GoogleGenAI) {
    const module = await import("@google/genai");
    GoogleGenAI = module.GoogleGenAI;
    Type = module.Type;
  }
  return GoogleGenAI;
};

const callGoogleGenAI = async (settings: AISettings, fullPrompt: string, signal?: AbortSignal, temperature?: number) => {
    return withRetry(async () => {
        const activeKey = getActiveKey(settings.apiKey);
        if (!activeKey) throw new Error("Google API Key missing in settings.");
        
        const GoogleGenAIClass = await getGoogleGenAI();
        if (!GoogleGenAIClass) throw new Error('Failed to load Google GenAI');
        const ai = new GoogleGenAIClass({ apiKey: activeKey });
        const systemInstruction = getEffectiveSystemPrompt(settings);
        
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

        const config: any = {
          systemInstruction: systemInstruction
        };
        
        if (temperature !== undefined) {
          config.temperature = temperature;
        }

        const response = await ai!.models.generateContent({
          model: settings.modelName || 'gemini-3-pro-preview',
          contents: fullPrompt,
          config
        });

        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

        return response.text;
    });
};

/**
 * Executes a call to an OpenAI Compatible API (ChatGPT, DeepSeek, Local LLM).
 */
const callOpenAICompatible = async (settings: AISettings, fullPrompt: string, signal?: AbortSignal, temperature?: number, jsonMode: boolean = false) => {
    return withRetry(async () => {
        const activeKey = getActiveKey(settings.apiKey);

        if (!activeKey && !settings.baseUrl?.includes('localhost')) {
// Removed for production: console.warn("API Key is empty for OpenAI Provider");
        }

        const baseUrl = settings.baseUrl ? settings.baseUrl.replace(/\/$/, '') : 'https://api.openai.com/v1';
        const url = `${baseUrl}/chat/completions`;
        const systemInstruction = getEffectiveSystemPrompt(settings);

const payload = {
            model: settings.modelName || 'gpt-4',
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: fullPrompt }
            ],
            temperature: temperature ?? 0.7,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {})
        };

        const requestInit: import('node-fetch').RequestInit = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${activeKey}`,
                ...(settings.baseUrl?.includes('openrouter') ? {
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'QuantForge AI'
                } : {})
            },
            body: JSON.stringify(payload)
        };

        if (signal) {
            requestInit.signal = signal;
        }

        const response = await fetch(url, requestInit as RequestInit);
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    });
}

/**
 * Splits the raw response into thinking process (if any) and actual content.
 */
const extractThinking = (rawText: string): { thinking?: string, content: string } => {
    // Regex for <think> (DeepSeek/R1) or <thinking> (Claude)
    const thinkRegex = /<think(?:ing)?>(.*?)<\/think(?:ing)?>/si;
    const match = rawText.match(thinkRegex);
    
    if (match && match[1]) {
        const thinking = match[1].trim();
        const content = rawText.replace(thinkRegex, '').trim();
        return { thinking, content };
    }
    
    return { content: rawText };
};

export const generateMQL5Code = async (prompt: string, currentCode?: string, strategyParams?: StrategyParams, history: Message[] = [], signal?: AbortSignal) => {
   const settings = settingsManager.getSettings();

   try {
     // Security: Validate and sanitize inputs
     const sanitizedPrompt = sanitizePrompt(prompt);
     
     // Validate strategy parameters if provided
     let validatedParams = strategyParams;
     if (strategyParams) {
       validatedParams = validateStrategyParams(strategyParams);
     }

     // Early return for empty prompts (after sanitization check)
     if (!sanitizedPrompt || sanitizedPrompt.trim().length === 0) {
       return { content: "Please provide a strategy description or request." };
     }

     // Create semantic cache key for similar prompts
     const semanticKey = createSemanticCacheKey(sanitizedPrompt, currentCode, validatedParams, settings);
     
     // Check semantic cache first
     const cachedResponse = mql5ResponseCache.get(semanticKey);
     if (cachedResponse) {
       logger.debug('Semantic cache hit for MQL5 generation');
       return cachedResponse;
     }

     const fullPrompt = await buildContextPrompt(sanitizedPrompt, currentCode, validatedParams, history);
     let rawResponse = "";

     // Create deduplication key for this specific request with more comprehensive parameters
     const requestKey = createHash(`${prompt}-${currentCode?.substring(0, 200)}-${JSON.stringify(strategyParams)}-${history.length}-${settings.provider}-${settings.modelName}`);
     
 // Use request deduplication to prevent duplicate API calls
      rawResponse = await apiDeduplicator.deduplicate(requestKey, async () => {
       if (settings.provider === 'openai') {
           return await callOpenAICompatible(settings, fullPrompt, signal);
       } else {
           return await callGoogleGenAI(settings, fullPrompt, signal) || "";
       }
     });
     
     // Use Web Worker for response processing if available
     let response: { thinking?: string; content: string };
     try {
         if (aiWorkerManager.isWorkerReady()) {
             response = await aiWorkerManager.processResponse(rawResponse);
         } else {
             response = extractThinking(rawResponse);
         }
     } catch (error) {
         logger.warn('Web Worker response processing failed, using fallback:', error);
         response = extractThinking(rawResponse);
     }
     
     // Cache the response with semantic key and longer TTL for similar prompts
     mql5ResponseCache.set(semanticKey, response, 900000); // 15 minutes TTL
     
     return response;

   } catch (error: any) {
     if (error.name === 'AbortError') throw error;
     handleError(error, 'generateMQL5Code', 'gemini');
     return { content: `Error generating response: ${error.message || error}` };
   }
 };

/**
 * Self-Refining Agent: Analyzes current code and improves it.
 */
export const refineCode = async (currentCode: string, signal?: AbortSignal) => {
    const settings = settingsManager.getSettings();
    const activeKey = getActiveKey(settings.apiKey);
    
    if (!activeKey && settings.provider === 'google') throw new Error("API Key missing");

    const prompt = `
You are a Senior MQL5 Code Reviewer and Optimizer.
Analyze the following MQL5 code deeply.
Your task is to REWRITE the code to be more robust, efficient, and strictly adhere to MQL5 best practices, WITHOUT changing the core trading strategy logic.

Improvements to apply:
1. Fix any potential memory leaks or unhandled return codes (e.g., OrderSend checks).
2. Optimize execution speed if possible.
3. Ensure variable naming is clean and professional.
4. Add better comments explaining complex sections.
5. Standardize formatting.

CURRENT CODE:
\`\`\`cpp
${currentCode}
\`\`\`

Output ONLY the improved code in a markdown block. Do not output conversational text.
    `;

     try {
         let rawResponse = "";
         if (settings.provider === 'openai') {
              rawResponse = await callOpenAICompatible(settings, prompt, signal, 0.2); 
         } else {
              rawResponse = await callGoogleGenAI(settings, prompt, signal, 0.2) || "";
         }
         
         return extractThinking(rawResponse);
} catch (e: any) {
          if (e.name === 'AbortError') throw e; // Don't wrap abort errors
          handleError(e, 'refineCode', 'gemini');
          throw new Error("Refinement failed: " + e.message);
      }
};

/**
 * Explain Code Feature
 */
export const explainCode = async (currentCode: string, signal?: AbortSignal) => {
    const settings = settingsManager.getSettings();
    const prompt = `
You are an expert MQL5 educator. 
Explain the logic of the following trading robot in simple, clear terms suitable for a trader.
Focus on:
1. When it buys (Entry conditions).
2. When it sells (Entry conditions).
3. How risk is managed (Stop Loss/Take Profit).

CURRENT CODE:
\`\`\`cpp
${currentCode.substring(0, 10000)} 
\`\`\`

Use Markdown formatting (bullet points, bold text) for readability. Do NOT include code blocks in your explanation.
    `;

    try {
        let rawResponse = "";
        if (settings.provider === 'openai') {
             rawResponse = await callOpenAICompatible(settings, prompt, signal, 0.4); 
        } else {
             rawResponse = await callGoogleGenAI(settings, prompt, signal, 0.4) || "";
        }
        return extractThinking(rawResponse);
    } catch (e: any) {
        throw new Error("Explanation failed: " + e.message);
    }
};

export const testAIConnection = async (settings: AISettings) => {
    return withRetry(async () => {
        const testPrompt = "Ping. Reply with 'Pong'.";
        if (settings.provider === 'openai') {
            await callOpenAICompatible(settings, testPrompt);
        } else {
            await callGoogleGenAI(settings, testPrompt);
        }
        return true;
    });
};

const stripJsonComments = (jsonString: string) => {
  return jsonString.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
};

const extractJson = (text: string): any => {
    let cleanText = text;
    cleanText = cleanText.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');

    if (cleanText.includes('```')) {
        cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '');
    }

    cleanText = stripJsonComments(cleanText);

    // Remove trailing commas (e.g. { "a": 1, } -> { "a": 1 })
    cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1');

    const jsonMatch = cleanText.match(/\{[\s\S]*"riskScore"[\s\S]*\}/);
    if (jsonMatch) {
        cleanText = jsonMatch[0];
    } else {
        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleanText = cleanText.substring(firstBrace, lastBrace + 1);
        }
    }

    return JSON.parse(cleanText);
};

export const analyzeStrategy = async (code: string, signal?: AbortSignal): Promise<StrategyAnalysis> => {
      // Early return for empty or invalid code
      if (!code || code.trim().length === 0) {
        return { riskScore: 0, profitability: 0, description: "No code provided for analysis." };
      }
      
      const settings = settingsManager.getSettings();
      const activeKey = getActiveKey(settings.apiKey);
      
      // Create a more efficient cache key using a proper hash function
      const codeHash = createHash(code.substring(0, 5000));
      const cacheKey = `${codeHash}-${settings.provider}-${settings.modelName}`;
      
       // Check primary cache first
       const cached = analysisCache.get(cacheKey);
       if (cached) {
           return cached;
       }
       
       // Check enhanced cache as fallback
       const enhancedCached = enhancedAnalysisCache.get(cacheKey);
       if (enhancedCached) {
           return enhancedCached;
       }
 
       // Use request deduplication to prevent duplicate API calls
       return requestDeduplicator.deduplicate(cacheKey, async () => {
         if (!activeKey && settings.provider === 'google') return { riskScore: 0, profitability: 0, description: "API Key Missing" };
 
         // Limit code length to prevent token budget issues
         const maxCodeLength = 30000; // Reduced from 50000 to be more conservative
         const truncatedCode = code.length > maxCodeLength ? code.substring(0, maxCodeLength) + "..." : code;
         
         const prompt = `Analyze this MQL5 code and return a JSON summary of its potential risk and strategy type. Code: ${truncatedCode}
         
         Return strict JSON with this schema:
         {
             "riskScore": number (1-10),
             "profitability": number (1-10),
             "description": string
         }
         
         IMPORTANT: Do not include comments in the JSON output.
         `;

         try {
             let textResponse = "";

             await withRetry(async () => {
                 if (settings.provider === 'openai') {
                     // Pass jsonMode: true for OpenAI/DeepSeek
                     textResponse = await callOpenAICompatible(settings, prompt, signal, 0.5, true);
 } else {
                      const GoogleGenAIClass = await getGoogleGenAI();
                      if (!GoogleGenAIClass) throw new Error('Failed to load Google GenAI');
                      const ai = new GoogleGenAIClass({ apiKey: activeKey });
                     
                     if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

const response = await ai!.models.generateContent({
                          model: settings.modelName || 'gemini-2.5-flash', 
                          contents: prompt,
                          config: {
                              responseMimeType: "application/json",
                              responseSchema: {
                                  type: Type!.OBJECT,
                                  properties: {
                                      riskScore: { type: Type!.NUMBER, description: "1-10 risk rating" },
                                      profitability: { type: Type!.NUMBER, description: "1-10 potential profit rating" },
                                      description: { type: Type!.STRING, description: "Short summary of strategy logic" }
                                  }
                              }
                          }
                      });
                     textResponse = response.text || "{}";
                 }
             });

             const result = extractJson(textResponse);
             
             // Validate the result before caching
             if (result && typeof result === 'object' && 
                 typeof result.riskScore === 'number' && 
                 typeof result.profitability === 'number' && 
                 typeof result.description === 'string') {
                  // Ensure values are within expected ranges
                  result.riskScore = Math.min(10, Math.max(1, Number(result.riskScore) || 0));
                  result.profitability = Math.min(10, Math.max(1, Number(result.profitability) || 0));
                  
                  // Cache the result in both caches
                  analysisCache.set(cacheKey, result);
                  enhancedAnalysisCache.set(cacheKey, result, 600000); // 10 minutes TTL for enhanced cache
                  
                  // Also cache by shorter code snippet for similar code detection
                  const shortCodeHash = createHash(code.substring(0, 1000));
                  const shortCacheKey = `short-${shortCodeHash}-${settings.provider}`;
                  analysisCache.set(shortCacheKey, result);
                  enhancedAnalysisCache.set(shortCacheKey, result, 600000);
             } else {
                 // Return a default response if parsing fails
                 return { riskScore: 0, profitability: 0, description: "Analysis Failed: Could not parse AI response." };
             }
             
             return result;

         } catch (e: any) {
             if (e.name === 'AbortError') throw e;
             handleError(e, 'analyzeStrategy', 'gemini');
             return { riskScore: 0, profitability: 0, description: "Analysis Failed: Could not parse AI response." };
         }
       });
}

// Helper function for creating hash-like keys for caching
function createHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}
