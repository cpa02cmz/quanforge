// Dynamic AI service loader for optimal bundle splitting
let geminiService: typeof import('./gemini') | null = null;
let isLoadingGemini = false;

export const loadGeminiService = async (): Promise<typeof import('./gemini')> => {
  if (geminiService) return geminiService;
  
  if (isLoadingGemini) {
    // Wait for loading to complete
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (geminiService) {
          clearInterval(checkInterval);
          resolve(void 0);
        }
      }, 50);
    });
    return geminiService!;
  }

  isLoadingGemini = true;
  try {
    geminiService = await import('./gemini');
    return geminiService;
  } finally {
    isLoadingGemini = false;
  }
};

// Preload AI service in background for better UX
export const preloadGeminiService = () => {
  loadGeminiService().catch(console.error);
};