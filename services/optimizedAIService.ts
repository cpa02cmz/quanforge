// Dynamic import for Google GenAI to reduce initial bundle size
let GoogleGenAI: any;
import { MQL5_SYSTEM_PROMPT } from "../constants";
import { StrategyParams, StrategyAnalysis, Message, MessageRole } from "../types";
import { settingsManager } from "./settingsManager";
import { handleErrorCompat as handleError } from "../utils/errorManager";
import { robotCache } from "./optimizedCache";

const logger = console; // Simplified logger for performance

/**
 * Optimized AI Service with consolidated caching and token management
 */
class OptimizedAIService {
  private requestDeduplicator = new Map<string, Promise<any>>();
  private maxTokens = 100000; // Conservative token limit
  private contextWindow = 128000; // Gemini context window
  private samplingRate = 0.1; // Sample 10% of requests for monitoring

  /**
   * Initialize AI service with dynamic import
   */
  private async initializeAI() {
    if (!GoogleGenAI) {
      try {
        const genai = await import('@google/genai');
        GoogleGenAI = genai.GoogleGenAI;
      } catch (error) {
        logger.error('Failed to import Google GenAI:', error);
        throw new Error('AI service unavailable');
      }
    }
  }

  /**
   * Generate MQL5 code with optimized token management
   */
  async generateMQL5Code(
    prompt: string,
    currentCode: string = '',
    strategyParams: StrategyParams,
    chatHistory: Message[] = [],
    customInstructions?: string
  ): Promise<{ code: string; analysis: StrategyAnalysis; messages: Message[] }> {
    const cacheKey = this.generateCacheKey(prompt, currentCode, strategyParams, customInstructions);
    
    // Check cache first
    const cached = await robotCache.get<{ code: string; analysis: StrategyAnalysis; messages: Message[] }>(cacheKey);
    if (cached) {
      logger.debug('Cache hit for MQL5 generation');
      return cached;
    }

    // Deduplicate concurrent requests
    if (this.requestDeduplicator.has(cacheKey)) {
      logger.debug('Request deduplication - waiting for existing request');
      return this.requestDeduplicator.get(cacheKey) as Promise<{ code: string; analysis: StrategyAnalysis; messages: Message[] }>;
    }

    const requestPromise = this.performGeneration(prompt, currentCode, strategyParams, chatHistory, customInstructions);
    this.requestDeduplicator.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache the result
      await robotCache.set(cacheKey, result, { ttl: 600000 }); // 10 minutes
      return result;
    } finally {
      this.requestDeduplicator.delete(cacheKey);
    }
  }

  /**
   * Perform the actual AI generation
   */
  private async performGeneration(
    prompt: string,
    currentCode: string,
    strategyParams: StrategyParams,
    chatHistory: Message[],
    customInstructions?: string
  ): Promise<{ code: string; analysis: StrategyAnalysis; messages: Message[] }> {
    await this.initializeAI();

    const settings = settingsManager.getSettings();
    if (!settings.apiKey) {
      throw new Error('API key not configured');
    }

    const ai = new GoogleGenAI({ apiKey: settings.apiKey });

    // Optimize context to stay within token limits
    const optimizedContext = this.optimizeContext(prompt, currentCode, strategyParams, chatHistory, customInstructions);
    
    const startTime = Date.now();
    try {
      const result = await ai.models.generateContent({
        model: settings.modelName,
        contents: optimizedContext
      });
      const text = result.text;

      // Parse response
      const { code, analysis, messages } = this.parseResponse(text, chatHistory);

      // Monitor performance
      this.monitorPerformance('generateMQL5Code', Date.now() - startTime);

      return { code, analysis, messages };
    } catch (error: any) {
      this.monitorError('generateMQL5Code', error);
      throw handleError(error, 'generateMQL5Code', 'OptimizedAIService');
    }
  }

  /**
   * Optimize context to fit within token limits
   */
  private optimizeContext(
    prompt: string,
    currentCode: string,
    strategyParams: StrategyParams,
    chatHistory: Message[],
    customInstructions?: string
  ): string {
    let context = MQL5_SYSTEM_PROMPT + '\n\n';
    
    // Add custom instructions
    if (customInstructions) {
      context += `Custom Instructions: ${customInstructions}\n\n`;
    }

    // Add strategy parameters
    context += `Strategy Parameters:\n`;
    context += `- Symbol: ${strategyParams.symbol}\n`;
    context += `- Timeframe: ${strategyParams.timeframe}\n`;
    context += `- Risk: ${strategyParams.riskPercent}%\n`;
    context += `- Stop Loss: ${strategyParams.stopLoss} pips\n`;
    context += `- Take Profit: ${strategyParams.takeProfit} pips\n`;
    context += `- Magic Number: ${strategyParams.magicNumber}\n`;

    // Add custom inputs
    if (strategyParams.customInputs.length > 0) {
      context += `\nCustom Inputs:\n`;
      strategyParams.customInputs.forEach(input => {
        context += `- ${input.name} (${input.type}): ${input.value}\n`;
      });
    }

    // Add current code if available
    if (currentCode) {
      context += `\nCurrent Code:\n${currentCode}\n\n`;
    }

    // Add chat history (prioritize recent messages)
    const maxHistoryTokens = 20000; // Reserve tokens for history
    let historyTokens = 0;
    const relevantHistory: Message[] = [];

    // Start from the most recent messages and work backwards
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const message = chatHistory[i];
      const messageTokens = this.estimateTokens(message.content);
      
      if (historyTokens + messageTokens > maxHistoryTokens) {
        break;
      }
      
      relevantHistory.unshift(message);
      historyTokens += messageTokens;
    }

    // Add relevant history to context
    if (relevantHistory.length > 0) {
      context += `Chat History:\n`;
      relevantHistory.forEach(msg => {
        context += `${msg.role}: ${msg.content}\n`;
      });
    }

    // Add current prompt
    context += `\nUser Request: ${prompt}`;

    // Final token check and trim if necessary
    const totalTokens = this.estimateTokens(context);
    if (totalTokens > this.maxTokens) {
      // Trim the prompt if it's too long
      const maxPromptTokens = this.maxTokens - (totalTokens - this.estimateTokens(prompt));
      const trimmedPrompt = this.trimTextToTokens(prompt, maxPromptTokens);
      context = context.replace(prompt, trimmedPrompt);
    }

    return context;
  }

  /**
   * Parse AI response into structured data
   */
  private parseResponse(text: string, chatHistory: Message[]): { code: string; analysis: StrategyAnalysis; messages: Message[] } {
    let code = '';
    const analysis: StrategyAnalysis = {
      riskScore: 5,
      profitability: 5,
      description: 'Analysis not available'
    };

    // Extract code blocks
    const codeBlockMatch = text.match(/```(?:mql5|MQL5)?\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1].trim();
    }

    // Extract analysis (look for patterns like "Risk Score: X/10")
    const riskMatch = text.match(/risk\s+score[:\s]*(\d+(?:\.\d+)?)/i);
    const profitMatch = text.match(/profitabilit[y[:\s]*(\d+(?:\.\d+)?)/i);
    
    if (riskMatch) {
      analysis.riskScore = Math.min(10, Math.max(1, parseFloat(riskMatch[1])));
    }
    if (profitMatch) {
      analysis.profitability = Math.min(10, Math.max(1, parseFloat(profitMatch[1])));
    }

    // Extract description
    const descMatch = text.match(/(?:analysis|description)[:\s]*([^\n]+)/i);
    if (descMatch) {
      analysis.description = descMatch[1].trim();
    }

    // Create new message
    const newMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.MODEL,
      content: text,
      timestamp: Date.now()
    };

    const messages = [...chatHistory, newMessage];

    return { code, analysis, messages };
  }

  /**
   * Generate cache key for requests
   */
  private generateCacheKey(
    prompt: string,
    currentCode: string,
    strategyParams: StrategyParams,
    customInstructions?: string
  ): string {
    const keyData = {
      prompt: prompt.substring(0, 500), // Limit prompt length for key
      codeHash: this.simpleHash(currentCode),
      params: strategyParams,
      customInstructions: customInstructions || ''
    };
    return this.simpleHash(JSON.stringify(keyData));
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Trim text to fit within token limit
   */
  private trimTextToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    
    return text.substring(0, maxChars - 3) + '...';
  }

  /**
   * Monitor performance with sampling
   */
  private monitorPerformance(operation: string, duration: number): void {
    if (Math.random() <= this.samplingRate) {
      logger.debug(`AI Performance: ${operation} took ${duration}ms`);
      
      // Log slow operations
      if (duration > 5000) {
        logger.warn(`Slow AI operation: ${operation} took ${duration}ms`);
      }
    }
  }

  /**
   * Monitor errors
   */
  private monitorError(operation: string, error: any): void {
    logger.error(`AI Error in ${operation}:`, error);
    
    // Track error patterns
    if (error.status === 429) {
      logger.warn('Rate limit hit for AI service');
    } else if (error.status >= 500) {
      logger.warn('AI service server error');
    }
  }

  /**
   * Analyze strategy with caching
   */
  async analyzeStrategy(code: string, strategyParams: StrategyParams): Promise<StrategyAnalysis> {
    const cacheKey = `analysis_${this.simpleHash(code + JSON.stringify(strategyParams))}`;
    
    // Check cache
    const cached = await robotCache.get<StrategyAnalysis>(cacheKey);
    if (cached) {
      logger.debug('Cache hit for strategy analysis');
      return cached;
    }

    // Perform analysis
    const analysis = await this.performAnalysis(code, strategyParams);
    
    // Cache result
    await robotCache.set(cacheKey, analysis, { ttl: 900000 }); // 15 minutes
    
    return analysis;
  }

  /**
   * Perform strategy analysis
   */
  private async performAnalysis(code: string, strategyParams: StrategyParams): Promise<StrategyAnalysis> {
    await this.initializeAI();

    const settings = settingsManager.getSettings();
    const ai = new GoogleGenAI({ apiKey: settings.apiKey });

    const prompt = `
Analyze this MQL5 trading strategy and provide:
1. Risk Score (1-10, where 1 is lowest risk)
2. Profitability Potential (1-10, where 1 is lowest potential)
3. Brief description

Strategy Parameters:
- Symbol: ${strategyParams.symbol}
- Timeframe: ${strategyParams.timeframe}
- Risk: ${strategyParams.riskPercent}%
- Stop Loss: ${strategyParams.stopLoss} pips
- Take Profit: ${strategyParams.takeProfit} pips

Code:
${code}

Respond in this format:
Risk Score: X/10
Profitability: X/10
Description: [Brief description]
`;

    try {
      const result = await ai.models.generateContent({
        model: settings.modelName,
        contents: prompt
      });
      const text = result.text;

      return this.parseAnalysis(text);
    } catch (error: any) {
      logger.error('Strategy analysis failed:', error);
      return {
        riskScore: 5,
        profitability: 5,
        description: 'Analysis failed due to an error'
      };
    }
  }

  /**
   * Parse analysis response
   */
  private parseAnalysis(text: string): StrategyAnalysis {
    const riskMatch = text.match(/risk\s+score[:\s]*(\d+(?:\.\d+)?)/i);
    const profitMatch = text.match(/profitabilit[y[:\s]*(\d+(?:\.\d+)?)/i);
    const descMatch = text.match(/description[:\s]*([^\n]+)/i);

    return {
      riskScore: riskMatch ? Math.min(10, Math.max(1, parseFloat(riskMatch[1]))) : 5,
      profitability: profitMatch ? Math.min(10, Math.max(1, parseFloat(profitMatch[1]))) : 5,
      description: descMatch ? descMatch[1].trim() : 'Analysis not available'
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.requestDeduplicator.clear();
  }
}

// Export singleton instance
export const optimizedAIService = new OptimizedAIService();

// Legacy exports for backward compatibility
export const generateMQL5Code = optimizedAIService.generateMQL5Code.bind(optimizedAIService);
export const analyzeStrategy = optimizedAIService.analyzeStrategy.bind(optimizedAIService);

export default optimizedAIService;