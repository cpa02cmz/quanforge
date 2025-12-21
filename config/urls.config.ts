/**
 * URL and Endpoint Configuration - Centralized URL management
 */

export interface UrlConfig {
  site: {
    url: string;
    baseUrl: string;
    apiBaseUrl: string;
  };
  development: {
    url: string;
    port: number;
  };
  endpoints: {
    api?: string;
    security?: string;
    analytics?: string;
  };
  social: {
    twitter: string;
    linkedin: string;
    github: string;
  };
}

export const urlConfig: UrlConfig = {
  site: {
    url: import.meta.env.VITE_SITE_URL || 'https://quanforge.ai',
    baseUrl: import.meta.env.VITE_BASE_URL || 'https://quanforge.ai',
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.quanforge.ai',
  },
  development: {
    url: import.meta.env.VITE_DEV_URL || 'http://localhost:3000',
    port: parseInt(import.meta.env.VITE_DEV_PORT || '3000') || 3000,
  },
  endpoints: {
    api: import.meta.env.VITE_API_ENDPOINT,
    security: import.meta.env.VITE_SECURITY_ENDPOINT,
    analytics: import.meta.env.VITE_ANALYTICS_ENDPOINT,
  },
  social: {
    twitter: import.meta.env.VITE_TWITTER_URL || 'https://twitter.com/quanforge',
    linkedin: import.meta.env.VITE_LINKEDIN_URL || 'https://linkedin.com/company/quanforge',
    github: import.meta.env.VITE_GITHUB_URL || 'https://github.com/quanforge',
  },
};

/**
 * Get the current site URL based on environment
 */
export const getSiteUrl = (): string => {
  if (import.meta.env.DEV && urlConfig.development.url) {
    return urlConfig.development.url;
  }
  return urlConfig.site.url;
};

/**
 * Get allowed origins for security policies
 */
export const getAllowedOrigins = (): string[] => {
  const origins = [urlConfig.site.url];
  
  if (urlConfig.site.url.startsWith('www.')) {
    origins.push(urlConfig.site.url.replace('www.', ''));
  } else {
    origins.push(`www.${urlConfig.site.url}`);
  }
  
  if (import.meta.env.DEV) {
    origins.push(urlConfig.development.url);
    origins.push('http://localhost:5173'); // Vite default port
  }
  
  return origins;
};