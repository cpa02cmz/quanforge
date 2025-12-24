// Environment validation utilities for security
export interface EnvironmentValidation {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

// Required environment variables for production
const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
] as const;

// Optional but recommended environment variables for security
const RECOMMENDED_ENV_VARS = [
  'VITE_ENCRYPTION_BASE_KEY',
  'VITE_ENCRYPTION_KEY',
  'VITE_LEGACY_ENCRYPTION_KEY'
] as const;

// validate environment variables
export const validateEnvironment = (): EnvironmentValidation => {
  const result: EnvironmentValidation = {
    isValid: true,
    warnings: [],
    errors: [],
    recommendations: []
  };

  // Check required environment variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!import.meta.env[envVar]) {
      result.isValid = false;
      result.errors.push(`Required environment variable ${envVar} is missing`);
    }
  }

  // Check recommended security environment variables
  for (const envVar of RECOMMENDED_ENV_VARS) {
    if (!import.meta.env[envVar]) {
      result.warnings.push(`Recommended security variable ${envVar} is not set`);
      result.recommendations.push(`Set ${envVar} for enhanced security`);
    }
  }

  // Validate encryption key strength if provided
  if (import.meta.env['VITE_ENCRYPTION_BASE_KEY']) {
    const key = import.meta.env['VITE_ENCRYPTION_BASE_KEY'];
    if (key.length < 16) {
      result.isValid = false;
      result.errors.push('VITE_ENCRYPTION_BASE_KEY must be at least 16 characters long');
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(key)) {
      result.warnings.push('VITE_ENCRYPTION_BASE_KEY contains special characters which may cause issues');
    }
  }

  // Check for hardcoded secrets in development
  if (import.meta.env.DEV) {
    const hardcodedSecrets = [
      'QuantForge_Key_2024',
      'QuantForge2025SecureKey',
      'sk-',
      'AIza',
      'ghp_',
      'gho_',
      'ghu_',
      'ghs_',
      'ghr_'
    ];

    // This is a simplified check - in production, you'd want more sophisticated secret detection
    for (const secret of hardcodedSecrets) {
      if (Object.values(import.meta.env).some(value => value?.includes(secret))) {
        result.warnings.push(`Potential hardcoded secret detected: ${secret.substring(0, 8)}...`);
        result.recommendations.push('Use environment variables instead of hardcoded secrets');
      }
    }
  }

  // Validate production environment
  if (!import.meta.env.DEV && !import.meta.env.PROD) {
    result.warnings.push('Environment mode is unclear - ensure NODE_ENV is set');
  }

  // Check for HTTPS in production
  if (import.meta.env.PROD && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    result.isValid = false;
    result.errors.push('Production environment must use HTTPS');
    result.recommendations.push('Configure SSL/TLS certificate for production deployment');
  }

  return result;
};

// Get security configuration with validation
export const getSecurityConfig = () => {
  const validation = validateEnvironment();
  
  return {
    encryption: {
      hasBaseKey: !!import.meta.env['VITE_ENCRYPTION_BASE_KEY'],
      hasApiKey: !!import.meta.env['VITE_ENCRYPTION_KEY'],
      hasLegacyKey: !!import.meta.env['VITE_LEGACY_ENCRYPTION_KEY']
    },
    supabase: {
      hasUrl: !!import.meta.env['VITE_SUPABASE_URL'],
      hasAnonKey: !!import.meta.env['VITE_SUPABASE_ANON_KEY']
    },
    environment: {
      isDev: import.meta.env.DEV,
      isProd: import.meta.env.PROD,
      mode: import.meta.env.MODE,
      protocol: window.location.protocol,
      hostname: window.location.hostname
    },
    validation
  };
};

// Auto-configure security settings
export const configureSecurity = () => {
  const config = getSecurityConfig();
  
  // Log security status in development
  if (config.environment.isDev) {
    // Security configuration validated
    // Environment, Encryption, and Supabase status available in config object
    // Warnings, errors, and recommendations available in config.validation
  }
  
  // Fail fast on critical security errors in production
  if (config.environment.isProd && !config.validation.isValid) {
    throw new Error('Critical security configuration errors detected in production');
  }
  
  return config;
};

// Validate environment variable format
export const validateEnvVarFormat = (key: string, value: string): boolean => {
  if (!key || !value) return false;
  
  // Check for common patterns that indicate issues
  const suspiciousPatterns = [
    /^test/i,
    /^example/i,
    /^your_/i,
    /^replace_/i,
    /localhost/i,
    /127\.0\.0\.1/,
    /^\s*$/
  ];
  
  return !suspiciousPatterns.some(pattern => pattern.test(value));
};