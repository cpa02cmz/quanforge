// Dynamic AI service loader for optimal bundle splitting
let geminiService: typeof import('./gemini') | null = null;
let serviceLoadPromise: Promise<typeof import('./gemini')> | null = null;
let serviceLoadStartTime: number | null = null;
const SERVICE_LOAD_TIMEOUT = 10000; // 10 seconds timeout

// Enhanced AI service loader with better caching and error handling
export const loadGeminiService = async (): Promise<typeof import('./gemini')> => {
  // Return immediately if service is already loaded
  if (geminiService) {
    return geminiService;
  }
  
  // If loading is in progress, return the same promise to prevent duplicate loads
  if (serviceLoadPromise) {
    // Check if the existing promise is taking too long
    if (serviceLoadStartTime && Date.now() - serviceLoadStartTime > SERVICE_LOAD_TIMEOUT) {
      // Reset the promise if it's taking too long
      serviceLoadPromise = null;
      serviceLoadStartTime = null;
    } else {
      return serviceLoadPromise;
    }
  }

  // Create a new promise to handle the loading with timeout
  serviceLoadStartTime = Date.now();
  serviceLoadPromise = new Promise<typeof import('./gemini')>((resolve, reject) => {
    // Set timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.warn('AI service load timeout exceeded');
      serviceLoadPromise = null;
      serviceLoadStartTime = null;
      reject(new Error('AI service load timeout exceeded'));
    }, SERVICE_LOAD_TIMEOUT);

    import('./gemini')
      .then(service => {
        clearTimeout(timeoutId);
        geminiService = service;
        serviceLoadStartTime = null;
        resolve(service);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        console.error('Failed to load gemini service:', error);
        // Reset the promise on error to allow retry
        serviceLoadPromise = null;
        serviceLoadStartTime = null;
        reject(error);
      });
  });

  return serviceLoadPromise;
};

// Preload AI service in background for better UX with progressive enhancement
export const preloadGeminiService = () => {
  // Only preload if not already loaded or loading
  if (!geminiService && !serviceLoadPromise) {
    // Preload with error handling to prevent unhandled rejections
    loadGeminiService().catch(error => {
      console.warn('AI service preload failed:', error);
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