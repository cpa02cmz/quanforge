
 import { GoogleGenAI, Type } from "@google/genai";
 import { MQL5_SYSTEM_PROMPT } from "../constants";
 import { StrategyParams, StrategyAnalysis, Message, MessageRole, AISettings } from "../types";
 import { settingsManager } from "./settingsManager";
 import { getActiveKey } from "../utils/apiKeyUtils";

 // Simple cache for strategy analysis to avoid repeated API calls
 const analysisCache = new Map<string, { result: StrategyAnalysis, timestamp: number }>();
 const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

/**
 * Utility: Retry an async operation with exponential backoff.
 * Useful for handling API rate limits (429) or transient network errors.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (error.name === 'AbortError') throw error; // Do not retry if aborted by user

        if (retries === 0) throw error;
        
        const isRateLimit = error.status === 429 || (error.message && error.message.includes('429'));
        const isServerErr = error.status >= 500;

        // Only retry on Rate Limits or Server Errors
        if (isRateLimit || isServerErr || error.message?.includes('fetch failed')) {
            console.warn(`API Error (${error.status || 'Network'}). Retrying in ${delay}ms... (${retries} left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return withRetry(fn, retries - 1, delay * 2);
        }
        
        throw error;
    }
}

/**
 * Builds the full context prompt string with Token Budgeting.
 */
const buildContextPrompt = (prompt: string, currentCode?: string, strategyParams?: StrategyParams, history: Message[] = []) => {
    // 1. Build Base Context (High Priority)
    let paramsContext = "";
    if (strategyParams) {
        paramsContext = `
CONFIGURATION CONSTRAINTS (MUST IMPLEMENT THESE):
- Symbol: ${strategyParams.symbol}
- Timeframe: ${strategyParams.timeframe}
- Risk Percent: ${strategyParams.riskPercent}% per trade
- Magic Number: ${strategyParams.magicNumber}
- Stop Loss: ${strategyParams.stopLoss} Pips (IMPORTANT: You must implement logic to convert these Pips to Points in the code. Typically: StopLoss * 10 * _Point)
- Take Profit: ${strategyParams.takeProfit} Pips (IMPORTANT: You must implement logic to convert these Pips to Points in the code. Typically: TakeProfit * 10 * _Point)
- Custom Inputs:
${strategyParams.customInputs.map(i => `  - input ${i.type} ${i.name} = ${i.type === 'string' ? `"${i.value}"` : i.value};`).join('\n')}

Ensure these inputs are defined at the top of the file as 'input' variables so the user can change them in MetaTrader.
For Stop Loss and Take Profit, clearly label the input comments as 'Pips'.
`;
    }

    const currentCodeBlock = currentCode ? `\nCURRENT MQL5 CODE:\n\`\`\`cpp\n${currentCode}\n\`\`\`\n` : '// No code generated yet\n';
    
    const footerReminder = `
FINAL REMINDERS:
1. Output COMPLETE code. No placeholders like "// ... rest of code".
2. Ensure strict MQL5 syntax correctness.
3. If changing logic, rewrite the full file.
`;

    // 2. Token Budgeting for History
    // More efficient token estimation: 1 token ~= 4 characters. 
    // Safe limit for context part ~80k chars to leave room for output and system prompt.
    const MAX_CONTEXT_CHARS = 80000; 
    const baseLength = paramsContext.length + currentCodeBlock.length + prompt.length + footerReminder.length;
    
    // Early return if base context is already too large
    if (baseLength > MAX_CONTEXT_CHARS) {
        console.warn("Base context exceeds token budget, truncating code block");
        const availableForCode = MAX_CONTEXT_CHARS - paramsContext.length - prompt.length - footerReminder.length - 500; // Reserve for history header
        const truncatedCode = currentCode ? 
            `\nCURRENT MQL5 CODE (truncated):\n\`\`\`cpp\n${currentCode.substring(0, Math.max(0, availableForCode))}\n\`\`\`\n` : 
            '// No code generated yet\n';
        
        return `
${paramsContext}

${truncatedCode}

NEW USER REQUEST: 
${prompt}

Please respond based on the request. 
If code changes are needed, output the FULL updated code in a code block. 
If it's just a question, answer with text only.

${footerReminder}
`;
    }
    
    let remainingBudget = MAX_CONTEXT_CHARS - baseLength;

    // Filter out duplicate immediate prompt
    const effectiveHistory = history.filter((msg, index) => {
        const isLast = index === history.length - 1;
        const isUser = msg.role === MessageRole.USER;
        return !(isLast && isUser && msg.content === prompt);
    });

    // Efficiently add messages from newest to oldest until budget fills
    // Pre-calculate message strings to avoid repeated concatenation
    const messageStrings = effectiveHistory.map(msg => 
        `${msg.role === MessageRole.USER ? 'User' : 'Model'}: ${msg.content}`
    );
    
    let historyContent = '';
    for (let i = messageStrings.length - 1; i >= 0; i--) {
        const msgStr = messageStrings[i];
        if (msgStr.length <= remainingBudget) {
            historyContent = msgStr + (historyContent ? '\n\n' + historyContent : '');
            remainingBudget -= msgStr.length;
        } else {
            // If remaining budget is very small, don't add any more history
            break;
        }
    }

    return `
${paramsContext}

${currentCodeBlock}

CONVERSATION HISTORY:
${historyContent}

NEW USER REQUEST: 
${prompt}

Please respond based on the history and the request. 
If code changes are needed, output the FULL updated code in a code block. 
If it's just a question, answer with text only.

${footerReminder}
`;
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
    const fullPrompt = buildContextPrompt(prompt, currentCode, strategyParams, history);
    let rawResponse = "";

    if (settings.provider === 'openai') {
        rawResponse = await callOpenAICompatible(settings, fullPrompt, signal);
    } else {
        rawResponse = await callGoogleGenAI(settings, fullPrompt, signal) || "";
    }
    
    return extractThinking(rawResponse);

  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    console.error("Generation error:", error);
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
    const settings = settingsManager.getSettings();
    const activeKey = getActiveKey(settings.apiKey);
    
    // Create a cache key based on the code and settings (use hash for better uniqueness)
    const codeHash = btoa(encodeURIComponent(code.substring(0, 5000))).substring(0, 20);
    const cacheKey = `${codeHash}-${settings.provider}-${settings.modelName}`;
    
    // Check if we have a valid cached result
    const cached = analysisCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.result;
    }
    
    if (!activeKey && settings.provider === 'google') return { riskScore: 0, profitability: 0, description: "API Key Missing" };

    const prompt = `Analyze this MQL5 code and return a JSON summary of its potential risk and strategy type. Code: ${code.substring(0, 5000)}...
    
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
            // Cache the result
            analysisCache.set(cacheKey, { result, timestamp: Date.now() });
        }
        
        return result;

    } catch (e: any) {
        if (e.name === 'AbortError') throw e;
        console.error("Analysis Parsing Error:", e);
        return { riskScore: 0, profitability: 0, description: "Analysis Failed: Could not parse AI response." };
    }
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
