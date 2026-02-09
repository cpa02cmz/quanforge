/**
 * Environment Validation for URL Configuration
 * Ensures all required URL environment variables are present and valid
 */

import { EnvironmentValidation } from './envValidation';

// Simple validation functions
const validators = {
  url: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  string: (value: string): boolean => value.length > 0,
};

// URL environment variable specifications
export const URL_ENV_VARS = {
  // Production URLs
  VITE_APP_URL: {
    required: false,
    type: 'url',
    defaultValue: 'https://quanforge.ai',
    description: 'Main application URL',
  },
  VITE_APP_URL_CANONICAL: {
    required: false,
    type: 'url',
    defaultValue: 'https://quanforge.ai',
    description: 'Canonical URL for SEO',
  },
  VITE_APP_URL_WWW: {
    required: false,
    type: 'url',
    defaultValue: 'https://www.quanforge.ai',
    description: 'WWW variant of application URL',
  },
  
  // Development URLs
  VITE_DEV_URL_HTTP: {
    required: false,
    type: 'url',
    defaultValue: 'http://localhost:3000',
    description: 'HTTP development server URL',
  },
  VITE_DEV_URL_VITE: {
    required: false,
    type: 'url',
    defaultValue: 'http://localhost:5173',
    description: 'Vite development server URL',
  },
  VITE_WEBSOCKET_URL: {
    required: false,
    type: 'websocket-url',
    defaultValue: 'ws://localhost:3001',
    description: 'WebSocket server URL',
  },
  
  // External Service URLs
  VITE_FONTS_GOOGLE: {
    required: false,
    type: 'url',
    defaultValue: 'https://fonts.googleapis.com',
    description: 'Google Fonts API URL',
  },
  VITE_FONTS_GSTATIC: {
    required: false,
    type: 'url',
    defaultValue: 'https://fonts.gstatic.com',
    description: 'Google Fonts static assets URL',
  },
  VITE_GTM_URL: {
    required: false,
    type: 'url',
    defaultValue: 'https://www.googletagmanager.com',
    description: 'Google Tag Manager URL',
  },
  VITE_GA_URL: {
    required: false,
    type: 'url',
    defaultValue: 'https://www.google-analytics.com',
    description: 'Google Analytics URL',
  },
  VITE_SUPABASE_WILDCARD: {
    required: false,
    type: 'string',
    defaultValue: 'https://*.supabase.co',
    description: 'Supabase wildcard domain',
  },
  
  // Social Media URLs
  VITE_SOCIAL_TWITTER: {
    required: false,
    type: 'url',
    defaultValue: 'https://twitter.com/quanforge',
    description: 'Twitter profile URL',
  },
  VITE_SOCIAL_GITHUB: {
    required: false,
    type: 'url',
    defaultValue: 'https://github.com/quanforge',
    description: 'GitHub organization URL',
  },
  VITE_SOCIAL_LINKEDIN: {
    required: false,
    type: 'url',
    defaultValue: 'https://linkedin.com/company/quanforge',
    description: 'LinkedIn company URL',
  },
  VITE_SOCIAL_FACEBOOK: {
    required: false,
    type: 'url',
    defaultValue: 'https://facebook.com/quanforge',
    description: 'Facebook page URL',
  },
  VITE_SOCIAL_INSTAGRAM: {
    required: false,
    type: 'url',
    defaultValue: 'https://instagram.com/quanforge',
    description: 'Instagram profile URL',
  },
  
  // Asset URLs
  VITE_ASSET_LOGO_URL: {
    required: false,
    type: 'path',
    defaultValue: '/logo.png',
    description: 'Logo asset path or URL',
  },
  VITE_ASSET_OG_IMAGE_URL: {
    required: false,
    type: 'path',
    defaultValue: '/og-image.png',
    description: 'Open Graph image path or URL',
  },
};

// Custom validation for WebSocket URLs
const validateWebSocketUrl = (value: string): boolean => {
  return /^ws(s)?:\/\/.+/.test(value);
};

// Custom validation for paths
const validatePath = (value: string): boolean => {
  return value.startsWith('/') || /^https?:\/\//.test(value);
};

// Extend validators
const VALIDATORS = {
  'websocket-url': validateWebSocketUrl,
  'path': validatePath,
};

/**
 * Validate URL environment variables
 */
export const validateUrlEnvironment = (): EnvironmentValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  Object.entries(URL_ENV_VARS).forEach(([envVar, config]) => {
    const value = typeof process !== 'undefined' ? process.env[envVar] : undefined;
    
    if (value && config.type === 'url' && !validators.url(value)) {
      errors.push(`${envVar}: Invalid URL format`);
    }
    
    if (value && config.type === 'websocket-url' && !VALIDATORS['websocket-url'](value)) {
      errors.push(`${envVar}: Invalid WebSocket URL format`);
    }
    
    if (value && config.type === 'path' && !VALIDATORS['path'](value)) {
      errors.push(`${envVar}: Invalid path or URL format`);
    }
    
    // Check for inconsistent URL configurations
    if (envVar === 'VITE_APP_URL' && value && value.endsWith('/')) {
      warnings.push(`${envVar}: URL should not end with slash`);
    }
    
    // Check for HTTP in production URLs
    if (value && envVar.startsWith('VITE_APP_URL') && value.startsWith('http://') && !envVar.includes('DEV')) {
      warnings.push(`${envVar}: HTTPS recommended for production URLs`);
    }
    
    // Check for missing HTTPS in social URLs
    if (value && envVar.startsWith('VITE_SOCIAL_') && !value.startsWith('https://')) {
      warnings.push(`${envVar}: HTTPS recommended for social media URLs`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations: [],
  };
};

/**
 * Get validation schema for URL variables
 */
export const getUrlValidationSchema = () => {
  return URL_ENV_VARS;
};

export default validateUrlEnvironment;