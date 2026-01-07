// Web Worker for Gemini AI service to offload heavy processing from main thread

// Define constants inline to avoid import issues in worker context
const MQL5_SYSTEM_PROMPT = `
You are an expert MQL5 (MetaTrader 5) programmer and quantitative trading strategist.
Your task is to generate complete, functional MQL5 trading robot code based on user requirements.
`;

// Define types inline to avoid import issues in worker context
interface StrategyParams {
  symbol: string;
  timeframe: string;
  riskPercent: number;
  stopLoss: number;
  takeProfit: number;
  magicNumber: number;
  customInputs: Array<{
    type: 'string' | 'number' | 'boolean';
    name: string;
    value: string | number | boolean;
  }>;
}

interface StrategyAnalysis {
  riskScore: number;
  profitability: number;
  description: string;
}

interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  thinking?: string | null;
}

// Worker message types
interface WorkerMessage {
  type: 'GENERATE_CONTENT' | 'BUILD_CONTEXT' | 'PARSE_RESPONSE';
  payload: any;
  id: string;
}

interface WorkerResponse {
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  payload: any;
  id: string;
}

// Cache implementation for worker
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class WorkerCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number = 50;
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: T, ttl: number = 300000): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

const responseCache = new WorkerCache<string>();
const contextCache = new WorkerCache<string>();

// Utility functions
const sanitizePrompt = (prompt: string): string => {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt: must be a non-empty string');
  }
  
  return prompt
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

const generateContextHash = (prompt: string, code: string, params: StrategyParams): string => {
  const contextString = `${prompt}-${code}-${JSON.stringify(params)}`;
  let hash = 0;
  for (let i = 0; i < contextString.length; i++) {
    const char = contextString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
};

const buildOptimizedContext = (
  prompt: string,
  currentCode: string,
  strategyParams: StrategyParams,
  chatHistory: Message[],
  customInstructions?: string
): string => {
  const contextHash = generateContextHash(prompt, currentCode, strategyParams);
  
  // Check cache first
  const cachedContext = contextCache.get(contextHash);
  if (cachedContext) {
    return cachedContext;
  }
  
  // Token budget management
  const MAX_TOKENS = 8000;
  const SYSTEM_TOKENS = MQL5_SYSTEM_PROMPT.length;
  const RESERVED_TOKENS = 1000;
  const availableTokens = MAX_TOKENS - SYSTEM_TOKENS - RESERVED_TOKENS;
  
  // Build context components
  const contextComponents: string[] = [];
  
  // Add custom instructions if provided
  if (customInstructions) {
    contextComponents.push(`Custom Instructions: ${customInstructions}`);
  }
  
  // Add strategy parameters
  contextComponents.push(`Strategy Parameters:
- Timeframe: ${strategyParams.timeframe}
- Symbol: ${strategyParams.symbol}
- Risk %: ${strategyParams.riskPercent}
- Stop Loss (Pips): ${strategyParams.stopLoss}
- Take Profit (Pips): ${strategyParams.takeProfit}
- Magic Number: ${strategyParams.magicNumber}
${strategyParams.customInputs.length > 0 ? 
  strategyParams.customInputs.map(input => 
    `- ${input.name} (${input.type}): ${input.value}`
  ).join('\n') : ''
}`);
  
  // Add current code if available
  if (currentCode.trim()) {
    contextComponents.push(`Current Code:\n${currentCode}`);
  }
  
  // Add optimized chat history
  if (chatHistory.length > 0) {
    const recentHistory = chatHistory.slice(-6); // Keep last 6 messages
    const historyText = recentHistory
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');
    contextComponents.push(`Recent Conversation:\n${historyText}`);
  }
  
  // Add user prompt
  contextComponents.push(`User Request: ${prompt}`);
  
  const fullContext = contextComponents.join('\n\n');
  
  // Cache the built context
  contextCache.set(contextHash, fullContext);
  
  return fullContext;
};

const parseGeminiResponse = (response: string): { code?: string; analysis?: StrategyAnalysis; thinking?: string } => {
  const result: { code?: string; analysis?: StrategyAnalysis; thinking?: string } = {};
  
  // Extract thinking process if present
  const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (thinkingMatch) {
    result.thinking = thinkingMatch[1].trim();
  }
  
  // Extract code block
  const codeMatch = response.match(/```mql5\n([\s\S]*?)\n```/i) || 
                   response.match(/```cpp\n([\s\S]*?)\n```/i) ||
                   response.match(/```\n([\s\S]*?)\n```/i);
  
  if (codeMatch) {
    result.code = codeMatch[1].trim();
  }
  
  // Extract analysis
  const analysisMatch = response.match(/ANALYSIS:\s*([\s\S]*?)(?=\n\n|$)/i);
  if (analysisMatch) {
    try {
      const analysisText = analysisMatch[1].trim();
      const riskMatch = analysisText.match(/risk\s*score[:\s]*(\d+)/i) || 
                       analysisText.match(/risk[:\s]*(\d+)/i);
      const profitMatch = analysisText.match(/profitability[:\s]*(\d+)/i) || 
                         analysisText.match(/profit[:\s]*(\d+)/i);
      
      result.analysis = {
        riskScore: riskMatch ? parseInt(riskMatch[1]) : 50,
        profitability: profitMatch ? parseInt(profitMatch[1]) : 50,
        description: analysisText
      };
    } catch (error) {
      console.warn('Failed to parse analysis:', error);
    }
  }
  
  return result;
};

// Main worker handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload, id } = event.data;
  
  try {
    switch (type) {
      case 'BUILD_CONTEXT':
        const { prompt, currentCode, strategyParams, chatHistory, customInstructions } = payload;
        const context = buildOptimizedContext(prompt, currentCode, strategyParams, chatHistory, customInstructions);
        
        self.postMessage({
          type: 'SUCCESS',
          payload: { context },
          id
        } as WorkerResponse);
        break;
        
      case 'PARSE_RESPONSE':
        const { response } = payload;
        const parsed = parseGeminiResponse(response);
        
        self.postMessage({
          type: 'SUCCESS',
          payload: parsed,
          id
        } as WorkerResponse);
        break;
        
      case 'GENERATE_CONTENT':
        // This would involve the actual Gemini API call
        // For now, we'll just simulate it
        const { fullPrompt } = payload;
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check cache first
        const cachedResponse = responseCache.get(fullPrompt);
        if (cachedResponse) {
          self.postMessage({
            type: 'SUCCESS',
            payload: { response: cachedResponse },
            id
          } as WorkerResponse);
          return;
        }
        
        // In a real implementation, this would call the Gemini API
        // For now, return a mock response
        const mockResponse = `Mock response for: ${fullPrompt.substring(0, 100)}...`;
        
        // Cache the response
        responseCache.set(fullPrompt, mockResponse);
        
        self.postMessage({
          type: 'SUCCESS',
          payload: { response: mockResponse },
          id
        } as WorkerResponse);
        break;
        
      default:
        throw new Error(`Unknown worker message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      id
    } as WorkerResponse);
  }
};

// Handle worker errors
self.onerror = (error) => {
  console.error('Worker error:', error);
};

export {};