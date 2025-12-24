// Core AI Generation and Model Management
import { MQL5_SYSTEM_PROMPT } from "../../constants";
import { StrategyParams, StrategyAnalysis, AISettings } from "../../types";
import { getActiveKey } from "../../utils/apiKeyUtils";
import { createScopedLogger } from "../../utils/logger";
import { AI_CONFIG } from "../../constants/config";

const logger = createScopedLogger('ai-core');

export interface AICoreConfig {
  currentCode: string | null;
  strategyParams: StrategyParams;
  settings: AISettings;
  signal?: AbortSignal;
}

export interface AIGenerationResult {
  content: string;
  cached: boolean;
  model: string;
}

export interface AIAnalysisResult extends StrategyAnalysis {
  cached: boolean;
  model: string;
}

export class AICore {
  private apiKey: string | null = null;

  constructor() {
    this.initializeApiKey();
  }

  private initializeApiKey(): void {
    this.apiKey = getActiveKey('');
    if (!this.apiKey) {
      throw new Error('No valid API key available');
    }
  }

  async generateMQL5Code(prompt: string, config: AICoreConfig): Promise<AIGenerationResult> {
    try {
      this.apiKey = getActiveKey('');
      if (!this.apiKey) {
        throw new Error('No valid API key available');
      }

      const enhancedPrompt = this.constructPrompt(prompt, config);
      const { settings } = config;

      // Dynamic import Google GenAI SDK - only import the main class
      const { GoogleGenAI } = await import("@google/genai");

      if (config.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const ai = new GoogleGenAI({ apiKey: this.apiKey });

      const response = await ai.models.generateContent({
        model: settings.modelName || AI_CONFIG.DEFAULT_MODELS.GOOGLE,
        contents: enhancedPrompt,
        config: {
          systemInstruction: MQL5_SYSTEM_PROMPT,
        }
      });

      if (config.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const textResponse = response.text || '';
      const extractedCode = this.extractMQL5Code(textResponse);

      return {
        content: extractedCode,
        cached: false,
        model: settings.modelName || AI_CONFIG.DEFAULT_MODELS.GOOGLE
      };

    } catch (error: unknown) {
      const errorObj = error as Error & { name?: string };
      if (errorObj.name === 'AbortError') throw error;
      
      logger.error('MQL5 generation failed:', errorObj);
      throw new Error(`AI generation failed: ${errorObj.message}`);
    }
  }

  async analyzeStrategy(code: string, settings: AISettings, signal?: AbortSignal): Promise<AIAnalysisResult> {
    try {
      this.apiKey = getActiveKey('');
      if (!this.apiKey) {
        throw new Error('No valid API key available');
      }

      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      // Dynamic import Google GenAI SDK - only import what's needed
      const { GoogleGenAI, Type } = await import("@google/genai");

      const ai = new GoogleGenAI({ apiKey: this.apiKey });
      const prompt = this.constructAnalysisPrompt(code);

      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const response = await ai.models.generateContent({
        model: settings.modelName || AI_CONFIG.DEFAULT_MODELS.GOOGLE,
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

      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const textResponse = response.text || "{}";
      const result = this.extractJson(textResponse);
      const validatedResult = this.validateAnalysisResult(result);
      
      return {
        ...validatedResult,
        cached: false,
        model: settings.modelName || AI_CONFIG.DEFAULT_MODELS.GOOGLE
      };

    } catch (error: unknown) {
      const errorObj = error as Error & { name?: string };
      if (errorObj.name === 'AbortError') throw error;
      
      logger.error('Strategy analysis failed:', errorObj);
      return {
        riskScore: 0,
        profitability: 0,
        description: `Analysis failed: ${errorObj.message}`,
        cached: false,
        model: settings.modelName || AI_CONFIG.DEFAULT_MODELS.GOOGLE
      };
    }
  }

  private constructPrompt(userPrompt: string, config: AICoreConfig): string {
    const { strategyParams } = config;
    
    let prompt = "You are an expert MQL5 programmer. ";
    
    if (config.currentCode) {
      prompt += `Current code:\n\n${config.currentCode}\n\n`;
    }
    
    prompt += `User wants: ${userPrompt}\n\n`;
    prompt += `Strategy Configuration:\n`;
    prompt += `- Symbol: ${strategyParams.symbol || 'EURUSD'}\n`;
    prompt += `- Timeframe: ${strategyParams.timeframe || 'H1'}\n`;
    prompt += `- Risk: ${strategyParams.riskPercent || 2}%\n`;
    prompt += `- Stop Loss: ${strategyParams.stopLoss || 50} pips\n`;
    prompt += `- Take Profit: ${strategyParams.takeProfit || 100} pips\n`;
    
    if (strategyParams.customInputs && strategyParams.customInputs.length > 0) {
      prompt += `- Custom Inputs: ${JSON.stringify(strategyParams.customInputs, null, 2)}\n`;
    }
    
    prompt += "\nGenerate complete MQL5 expert advisor code with proper structure, error handling, and comment documentation.";
    
    return prompt;
  }

  private constructAnalysisPrompt(code: string): string {
    return `
      Analyze this MQL5 trading strategy code and provide a risk/profitability assessment:
      
      ${code}
      
      Provide analysis as JSON with:
      - riskScore: 1-10 (higher = riskier)
      - profitability: 1-10 (higher = more profitable potential)
      - description: Brief analysis summary
    `;
  }

  private extractMQL5Code(response: string): string {
    // Extract code from markdown code blocks
    const codeMatch = response.match(/```mql5\n([\s\S]*?)\n```/i) ||
                      response.match(/```cpp\n([\s\S]*?)\n```/i) ||
                      response.match(/```\n([\s\S]*?)\n```/);
    
    if (codeMatch) {
      return codeMatch[1];
    }
    
    // If no code blocks found, return the response as-is
    return response;
  }

  private extractJson(text: string): any {
    try {
      // Try to extract JSON from the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback: try to parse entire text as JSON
      return JSON.parse(text);
    } catch (error) {
      logger.warn('Failed to extract JSON from response:', text.substring(0, 200));
      return null;
    }
  }

  private validateAnalysisResult(result: any): StrategyAnalysis {
    if (result && typeof result === 'object' && 
        typeof result.riskScore === 'number' && 
        typeof result.profitability === 'number' && 
        typeof result.description === 'string') {
      
      // Ensure values are within expected ranges
      result.riskScore = Math.min(10, Math.max(1, Number(result.riskScore) || 0));
      result.profitability = Math.min(10, Math.max(1, Number(result.profitability) || 0));
      
      return result;
    }
    
    // Return a default response if parsing fails
    return {
      riskScore: 0,
      profitability: 0,
      description: "Analysis Failed: Could not parse AI response."
    };
  }

  // Update API key when settings change
  updateApiKey(): void {
    this.apiKey = getActiveKey('');
  }

  // Check if AI service is ready
  isReady(): boolean {
    return !!this.apiKey;
  }

  // Get active model name
  getActiveModel(settings: AISettings): string {
    return settings.modelName || AI_CONFIG.DEFAULT_MODELS.GOOGLE;
  }
}

// Export singleton instance
export const aiCore = new AICore();