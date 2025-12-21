/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PROD: boolean
  readonly DEV: boolean
  readonly MODE: string
  readonly VITE_API_KEY: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_TWELVE_DATA_API_KEY: string
  readonly NODE_ENV?: string
  
  // Security Configuration
  readonly VITE_MAX_PAYLOAD_SIZE?: string
  readonly VITE_ALLOWED_ORIGINS?: string
  readonly VITE_SECURITY_ENDPOINT?: string
  readonly VITE_RATE_LIMIT_WINDOW?: string
  readonly VITE_RATE_LIMIT_MAX?: string
  readonly VITE_ENCRYPTION_ALGORITHM?: string
  readonly VITE_ENCRYPTION_KEY_ROTATION?: string
  readonly VITE_EDGE_RATE_LIMIT_ENABLED?: string
  readonly VITE_EDGE_RATE_LIMIT_RPS?: string
  readonly VITE_EDGE_RATE_LIMIT_BURST?: string
  readonly VITE_EDGE_RATE_LIMIT_WINDOW?: string
  readonly VITE_REGION_BLOCKING_ENABLED?: string
  readonly VITE_BLOCKED_REGIONS?: string
  readonly VITE_BOT_DETECTION_ENABLED?: string
  readonly VITE_SUSPICIOUS_BOT_PATTERNS?: string
  readonly VITE_NAME_MIN_LENGTH?: string
  readonly VITE_NAME_MAX_LENGTH?: string
  readonly VITE_DESCRIPTION_MAX_LENGTH?: string
  readonly VITE_RISK_MIN_PERCENTAGE?: string
  readonly VITE_RISK_MAX_PERCENTAGE?: string
  readonly VITE_DEPOSIT_MIN_AMOUNT?: string
  readonly VITE_DEPOSIT_MAX_AMOUNT?: string
  readonly VITE_BACKTEST_MIN_DAYS?: string
  readonly VITE_BACKTEST_MAX_DAYS?: string
  readonly VITE_COMPANY_NAME?: string
  readonly VITE_SITE_URL?: string
  readonly VITE_COMPANY_EMAIL?: string
  readonly VITE_COMPANY_PHONE?: string
  readonly VITE_COMPANY_ADDRESS?: string
  readonly VITE_COMPANY_TWITTER?: string
  readonly VITE_COMPANY_LINKEDIN?: string
  readonly VITE_COMPANY_GITHUB?: string
  
  // Performance Configuration
  readonly VITE_MAX_RETRIES?: string
  readonly VITE_RETRY_DELAY?: string
  readonly VITE_BACKOFF_MULTIPLIER?: string
  readonly VITE_MAX_DELAY?: string
  readonly VITE_RETRY_JITTER?: string
  readonly VITE_CACHE_TTL?: string
  readonly VITE_CACHE_MAX_SIZE?: string
  readonly VITE_SLOW_QUERY_THRESHOLD?: string
  readonly VITE_SLOW_OPERATION_THRESHOLD?: string
  readonly VITE_DB_QUERY_LIMIT?: string
  readonly VITE_AI_CACHE_SIZE?: string
  readonly VITE_AI_DEFAULT_TTL?: string
  readonly VITE_METRICS_FREQUENCY?: string
  readonly VITE_ALERT_THRESHOLD?: string
  
  // URLs and Endpoints
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DEV_URL?: string
  readonly VITE_BASE_URL?: string
  readonly VITE_DEV_PORT?: string
  readonly VITE_API_ENDPOINT?: string
  readonly VITE_SECURITY_ENDPOINT?: string
  readonly VITE_ANALYTICS_ENDPOINT?: string
  readonly VITE_TWITTER_URL?: string
  readonly VITE_LINKEDIN_URL?: string
  readonly VITE_GITHUB_URL?: string
  
  // Analytics
  readonly VITE_GA_ID?: string
  readonly VITE_SITE_VERIFICATION_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}