// Server-side API proxy utilities
// This file should be used in server-side contexts only (API routes, server functions)

// Secure environment variable access (server-side only)
const getServerEnv = (key: string): string => {
  // Only access server-side environment variables
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  throw new Error('Server environment access attempted from client-side');
};

// Provider-specific API endpoint configurations
export const API_ENDPOINTS = {
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    modelsEndpoint: '/v1beta/models'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    chatEndpoint: '/chat/completions'
  },
  twelveData: {
    baseUrl: 'https://api.twelvedata.com',
    quoteEndpoint: '/quote'
  }
} as const;

export type ApiProvider = keyof typeof API_ENDPOINTS;

// Server-side API key accessor (secure)
export const getServerApiKey = (provider: ApiProvider): string => {
  switch (provider) {
    case 'google':
      return getServerEnv('GOOGLE_GEMINI_API_KEY');
    case 'openai':
      return getServerEnv('OPENAI_API_KEY');
    case 'twelveData':
      return getServerEnv('TWELVE_DATA_API_KEY');
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};

// Secure API request builder for server-side
export const buildSecureApiRequest = (
  provider: ApiProvider,
  endpoint: string,
  options: RequestInit = {}
): Request => {
  const apiKey = getServerApiKey(provider);
  const baseUrl = API_ENDPOINTS[provider].baseUrl;
  
  let url: URL;
  const endpointWithKey = provider === 'twelveData' && !endpoint.includes('?apikey=')
    ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${encodeURIComponent(apiKey)}`
    : endpoint;
  
  url = new URL(endpointWithKey, baseUrl);
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add provider-specific authentication (except twelveData which uses query param)
  switch (provider) {
    case 'google':
      headers['x-goog-api-key'] = apiKey;
      break;
    case 'openai':
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
    case 'twelveData':
      // API key already added to URL query parameters
      break;
  }

  return new Request(url.toString(), {
    ...options,
    headers
  });
};

// Error handling for server-side API calls
export class SecureApiError extends Error {
  constructor(
    message: string,
    public provider: ApiProvider,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'SecureApiError';
  }
}

// Secure API call wrapper
export const secureApiCall = async (
  provider: ApiProvider,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  try {
    const request = buildSecureApiRequest(provider, endpoint, options);
    const response = await fetch(request);
    
    if (!response.ok) {
      throw new SecureApiError(
        `API call failed: ${response.statusText}`,
        provider,
        response.status,
        await response.clone().text()
      );
    }
    
    return response;
  } catch (error) {
    if (error instanceof SecureApiError) {
      throw error;
    }
    throw new SecureApiError(
      `Network error: ${error.message}`,
      provider,
      undefined,
      error
    );
  }
};

// Provider-specific request helpers
export const googleApi = {
  async generateContent(prompt: string, options: any = {}) {
    const response = await secureApiCall('google', '/v1beta/models/gemini-3-pro-preview:generateContent', {
      method: 'POST',
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...options
      })
    });
    
    return response.json();
  }
};

export const openaiApi = {
  async chatCompletion(messages: any[], options: any = {}) {
    const response = await secureApiCall('openai', '/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        ...options
      })
    });
    
    return response.json();
  }
};

export const twelveDataApi = {
  async getQuote(symbol: string) {
    const response = await secureApiCall('twelveData', `/quote?symbol=${symbol}`);
    return response.json();
  }
};

// Client-side safe interface (no API keys exposed)
export interface ClientApiInterface {
  makeRequest: (provider: ApiProvider, endpoint: string, data: any) => Promise<any>;
}

// This is what the client should use - makes requests through our secure endpoints
export const clientApi: ClientApiInterface = {
  async makeRequest(provider: ApiProvider, endpoint: string, data: any) {
    // Route through our secure API endpoints instead of calling external APIs directly
    const response = await fetch('/api/secure-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider,
        endpoint,
        data
      })
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }
    
    return response.json();
  }
};