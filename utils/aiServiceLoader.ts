// Dynamic AI service loader for optimal bundle splitting
let aiServiceLoaded = false;
let aiServicePromise: Promise<void> | null = null;

export const loadAIService = async (): Promise<void> => {
  if (aiServiceLoaded) return;
  
  if (aiServicePromise) {
    return aiServicePromise;
  }

  aiServicePromise = import('../services/gemini').then(() => {
    aiServiceLoaded = true;
  }).catch((error) => {
    console.error('Failed to load AI service:', error);
    aiServicePromise = null;
    throw error;
  });

  return aiServicePromise;
};

// Preload AI service when user is likely to use it
export const preloadAIService = (): void => {
  // Only preload if user is authenticated or has interacted
  const hasInteracted = localStorage.getItem('user_interacted') === 'true';
  const isAuthenticated = localStorage.getItem('supabase.auth.token') || localStorage.getItem('mock_session');
  
  if (hasInteracted && isAuthenticated) {
    setTimeout(() => {
      loadAIService().catch(() => {
        // Silent fail for preload
      });
    }, 2000); // Preload after 2 seconds
  }
};