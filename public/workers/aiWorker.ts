// Web Worker for AI Processing Optimization
// Offloads intensive AI context building and processing from main thread

// Import necessary types and utilities
type Message = {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  thinking?: string | null;
};

type StrategyParams = {
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
};

type WorkerMessage = {
  type: 'BUILD_CONTEXT' | 'PROCESS_RESPONSE' | 'EXTRACT_CODE' | 'FORMAT_MESSAGE';
  id: string;
  data: any;
};

type WorkerResponse = {
  type: 'CONTEXT_BUILT' | 'RESPONSE_PROCESSED' | 'CODE_EXTRACTED' | 'MESSAGE_FORMATTED' | 'ERROR';
  id: string;
  data?: any;
  error?: string;
};

// Enhanced cache with TTL for context building
class ContextCache {
  private cache = new Map<string, { content: string; timestamp: number; ttl: number }>();
  private readonly maxSize = 100;
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.content;
  }

  set(key: string, content: string, ttl: number = this.defaultTTL): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      content,
      timestamp: Date.now(),
      ttl
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const contextCache = new ContextCache();

// Token budget manager optimized for worker
class TokenBudgetManager {
  private static readonly MAX_CONTEXT_CHARS = 100000;
  private static readonly MIN_HISTORY_CHARS = 1000;

  buildParamsContext(strategyParams?: StrategyParams): string {
    if (!strategyParams) return '';

    const cacheKey = `params-${strategyParams.symbol}-${strategyParams.timeframe}-${strategyParams.riskPercent}`;
    const cached = contextCache.get(cacheKey);
    if (cached) return cached;

    const customInputsStr = strategyParams.customInputs.length > 0
      ? strategyParams.customInputs.map(i => `  - input ${i.type} ${i.name} = ${i.type === 'string' ? `"${i.value}"` : i.value};`).join('\n')
      : '// No custom inputs defined';

    const content = `
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

    contextCache.set(cacheKey, content);
    return content;
  }

  buildCodeContext(currentCode?: string, maxLength?: number): string {
    if (!currentCode) return '// No code generated yet\n';

    const cacheKey = `code-${currentCode.substring(0, 100)}-${maxLength || 'full'}`;
    const cached = contextCache.get(cacheKey);
    if (cached) return cached;

    let content: string;
    if (maxLength && currentCode.length > maxLength) {
      content = `\nCURRENT MQL5 CODE (truncated to ${maxLength} chars):\n\`\`\`cpp\n${currentCode.substring(0, maxLength)}\n\`\`\`\n`;
    } else {
      content = `\nCURRENT MQL5 CODE:\n\`\`\`cpp\n${currentCode}\n\`\`\`\n`;
    }

    contextCache.set(cacheKey, content);
    return content;
  }

  buildHistoryContext(history: Message[], currentPrompt: string, remainingBudget: number): string {
    const effectiveHistory = history.filter((msg, index) => {
      const isLast = index === history.length - 1;
      const isUser = msg.role === 'user';
      return !(isLast && isUser && msg.content === currentPrompt);
    });

    if (effectiveHistory.length === 0) return '';

    const messageData: Array<{
      msg: Message;
      index: number;
      content: string;
      length: number;
      importance: number;
    }> = effectiveHistory.map((msg, index) => {
      const content = `${msg.role === 'user' ? 'User' : 'Model'}: ${msg.content}`;
      return {
        msg,
        index,
        content,
        length: content.length,
        importance: 0
      };
    });

    // Calculate importance scores
    messageData.forEach(data => {
      const recencyFactor = (data.index + 1) / effectiveHistory.length;
      data.importance = recencyFactor * 10;

      if (data.msg.role === 'user') {
        data.importance += 2;
      }

      if (data.content.includes('```') || data.content.includes('function') ||
          data.content.includes('if ') || data.content.includes('for ')) {
        data.importance += 1;
      }

      if (data.length < 300) {
        data.importance += 0.5;
      }
    });

    // Sort by importance then by recency
    messageData.sort((a, b) => {
      if (Math.abs(a.importance - b.importance) > 0.01) {
        return b.importance - a.importance;
      }
      return b.index - a.index;
    });

    const selectedMessages: typeof messageData = [];
    let usedBudget = 0;
    const separatorLength = 2;

    for (const data of messageData) {
      const requiredBudget = data.length + (selectedMessages.length > 0 ? separatorLength : 0);

      if (usedBudget + requiredBudget <= remainingBudget) {
        selectedMessages.push(data);
        usedBudget += requiredBudget;
      } else {
        break;
      }
    }

    // Sort back to chronological order
    selectedMessages.sort((a, b) => a.index - b.index);

    return selectedMessages.map(data => data.content).join('\n\n');
  }

  buildContext(prompt: string, currentCode?: string, strategyParams?: StrategyParams, history: Message[] = []): string {
    const contextCacheKey = this.createContextCacheKey(prompt, currentCode, strategyParams, history);
    const cached = contextCache.get(contextCacheKey);
    if (cached) return cached;

    const footerReminder = `
FINAL REMINDERS:
1. Output COMPLETE code. No placeholders like "// ... rest of code".
2. Ensure strict MQL5 syntax correctness.
3. If changing logic, rewrite the full file.
`;

    const paramsContext = this.buildParamsContext(strategyParams);
    let codeContext = this.buildCodeContext(currentCode);

    const baseLength = paramsContext.length + codeContext.length + prompt.length + footerReminder.length;

    if (baseLength > TokenBudgetManager.MAX_CONTEXT_CHARS) {
      const availableForCode = TokenBudgetManager.MAX_CONTEXT_CHARS - paramsContext.length - prompt.length - footerReminder.length - 1000;
      codeContext = this.buildCodeContext(currentCode, Math.max(availableForCode, 1000));
    }

    const currentBaseLength = paramsContext.length + codeContext.length + prompt.length + footerReminder.length;
    const remainingBudget = Math.max(TokenBudgetManager.MAX_CONTEXT_CHARS - currentBaseLength, 0);

    const historyContent = this.buildHistoryContext(history, prompt, Math.max(remainingBudget, 0));

    const content = `
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

    contextCache.set(contextCacheKey, content);
    return content;
  }

  private createContextCacheKey(prompt: string, currentCode?: string, strategyParams?: StrategyParams, history: Message[] = []): string {
    const paramsHash = strategyParams ? JSON.stringify(strategyParams) : '';
    const codeHash = currentCode ? currentCode.substring(0, 500) : '';
    const historyHash = history.map(m => `${m.role}:${m.content.substring(0, 100)}`).join('|');
    return `${prompt.length}:${codeHash}:${paramsHash}:${historyHash}`;
  }

  clearCache(): void {
    contextCache.clear();
  }
}

const tokenBudgetManager = new TokenBudgetManager();

// Utility functions
const extractCode = (rawText: string): string | null => {
  const codeBlockRegex = /```(?:cpp|c|mql5)?([\s\S]*?)```/i;
  const match = rawText.match(codeBlockRegex);
  return match?.[1]?.trim() || null;
};

const formatChatMessage = (rawText: string, hasCode: boolean): string => {
  if (hasCode) {
    return rawText.replace(/```(?:cpp|c|mql5)?([\s\S]*?)```/i, '\n*(Code updated in Editor)*\n').trim();
  }
  return rawText;
};

const extractThinking = (rawText: string): { thinking?: string; content: string } => {
  const thinkRegex = /<think(?:ing)?>(.*?)<\/think(?:ing)?>/si;
  const match = rawText.match(thinkRegex);

  if (match && match[1]) {
    const thinking = match[1].trim();
    const content = rawText.replace(thinkRegex, '').trim();
    return { thinking, content };
  }

  return { content: rawText };
};

// Create hash for cache keys
function createHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Main message handler
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { type, id, data } = event.data;

  try {
    switch (type) {
      case 'BUILD_CONTEXT':
        const { prompt, currentCode, strategyParams, history } = data;
        const context = tokenBudgetManager.buildContext(prompt, currentCode, strategyParams, history);
        
        self.postMessage({
          type: 'CONTEXT_BUILT',
          id,
          data: { context }
        } as WorkerResponse);
        break;

      case 'PROCESS_RESPONSE':
        const { rawResponse } = data;
        const processed = extractThinking(rawResponse);
        
        self.postMessage({
          type: 'RESPONSE_PROCESSED',
          id,
          data: processed
        } as WorkerResponse);
        break;

      case 'EXTRACT_CODE':
        const { text } = data;
        const code = extractCode(text);
        
        self.postMessage({
          type: 'CODE_EXTRACTED',
          id,
          data: { code }
        } as WorkerResponse);
        break;

      case 'FORMAT_MESSAGE':
        const { rawText: messageText, hasCode } = data;
        const formatted = formatChatMessage(messageText, hasCode);
        
        self.postMessage({
          type: 'MESSAGE_FORMATTED',
          id,
          data: { formatted }
        } as WorkerResponse);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error: unknown) {
    self.postMessage({
      type: 'ERROR',
      id,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    } as WorkerResponse);
  }
});

// Handle worker cleanup
self.addEventListener('close', () => {
  contextCache.clear();
});

export {};