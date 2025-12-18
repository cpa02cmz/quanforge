// Environment Configuration Constants
// Dynamic configuration for deployment flexibility

export const ENV_CONFIG = {
  // API and Server Configuration
  API_BASE_URL: import.meta.env['VITE_API_BASE_URL'] || (typeof process !== 'undefined' && process.env?.['NODE_ENV']) === 'development' 
    ? 'http://localhost:3000' 
    : 'https://quanforge.ai',
  
  // Development Server URLs (only used in development)
  DEV_SERVER_URLS: import.meta.env['VITE_DEV_SERVER_URLS'] 
    ? import.meta.env['VITE_DEV_SERVER_URLS'].split(',') 
    : [
        'http://localhost:3000',
        'http://localhost:5173', // Vite dev server
      ],
  
  // AI Service Configuration
  AI_LOCAL_BASE_URL: import.meta.env['VITE_AI_LOCAL_BASE_URL'] || 'http://localhost:11434/v1',
  
  // Edge Function Configuration
  EDGE_BASE_URL: import.meta.env['VITE_EDGE_BASE_URL'] || (typeof process !== 'undefined' && process.env?.['VERCEL_URL']) 
    ? `https://${typeof process !== 'undefined' ? process.env?.['VERCEL_URL'] : ''}` 
    : 'localhost:3000',
  
  // CORS Configuration
  ALLOWED_ORIGINS: import.meta.env['VITE_ALLOWED_ORIGINS'] 
    ? import.meta.env['VITE_ALLOWED_ORIGINS'].split(',') 
    : [
        // Production domains
        'https://quanforge.ai',
        'https://www.quanforge.ai',
        // Development URLs (only in dev mode)
        ...((typeof process !== 'undefined' && process.env?.['NODE_ENV']) === 'development' ? [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:11434'
        ] : []),
      ],
  
  // Feature Flags
  FEATURES: {
    ENABLE_LOCAL_AI: import.meta.env['VITE_ENABLE_LOCAL_AI'] !== 'false',
    ENABLE_EDGE_FUNCTIONS: import.meta.env['VITE_ENABLE_EDGE_FUNCTIONS'] !== 'false',
    ENABLE_ANALYTICS: import.meta.env['VITE_ENABLE_ANALYTICS'] !== 'false',
  },
} as const;

// Helper function to check if URL is allowed
export const isAllowedOrigin = (origin: string): boolean => {
  return ENV_CONFIG.ALLOWED_ORIGINS.some((allowed: string) => 
    allowed === '*' || origin.startsWith(allowed) || allowed === 'localhost'
  );
};

// Helper function to get current environment
export const getCurrentEnvironment = (): 'development' | 'staging' | 'production' => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'development';
  } else if (hostname.includes('staging') || hostname.includes('preview')) {
    return 'staging';
  } else {
    return 'production';
  }
};

// Helper function to get appropriate base URL for current environment
export const getApiBaseUrl = (): string => {
  const env = getCurrentEnvironment();
  
  switch (env) {
    case 'development':
      return ENV_CONFIG.DEV_SERVER_URLS[0]; // First dev server URL
    case 'staging':
      return import.meta.env['VITE_STAGING_API_URL'] || ENV_CONFIG.API_BASE_URL;
    case 'production':
      return ENV_CONFIG.API_BASE_URL;
    default:
      return ENV_CONFIG.API_BASE_URL;
  }
};