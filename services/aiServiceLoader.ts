// Dynamic AI service loader for optimal bundle splitting
import { createScopedLogger } from '../utils/logger';

let geminiService: typeof import('./gemini') | null = null;
let serviceLoadPromise: Promise<typeof import('./gemini')> | null = null;
const logger = createScopedLogger('aiServiceLoader');

// Enhanced AI service loader with better caching and error handling
export const loadGeminiService = async (): Promise<typeof import('./gemini')> => {
  // Return immediately if service is already loaded
  if (geminiService) {
    return geminiService;
  }
  
  // If loading is in progress, return the same promise to prevent duplicate loads
  if (serviceLoadPromise) {
    return serviceLoadPromise;
  }

  // Create a new promise to handle the loading
  serviceLoadPromise = (async () => {
    try {
      const service = await import('./gemini');
      geminiService = service;
      return service;
    } catch (error: unknown) {
      logger.error('Failed to load gemini service:', error);
      // Reset the promise on error to allow retry
      serviceLoadPromise = null;
      throw error;
    }
  })();

  return serviceLoadPromise;
};

// Preload AI service in background for better UX with progressive enhancement
export const preloadGeminiService = () => {
  // Only preload if not already loaded or loading
  if (!geminiService && !serviceLoadPromise) {
    // Preload with error handling to prevent unhandled rejections
    loadGeminiService().catch(error => {
      logger.warn('AI service preload failed:', error);
    });
  }
};

// Service availability check for better UX
export const isGeminiServiceAvailable = (): boolean => {
  return geminiService !== null;
};

// Reset service cache (useful for testing or when needed)
export const resetGeminiService = () => {
  geminiService = null;
  serviceLoadPromise = null;
};