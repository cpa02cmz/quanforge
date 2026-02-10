/**
 * AI Core Service - Centralized AI Generation and Management
 * 
 * Handles AI model interactions, content generation, and AI operations
 */

// Type definitions for Google GenAI
interface GoogleGenAIInstance {
  getGenerativeModel: (config: Record<string, unknown>) => {
    generateContent: (prompt: string | Array<Record<string, unknown>>, config?: Record<string, unknown>) => Promise<{
      response?: { text: () => string };
      text?: () => string;
    }>;
  };
}

interface GoogleGenAIConstructor {
  new (apiKey: string): GoogleGenAIInstance;
}

interface GenAIType {
  OBJECT: string;
  NUMBER: string;
  STRING: string;
}

import { IAICore, AICoreConfig } from '../../types/serviceInterfaces';
import { settingsManager } from '../settingsManager';
import { handleError } from '../../utils/errorHandler';
import { createScopedLogger } from '../../utils/logger';
import { AI_CONFIG } from '../../constants/config';

const logger = createScopedLogger('AI_CORE');

export class AICore implements IAICore {
  private config!: AICoreConfig;
  private GoogleGenAI: GoogleGenAIConstructor | Record<string, unknown> | null = null;
  private Type: GenAIType | null = null; // Keep for future use with token types
  private isInitialized = false;

  async initialize(): Promise<void> {
    const settings = settingsManager.getSettings();
    
    this.config = {
      provider: settings?.provider || 'google',
      model: settings?.modelName || 'gemini-3-pro-preview',
      apiKey: settings?.apiKey || '',
      maxTokens: AI_CONFIG.TOKEN_LIMITS.GOOGLE,
      temperature: 0.7,
      systemPrompt: '', // Will be set per operation
    };

    // Load Google GenAI dynamically
    await this.loadGoogleGenAI();
    this.isInitialized = true;
    
    logger.info('AI Core service initialized');
  }

  async destroy(): Promise<void> {
    this.isInitialized = false;
    this.GoogleGenAI = null;
    this.Type = null;
    logger.info('AI Core service destroyed');
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.config.apiKey) {
        return false;
      }

      // Test with a simple generation
      const result = await this.generateContent('Test', { maxTokens: 10 });
      return result.length > 0;
    } catch (error) {
      logger.error('AI Core health check failed:', error);
      return false;
    }
  }

  updateConfig(config: Partial<AICoreConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update system prompt if provided
    if (config.systemPrompt !== undefined) {
      this.config.systemPrompt = config.systemPrompt;
    }
  }

  getConfig(): AICoreConfig {
    return { ...this.config };
  }

  async generateContent(prompt: string, options?: Record<string, unknown>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('AI Core not initialized');
    }

    const startTime = Date.now();
    
    try {
      if (this.config.provider === 'google' && this.GoogleGenAI) {
        const result = await this.generateWithGoogle(prompt, options);
        
        const duration = Date.now() - startTime;
        logger.info(`Content generation completed in ${duration}ms`);
        
        return result;
      } else {
        throw new Error(`Unsupported provider: ${this.config.provider}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Content generation failed after ${duration}ms:`, error);
      throw handleError(error as Error, 'AIContentGeneration', 'AICore');
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.config.apiKey) {
        return { success: false, message: 'No API key configured' };
      }

      const testPrompt = 'Hello';
      const result = await this.generateContent(testPrompt, { maxTokens: 5 });
      
      if (result && result.length > 0) {
        return { 
          success: true, 
          message: `Connection successful. Model: ${this.config.model}` 
        };
      } else {
        return { success: false, message: 'No response from model' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        success: false, 
        message: `Connection failed: ${errorMessage}` 
      };
    }
  }

  estimateTokens(text: string): number {
    // Simple token estimation (rough approximation)
    // For better accuracy, you would use the actual tokenizer
    const words = text.split(/\s+/).length;
    const chars = text.length;
    
    // Average tokens per word and character ratio
    return Math.ceil(words * 1.3 + chars * 0.5);
  }

  // Private helper methods

  private async loadGoogleGenAI(): Promise<void> {
    try {
      // Note: In production environment, this would dynamically load the actual AI library
      // For now, we'll create a mock implementation to demonstrate the architecture
      
      logger.warn('Google GenAI library not available in build environment - using mock implementation');
      
      // Mock implementation for demonstration
      this.GoogleGenAI = {
        constructor: function(apiKey: string) {
          this.apiKey = apiKey;
        },
        getGenerativeModel: function(_config: Record<string, unknown>) {
          return {
            generateContent: async (_prompt: string, _config2: Record<string, unknown>) => {
              // Mock response
              return {
                response: {
                  text: () => 'Mock AI response for demonstration purposes'
                },
                text: () => 'Mock AI response for demonstration purposes'
              };
            }
          };
        }
      };
      
      logger.info('Mock Google GenAI loaded successfully');
    } catch (error) {
      logger.error('Failed to load Google GenAI mock:', error);
      throw new Error('Failed to initialize AI service');
    }
  }

  private   async generateWithGoogle(prompt: string, options?: Record<string, unknown>): Promise<string> {
    if (!this.GoogleGenAI || !this.config.apiKey) {
      throw new Error('Google GenAI not properly initialized');
    }

    // Initialize the model
    const genAI = new (this.GoogleGenAI as GoogleGenAIConstructor)(this.config.apiKey);
    const model = genAI.getGenerativeModel({ model: this.config.model });

    // Prepare the full prompt
    const fullPrompt = this.config.systemPrompt 
      ? `${this.config.systemPrompt}\n\n${prompt}`
      : prompt;

    // Configure generation options
    const generationConfig = {
      temperature: this.config.temperature,
      maxOutputTokens: options?.maxTokens || this.config.maxTokens,
      topP: options?.topP || 0.8,
      topK: options?.topK || 40,
    };

    // Generate content
    const result = await model.generateContent(fullPrompt, generationConfig);
    
    if (result.response && result.response.text) {
      return result.response.text();
    } else if (result.text) {
      return result.text();
    } else {
      throw new Error('No response text in result');
    }
  }

  // Advanced AI operations

  async generateWithHistory(
    prompt: string, 
    history: Array<{ role: string; content: string }>,
    options?: Record<string, unknown>
  ): Promise<string> {
    if (!this.GoogleGenAI || !this.config.apiKey) {
      throw new Error('Google GenAI not properly initialized');
    }

    try {
      const genAI = new (this.GoogleGenAI as GoogleGenAIConstructor)(this.config.apiKey);
      const model = genAI.getGenerativeModel({ model: this.config.model });

      // Build conversation history
      const conversation = [
        ...history.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })),
        { role: 'user', parts: [{ text: prompt }] }
      ];

      const generationConfig = {
        temperature: this.config.temperature,
        maxOutputTokens: options?.maxTokens || this.config.maxTokens,
        topP: options?.topP || 0.8,
        topK: options?.topK || 40,
      };

      const result = await model.generateContent(conversation, generationConfig);
      
      if (result.response && result.response.text) {
        return result.response.text();
      } else if (result.text) {
        return result.text();
      } else {
        throw new Error('No response text in conversation result');
      }
    } catch (error) {
      logger.error('Generation with history failed:', error);
      throw handleError(error as Error, 'AIHistoryGeneration', 'AICore');
    }
  }

  async validateOutput(output: string, criteria?: string[]): Promise<{ 
    isValid: boolean; 
    issues: string[]; 
  }> {
    const issues: string[] = [];

    if (!output || output.trim().length === 0) {
      issues.push('Output is empty');
    }

    // Check for common issues
    if (output.includes('<script>')) {
      issues.push('Output contains potentially unsafe scripts');
    }

    if (output.includes('javascript:')) {
      issues.push('Output contains potentially unsafe javascript: URLs');
    }

    // Custom criteria validation
    if (criteria) {
      for (const criterion of criteria) {
        if (criterion === 'code' && !output.includes('function') && !output.includes('class')) {
          issues.push('Output does not contain code structure');
        }
        
        if (criterion === 'mql5' && !output.includes('void OnTick()') && !output.includes('int OnInit()')) {
          issues.push('Output does not appear to be MQL5 code');
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  getModelInfo() {
    return {
      provider: this.config.provider,
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      isInitialized: this.isInitialized,
      hasApiKey: !!this.config.apiKey,
    };
  }

  async getModelCapabilities(): Promise<{
    supported: string[];
    limitations: string[];
  }> {
    // Return model-specific capabilities
    return {
      supported: [
        'text-generation',
        'conversation',
        'code-generation',
        'analysis',
      ],
      limitations: [
        'max-tokens: ' + this.config.maxTokens,
        'no-image-input',
        'no-audio-input',
      ],
    };
  }
}