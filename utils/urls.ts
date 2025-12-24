/**
 * URL Configuration - Centralized, Environment-Based URL Management
 * Replaces hardcoded URLs throughout the application with dynamic configuration
 */

// Default URL configuration
export const DEFAULT_URL_CONFIG = {
  // Application URLs
  APP_URL: 'https://quanforge.ai',
  APP_URL_CANONICAL: 'https://quanforge.ai',
  APP_URL_WWW: 'https://www.quanforge.ai',
  
  // Development URLs
  DEV_URL_HTTP: 'http://localhost:3000',
  DEV_URL_VITE: 'http://localhost:5173',
  WEBSOCKET_URL: 'ws://localhost:3001',
  
  // External service URLs
  FONTS_GOOGLE: 'https://fonts.googleapis.com',
  FONTS_GSTATIC: 'https://fonts.gstatic.com',
  GTM: 'https://www.googletagmanager.com',
  GA: 'https://www.google-analytics.com',
  SUPABASE_WILDCARD: 'https://*.supabase.co',
  
  // Social media URLs
  TWITTER: 'https://twitter.com/quanforge',
  GITHUB: 'https://github.com/quanforge',
  LINKEDIN: 'https://linkedin.com/company/quanforge',
  FACEBOOK: 'https://facebook.com/quanforge',
  INSTAGRAM: 'https://instagram.com/quanforge',
  
  // Static asset URLs
  LOGO_URL: '/logo.png',
  OG_IMAGE: '/og-image.png',
  
  // Schema.org URLs
  SCHEMA_ORG: 'https://schema.org',
};

/**
 * Get environment-specific URL configuration
 * Uses environment variables with fallbacks to defaults
 */
export const getUrlConfig = () => {
  // Use process.env if available, fallback to import.meta.env for Vite
  const env = typeof process !== 'undefined' ? process.env : import.meta.env;
  
  return {
    // Production URLs (overridable via environment)
    APP_URL: env['VITE_APP_URL'] || DEFAULT_URL_CONFIG.APP_URL,
    APP_URL_CANONICAL: env['VITE_APP_URL_CANONICAL'] || env['VITE_APP_URL'] || DEFAULT_URL_CONFIG.APP_URL_CANONICAL,
    APP_URL_WWW: env['VITE_APP_URL_WWW'] || `www.${env['VITE_APP_URL'] || DEFAULT_URL_CONFIG.APP_URL.replace('https://', '')}`,
    
    // Development URLs (overridable via environment)
    DEV_URL_HTTP: env['VITE_DEV_URL_HTTP'] || DEFAULT_URL_CONFIG.DEV_URL_HTTP,
    DEV_URL_VITE: env['VITE_DEV_URL_VITE'] || DEFAULT_URL_CONFIG.DEV_URL_VITE,
    WEBSOCKET_URL: env['VITE_WEBSOCKET_URL'] || DEFAULT_URL_CONFIG.WEBSOCKET_URL,
    
    // External service URLs (typically not overridden, but possible)
    FONTS_GOOGLE: env['VITE_FONTS_GOOGLE'] || DEFAULT_URL_CONFIG.FONTS_GOOGLE,
    FONTS_GSTATIC: env['VITE_FONTS_GSTATIC'] || DEFAULT_URL_CONFIG.FONTS_GSTATIC,
    GTM: env['VITE_GTM_URL'] || DEFAULT_URL_CONFIG.GTM,
    GA: env['VITE_GA_URL'] || DEFAULT_URL_CONFIG.GA,
    SUPABASE_WILDCARD: env['VITE_SUPABASE_WILDCARD'] || DEFAULT_URL_CONFIG.SUPABASE_WILDCARD,
    
    // Social media URLs
    TWITTER: env['VITE_SOCIAL_TWITTER'] || DEFAULT_URL_CONFIG.TWITTER,
    GITHUB: env['VITE_SOCIAL_GITHUB'] || DEFAULT_URL_CONFIG.GITHUB,
    LINKEDIN: env['VITE_SOCIAL_LINKEDIN'] || DEFAULT_URL_CONFIG.LINKEDIN,
    FACEBOOK: env['VITE_SOCIAL_FACEBOOK'] || DEFAULT_URL_CONFIG.FACEBOOK,
    INSTAGRAM: env['VITE_SOCIAL_INSTAGRAM'] || DEFAULT_URL_CONFIG.INSTAGRAM,
    
    // Asset URLs (can be CDN URLs in production)
    LOGO_URL: env['VITE_ASSET_LOGO_URL'] || DEFAULT_URL_CONFIG.LOGO_URL,
    OG_IMAGE: env['VITE_ASSET_OG_IMAGE_URL'] || DEFAULT_URL_CONFIG.OG_IMAGE,
    
    // Schema.org URL (constant)
    SCHEMA_ORG: DEFAULT_URL_CONFIG.SCHEMA_ORG,
    
    // Helper method to get allowed origins array
    getAllowedOrigins: () => [
      env['VITE_APP_URL'] || DEFAULT_URL_CONFIG.APP_URL,
      DEFAULT_URL_CONFIG.APP_URL_WWW,
      DEFAULT_URL_CONFIG.DEV_URL_HTTP,
      DEFAULT_URL_CONFIG.DEV_URL_VITE,
    ].filter(Boolean),
    
    // Helper method to get social media URLs object
    getSocialUrls: () => ({
      twitter: env['VITE_SOCIAL_TWITTER'] || DEFAULT_URL_CONFIG.TWITTER,
      github: env['VITE_SOCIAL_GITHUB'] || DEFAULT_URL_CONFIG.GITHUB,
      linkedin: env['VITE_SOCIAL_LINKEDIN'] || DEFAULT_URL_CONFIG.LINKEDIN,
      facebook: env['VITE_SOCIAL_FACEBOOK'] || DEFAULT_URL_CONFIG.FACEBOOK,
      instagram: env['VITE_SOCIAL_INSTAGRAM'] || DEFAULT_URL_CONFIG.INSTAGRAM,
    }),
    
    // Helper method to get external service URLs
    getExternalServiceUrls: () => ({
      fonts: {
        google: env['VITE_FONTS_GOOGLE'] || DEFAULT_URL_CONFIG.FONTS_GOOGLE,
        gstatic: env['VITE_FONTS_GSTATIC'] || DEFAULT_URL_CONFIG.FONTS_GSTATIC,
      },
      analytics: {
        gtm: env['VITE_GTM_URL'] || DEFAULT_URL_CONFIG.GTM,
        ga: env['VITE_GA_URL'] || DEFAULT_URL_CONFIG.GA,
      },
      supabase: env['VITE_SUPABASE_WILDCARD'] || DEFAULT_URL_CONFIG.SUPABASE_WILDCARD,
    }),
  };
};

/**
 * Get URL configuration with type safety
 */
export const getUrl = <T extends keyof ReturnType<typeof getUrlConfig>>(key: T): ReturnType<typeof getUrlConfig>[T] => {
  const config = getUrlConfig();
  return config[key];
};

/**
 * Build absolute URLs safely
 */
export const buildAbsoluteUrl = (path: string, baseUrl?: string): string => {
  const config = getUrlConfig();
  const base = baseUrl || config.APP_URL;
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Remove trailing slash from base if present
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  
  return `${cleanBase}${normalizedPath}`;
};

/**
 * Check if URL is absolute
 */
export const isAbsoluteUrl = (url: string): boolean => {
  return /^https?:\/\//.test(url);
};

/**
 * Make URL absolute if it's relative
 */
export const ensureAbsoluteUrl = (url: string, baseUrl?: string): string => {
  if (isAbsoluteUrl(url)) {
    return url;
  }
  return buildAbsoluteUrl(url, baseUrl);
};

// Export default configuration for backward compatibility
export default getUrlConfig;