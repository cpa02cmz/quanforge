/**
 * Gemini AI Service - Backward Compatibility Wrapper
 * 
 * Provides the same interface as the original monolithic gemini.ts
 * but delegates to the new modular AI service architecture
 * 
 * This ensures zero breaking changes during the migration
 */

import { globalOrchestrator } from './core/ServiceOrchestrator';
import { StrategyParams, StrategyAnalysis, Message, AISettings } from '../types';
import { apiDeduplicator } from './apiDeduplicator';
import { aiResponseCache } from './aiResponseCache';
import { handleError } from '../utils/errorHandler';
import { AI_CONFIG } from '../constants/config';
import { createScopedLogger } from '../utils/logger';

// Import the modular AI services interfaces
import type { IAICore, IWorkerManager, IRateLimiter } from '../types/serviceInterfaces';

const logger = createScopedLogger('gemini-legacy');

// Keep singleton instances
let aiCore: IAICore | null = null;
let workerManager: IWorkerManager | null = null;
let rateLimiter: IRateLimiter | null = null;

const getAICore = async (): Promise<IAICore> => {
    if (!globalOrchestrator.isReady()) {
        await globalOrchestrator.initialize();
    }
    
    if (!aiCore) {
        aiCore = await globalOrchestrator.getAICore();
    }
    
    return aiCore;
};

const getWorkerManager = async (): Promise<IWorkerManager> => {
    if (!globalOrchestrator.isReady()) {
        await globalOrchestrator.initialize();
    }
    
    if (!workerManager) {
        workerManager = await globalOrchestrator.getWorkerManager();
    }
    
    return workerManager;
};

const getRateLimiter = async (): Promise<IRateLimiter> => {
    if (!globalOrchestrator.isReady()) {
        await globalOrchestrator.initialize();
    }
    
    if (!rateLimiter) {
        rateLimiter = await globalOrchestrator.getRateLimiter();
    }
    
    return rateLimiter;
};

// Simple utility functions for backward compatibility
const sanitizePrompt = (prompt: string): string => {
    return prompt.trim().replace(/[<>]/g, '');
};

const validateStrategyParams = (params: any): any => {
    return params; // Basic validation - could be expanded
};

const createSemanticCacheKey = (...args: any[]): string => {
    return args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join('|');
};

const createHash = (str: string): string => {
    return btoa(str).substring(0, 16);
};

/**
 * Validate strategy parameters - exported function
 */
export const isValidStrategyParams = (params: any): boolean => {
    try {
        if (!params || typeof params !== 'object') return false;
        
        const required = ['timeframe', 'risk', 'stopLoss', 'takeProfit'];
        return required.every(field => 
            params[field] !== undefined && 
            params[field] !== null && 
            !isNaN(Number(params[field]))
        );
    } catch (error) {
        logger.error('Strategy params validation failed:', error);
        return false;
    }
};

/**
 * Extract thinking blocks from AI response
 */
const extractThinking = (response: string): { thinking?: string; content: string } => {
    try {
        // Look for <thinking> blocks
        const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/i);
        
        if (thinkingMatch) {
            const thinking = thinkingMatch[1].trim();
            const content = response.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
            
            return {
                thinking: thinking.length > 0 ? thinking : undefined,
                content: content || response
            };
        }
        
        return { content: response };
    } catch (error) {
        logger.warn('Failed to extract thinking blocks:', error);
        return { content: response };
    }
};

/**
 * Generate MQL5 code - main AI generation function
 */
export const generateMQL5Code = async (
    prompt: string, 
    currentCode?: string, 
    strategyParams?: StrategyParams, 
    history: Message[] = [], 
    signal?: AbortSignal
) => {
    const startTime = performance.now();
    
    try {
        // Get AI core service
        const ai = await getAICore();
        const worker = await getWorkerManager();
        const limiter = await getRateLimiter();
        
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
        const semanticKey = createSemanticCacheKey(sanitizedPrompt, currentCode, validatedParams);
        
        // Check semantic cache first
        const cachedResponse = aiResponseCache.get(semanticKey);
        if (cachedResponse) {
            logger.debug('Semantic cache hit for MQL5 generation');
            return cachedResponse;
        }

        // Create deduplication key for this specific request
        const requestKey = createHash(`${prompt}-${currentCode?.substring(0, 200)}-${JSON.stringify(strategyParams)}-${history.length}`);
        
        // Use request deduplication to prevent duplicate API calls
        let rawResponse = await apiDeduplicator.deduplicate(requestKey, async () => {
            // Build context prompt using AI core
            const fullPrompt = await ai.generateContent(sanitizedPrompt);
            return fullPrompt;
        });
        
        // Use Web Worker for response processing if available
        let response: { thinking?: string; content: string };
        try {
            // Check if worker manager is available and healthy
            if (workerManager && await workerManager.isHealthy()) {
                response = await workerManager.executeTask({ 
                    id: 'process_response_' + Date.now(),
                    type: 'process_response', 
                    data: rawResponse,
                    priority: 1,
                    timeout: 30000,
                    createdAt: Date.now()
                });
            } else {
                response = extractThinking(rawResponse);
            }
        } catch (error) {
            logger.warn('Web Worker response processing failed, using fallback:', error);
            response = extractThinking(rawResponse);
        }
        
        // Cache the response with semantic key
        aiResponseCache.set(semanticKey, response, '900000'); // 15 minutes TTL as string
        
        const duration = performance.now() - startTime;
        logger.info(`MQL5 generation completed in ${duration.toFixed(2)}ms`);
        
        return response;

    } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        
        const duration = performance.now() - startTime;
        logger.error(`MQL5 generation failed after ${duration.toFixed(2)}ms:`, error);
        
        handleError(error, 'generateMQL5Code', 'gemini-legacy');
        return { content: `Error generating response: ${error.message || error}` };
    }
};

/**
 * Refine existing code
 */
export const refineCode = async (currentCode: string, signal?: AbortSignal) => {
    const startTime = performance.now();
    
    try {
        const ai = await getAICore();
        const worker = await getWorkerManager();
        
        const prompt = `
You are a Senior MQL5 Code Reviewer and Optimizer.
Analyze the following MQL5 code deeply.
Your task is to REWRITE the code to be more robust, efficient, and strictly adhere to MQL5 best practices, WITHOUT changing the core trading strategy logic.

Improvements to apply:
1. Fix any potential memory leaks or unhandled return codes
2. Optimize execution speed if possible
3. Ensure variable naming is clean and professional
4. Add better comments explaining complex sections
5. Standardize formatting
6. Add proper error handling

Current Code:
${currentCode}

Provide the improved code only, no explanation needed.`;

        let rawResponse = await ai.generateContent(prompt);
        
        // Use worker if available for processing
        let response: string;
        try {
            if (workerManager && await workerManager.isHealthy()) {
                response = await workerManager.executeTask({
                    id: 'extract_code_' + Date.now(),
                    type: 'extract_code',
                    data: rawResponse,
                    priority: 1,
                    timeout: 15000,
                    createdAt: Date.now()
                });
            } else {
                // Simple fallback - remove any markdown code blocks
                response = rawResponse.replace(/```(?:mql5)?\s*/g, '').replace(/```\s*/g, '').trim();
            }
        } catch (error) {
            logger.warn('Worker processing failed for code refinement:', error);
            response = rawResponse.replace(/```(?:mql5)?\s*/g, '').replace(/```\s*/g, '').trim();
        }
        
        const duration = performance.now() - startTime;
        logger.info(`Code refinement completed in ${duration.toFixed(2)}ms`);
        
        return response;
        
    } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        
        const duration = performance.now() - startTime;
        logger.error(`Code refinement failed after ${duration.toFixed(2)}ms:`, error);
        
        handleError(error, 'refineCode', 'gemini-legacy');
        throw error;
    }
};

/**
 * Explain existing code
 */
export const explainCode = async (currentCode: string, signal?: AbortSignal) => {
    const startTime = performance.now();
    
    try {
        const ai = await getAICore();
        
        const prompt = `
You are a Senior MQL5 Developer and Educator.
Analyze the following MQL5 code and provide a comprehensive explanation.

Your explanation should include:
1. Overall purpose of the strategy
2. Key components and their roles
3. Entry/exit conditions
4. Risk management approach
5. Any notable features or optimizations
6. Potential improvements or considerations

Code to analyze:
${currentCode}

Provide the explanation in a clear, educational format.`;

        const explanation = await ai.generateContent(prompt);
        
        const duration = performance.now() - startTime;
        logger.info(`Code explanation completed in ${duration.toFixed(2)}ms`);
        
        return explanation;
        
    } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        
        const duration = performance.now() - startTime;
        logger.error(`Code explanation failed after ${duration.toFixed(2)}ms:`, error);
        
        handleError(error, 'explainCode', 'gemini-legacy');
        throw error;
    }
};

/**
 * Test AI connection with provided settings
 */
export const testAIConnection = async (settings: AISettings) => {
    try {
        const ai = await getAICore();
        
        // Update AI core config temporarily for this test
        const originalConfig = ai.getConfig();
        ai.updateConfig({
            provider: settings.provider || originalConfig.provider,
            model: settings.modelName || originalConfig.model,
            apiKey: settings.apiKey || originalConfig.apiKey
        });
        
        const result = await ai.testConnection();
        
        // Restore original config
        ai.updateConfig(originalConfig);
        
        return result;
        
    } catch (error) {
        logger.error('AI connection test failed:', error);
        return {
            success: false,
            message: `Connection test failed: ${(error as Error).message}`
        };
    }
};

/**
 * Analyze trading strategy
 */
export const analyzeStrategy = async (code: string, signal?: AbortSignal): Promise<StrategyAnalysis> => {
    const startTime = performance.now();
    
    try {
        const ai = await getAICore();
        
        const prompt = `
You are an Expert MQL5 Strategy Analyst.
Analyze the following MQL5 trading strategy code and provide comprehensive analysis.

MQL5 Code:
${code}

Please provide analysis in the following JSON format:
{
  "overallScore": 85,
  "complexity": "Medium",
  "risk": "Medium", 
  "recommendations": [
    "Consider adding trailing stop",
    "Add more protective conditions"
  ],
  "strengths": [
    "Clear entry logic",
    "Good risk management"
  ],
  "weaknesses": [
    "No trend validation",
    "Fixed parameters"
  ]
}

Focus on:
- Code quality and best practices
- Risk management effectiveness
- Strategy robustness
- Potential edge cases
- Optimization opportunities

Provide only valid JSON format.`;

        let rawAnalysis = await ai.generateContent(prompt);
        
        // Try to parse JSON response, handle potential markdown wrapping
        let analysis: StrategyAnalysis;
        
        try {
            // Remove markdown code blocks if present
            const cleanedJson = rawAnalysis.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsedAnalysis = JSON.parse(cleanedJson);
            
            // Convert to correct StrategyAnalysis format
            analysis = {
                riskScore: Math.max(0, Math.min(100, 100 - (parsedAnalysis.overallScore || 50))),
                profitability: parsedAnalysis.overallScore || 50,
                description: `Complexity: ${parsedAnalysis.complexity || 'Medium'}, Risk: ${parsedAnalysis.risk || 'Medium'}. ${parsedAnalysis.strengths?.join(', ') || 'No notable strengths'}. ${parsedAnalysis.weaknesses?.join(', ') || 'No notable weaknesses'}.`,
                recommendations: parsedAnalysis.recommendations || []
            };
        } catch (parseError) {
            logger.warn('Failed to parse AI analysis as JSON, attempting fallback:', parseError);
            
            // Fallback: create a basic analysis based on code features
            analysis = {
                riskScore: code.includes("StopLoss") && code.includes("TakeProfit") ? 30 : 60,
                profitability: 50,
                description: `Analysis of MQL5 strategy code. ${code.length > 500 ? "High complexity detected." : "Medium complexity code."}`,
                recommendations: ["Review risk management", "Add protective conditions"]
            };
        }
        
        const duration = performance.now() - startTime;
        logger.info(`Strategy analysis completed in ${duration.toFixed(2)}ms`);
        
        return analysis;
        
    } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        
        const duration = performance.now() - startTime;
        logger.error(`Strategy analysis failed after ${duration.toFixed(2)}ms:`, error);
        
        handleError(error, 'analyzeStrategy', 'gemini-legacy');
        
        // Return fallback analysis
        return {
            riskScore: 80,
            profitability: 30,
            description: "Analysis failed - manual review required due to processing error",
            recommendations: ["Review failed - manual analysis required"]
        };
    }
};

// Export for use in application initialization
export const initializeAIModule = async () => {
    await getAICore();
    await getWorkerManager();
    await getRateLimiter();
};

// Helper to get services for advanced usage
export const getAIServices = () => ({
    getAICore,
    getWorkerManager,
    getRateLimiter
});