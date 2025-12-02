
import { GoogleGenAI, Type } from "@google/genai";
import { MQL5_SYSTEM_PROMPT } from "../constants";
import { StrategyParams, StrategyAnalysis, Message, MessageRole, AISettings } from "../types";
import { settingsManager } from "./settingsManager";
import { getActiveKey } from "../utils/apiKeyUtils";
import { handleError } from "../utils/errorHandler";

// Advanced cache for strategy analysis to avoid repeated API calls
// Uses LRU eviction to prevent memory bloat
class LRUCache<T> {
  private cache = new Map<string, { result: T, timestamp: number }>();
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(ttl: number = 5 * 60 * 1000, maxSize: number = 100) { // 5 min TTL, max 100 items
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.result;
  }

  set(key: string, value: T): void {
    // Evict oldest if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { result: value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

const analysisCache = new LRUCache<StrategyAnalysis>();

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
            console.warn(`API Error (${error.status || 'Network'}). Retrying in ${delay}ms... (${retries} left)`);
            // Add jitter to prevent thundering herd
            const jitter = Math.random() * 0.1 * delay;
            const nextDelay = Math.min(delay * 1.5 + jitter, maxDelay); // Use 1.5 multiplier instead of 2 for gentler backoff
            await new Promise(resolve => setTimeout(resolve, nextDelay));
            return withRetry(fn, retries - 1, nextDelay, maxDelay);
        }
        
        throw error;
    }
}

// Enhanced token budgeting with incremental history management
  class TokenBudgetManager {
      private static readonly MAX_CONTEXT_CHARS = 150000; // Increased to handle more complex requests
      private static readonly TOKEN_RATIO = 4; // 1 token ~= 4 characters
      private static readonly MIN_HISTORY_CHARS = 1000; // Keep minimum history for context
    
    // Cache for frequently used context parts
    private contextCache = new Map<string, { content: string, length: number, timestamp: number }>();
    private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    
    private getCachedContext(key: string, builder: () => string): string {
        const cached = this.contextCache.get(key);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < TokenBudgetManager.CACHE_TTL) {
            return cached.content;
        }
        
        const content = builder();
        this.contextCache.set(key, { content, length: content.length, timestamp: now });
        
        // Cleanup old cache entries
        if (this.contextCache.size > 50) {
            const oldestKey = this.contextCache.keys().next().value;
            this.contextCache.delete(oldestKey);
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
        const messageData = effectiveHistory.map((msg, index) => ({
            msg,
            index,
            content: `${msg.role === MessageRole.USER ? 'User' : 'Model'}: ${msg.content}`,
            length: 0,
            importance: 0
        }));
        
        // Calculate lengths and importance scores
        messageData.forEach(data => {
            data.length = data.content.length;
            // More recent messages are more important
            data.importance = (data.index / effectiveHistory.length) * 10;
            // User messages are slightly more important
            if (data.msg.role === MessageRole.USER) {
                data.importance += 1;
            }
            // Longer messages might contain more context
            if (data.length > 500) {
                data.importance += 0.5;
            }
        });
        
        // Sort by importance (descending) then by recency
        messageData.sort((a, b) => {
            if (Math.abs(a.importance - b.importance) > 0.1) {
                return b.importance - a.importance;
            }
            return b.index - a.index;
        });
        
        // Greedy selection based on importance and budget
        const selectedMessages = [];
        let usedBudget = 0;
        
        for (const data of messageData) {
            const requiredBudget = data.length + (selectedMessages.length > 0 ? 2 : 0); // +2 for \n\n
            
            if (usedBudget + requiredBudget <= remainingBudget) {
                selectedMessages.push(data);
                usedBudget += requiredBudget;
            } else if (selectedMessages.length === 0 && remainingBudget > TokenBudgetManager.MIN_HISTORY_CHARS) {
                // If we haven't selected anything and have reasonable budget, truncate this message
                const truncatedLength = Math.max(remainingBudget - 10, 100); // Keep at least 100 chars
                const truncatedContent = data.content.substring(0, truncatedLength) + '...';
                selectedMessages.push({
                    ...data,
                    content: truncatedContent,
                    length: truncatedContent.length
                });
                break;
            } else {
                break;
            }
        }
        
        // Sort back to chronological order
        selectedMessages.sort((a, b) => a.index - b.index);
        
        return selectedMessages.map(data => data.content).join('\n\n');
    }
    
    buildContext(prompt: string, currentCode?: string, strategyParams?: StrategyParams, history: Message[] = []): string {
        const footerReminder = `
FINAL REMINDERS:
1. Output COMPLETE code. No placeholders like "// ... rest of code".
2. Ensure strict MQL5 syntax correctness.
3. If changing logic, rewrite the full file.
`;

        // Build base components
        const paramsContext = this.buildParamsContext(strategyParams);
        let codeContext = this.buildCodeContext(currentCode);
        
        const baseLength = paramsContext.length + codeContext.length + prompt.length + footerReminder.length;
        
        // Early truncation if base context is too large
        if (baseLength > TokenBudgetManager.MAX_CONTEXT_CHARS) {
            console.warn("Base context exceeds token budget, truncating code block");
            const availableForCode = TokenBudgetManager.MAX_CONTEXT_CHARS - paramsContext.length - prompt.length - footerReminder.length - 1000;
            codeContext = this.buildCodeContext(currentCode, Math.max(availableForCode, 1000));
        }
        
        const currentBaseLength = paramsContext.length + codeContext.length + prompt.length + footerReminder.length;
        const remainingBudget = TokenBudgetManager.MAX_CONTEXT_CHARS - currentBaseLength;
        
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
 */
const buildContextPrompt = (prompt: string, currentCode?: string, strategyParams?: StrategyParams, history: Message[] = []) => {
    return tokenBudgetManager.buildContext(prompt, currentCode, strategyParams, history);
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
const callGoogleGenAI = async (settings: AISettings, fullPrompt: string, signal?: AbortSignal, temperature?: number) => {
    return withRetry(async () => {
        const activeKey = getActiveKey(settings.apiKey);
        if (!activeKey) throw new Error("Google API Key missing in settings.");
        
        const ai = new GoogleGenAI({ apiKey: activeKey });
        const systemInstruction = getEffectiveSystemPrompt(settings);
        
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

        const response = await ai.models.generateContent({
          model: settings.modelName || 'gemini-3-pro-preview',
          contents: fullPrompt,
          config: {
            systemInstruction: systemInstruction,
            temperature: temperature
          }
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
             console.warn("API Key is empty for OpenAI Provider");
        }

        const baseUrl = settings.baseUrl ? settings.baseUrl.replace(/\/$/, '') : 'https://api.openai.com/v1';
        const url = `${baseUrl}/chat/completions`;
        const systemInstruction = getEffectiveSystemPrompt(settings);

        const body = {
            model: settings.modelName || 'gpt-4',
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: fullPrompt }
            ],
            temperature: temperature ?? 0.7,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {})
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${activeKey}`,
                ...(settings.baseUrl?.includes('openrouter') ? {
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'QuantForge AI'
                } : {})
            },
            body: JSON.stringify(body),
            signal // Pass AbortSignal to fetch
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenAI API Error (${response.status}): ${err}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    });
};

/**
 * Splits the raw response into thinking process (if any) and actual content.
 */
const extractThinking = (rawText: string): { thinking?: string, content: string } => {
    // Regex for <think> (DeepSeek/R1) or <thinking> (Claude)
    const thinkRegex = /<think(?:ing)?>(.*?)<\/think(?:ing)?>/si;
    const match = rawText.match(thinkRegex);
    
    if (match) {
        const thinking = match[1].trim();
        const content = rawText.replace(thinkRegex, '').trim();
        return { thinking, content };
    }
    
    return { content: rawText };
};

export const generateMQL5Code = async (prompt: string, currentCode?: string, strategyParams?: StrategyParams, history: Message[] = [], signal?: AbortSignal) => {
   const settings = settingsManager.getSettings();

   try {
     // Early return for empty prompts
     if (!prompt || prompt.trim().length === 0) {
       return { content: "Please provide a strategy description or request." };
     }

     const fullPrompt = buildContextPrompt(prompt, currentCode, strategyParams, history);
     let rawResponse = "";

     // Create deduplication key for this specific request with more comprehensive parameters
     const requestKey = createHash(`${prompt}-${currentCode?.substring(0, 200)}-${JSON.stringify(strategyParams)}-${history.length}-${settings.provider}-${settings.modelName}`);
     
     // Use request deduplication to prevent duplicate API calls
     rawResponse = await requestDeduplicator.deduplicate(requestKey, async () => {
       if (settings.provider === 'openai') {
           return await callOpenAICompatible(settings, fullPrompt, signal);
       } else {
           return await callGoogleGenAI(settings, fullPrompt, signal) || "";
       }
     });
     
     return extractThinking(rawResponse);

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
      
       // Check if we have a valid cached result
       const cached = analysisCache.get(cacheKey);
       if (cached) {
           return cached;
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
                     const ai = new GoogleGenAI({ apiKey: activeKey });
                     
                     if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

                     const response = await ai.models.generateContent({
                         model: settings.modelName || 'gemini-2.5-flash', 
                         contents: prompt,
                         config: {
                             responseMimeType: "application/json",
                             responseSchema: {
                                 type: Type.OBJECT,
                                 properties: {
                                     riskScore: { type: Type.NUMBER, description: "1-10 risk rating" },
                                     profitability: { type: Type.NUMBER, description: "1-10 potential profit rating" },
                                     description: { type: Type.STRING, description: "Short summary of strategy logic" }
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
                  
                  // Cache the result
                  analysisCache.set(cacheKey, result);
                  
                  // Also cache by shorter code snippet for similar code detection
                  const shortCodeHash = createHash(code.substring(0, 1000));
                  const shortCacheKey = `short-${shortCodeHash}-${settings.provider}`;
                  analysisCache.set(shortCacheKey, result);
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
