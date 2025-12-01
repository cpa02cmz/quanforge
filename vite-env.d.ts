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
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}