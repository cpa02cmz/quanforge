/**
 * Core Type Definitions for QuantForge Platform
 * This file provides comprehensive TypeScript interfaces to replace `any` types
 * throughout the codebase, ensuring type safety and better developer experience.
 */

// ============================================================================
// BASE INTERFACES
// ============================================================================

/**
 * Base interface for structured data objects
 */
export interface StructuredDataBase {
  '@context'?: string;
  '@type'?: string;
  name?: string;
  description?: string;
  url?: string;
  identifier?: string;
}

/**
 * Base interface for API responses
 */
export interface ApiResponseBase<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

/**
 * Base interface for database entities
 */
export interface DatabaseEntityBase {
  id: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/**
 * Error handling interfaces
 */
export interface ErrorDetail {
  code: string;
  message: string;
  field?: string;
  timestamp?: string;
}

/**
 * Error classes for type-safe error handling
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: ErrorDetail[]
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: ErrorDetail[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// SEO & SCHEMA.ORG TYPES
// ============================================================================

/**
 * Comprehensive SEO structured data types
 */
export interface StructuredDataOrganization extends StructuredDataBase {
  '@type': 'Organization';
  logo?: string;
  contactPoint?: {
    contactType: string;
    availableLanguage: string[];
    telephone?: string;
    email?: string;
  };
  sameAs?: string[];
  areaServed?: string;
  foundingDate?: string;
  founder?: string;
  knowsAbout?: string[];
  makesOffer?: StructuredDataOffer[];
}

export interface StructuredDataPerson extends StructuredDataBase {
  '@type': 'Person';
  givenName?: string;
  familyName?: string;
  email?: string;
  telephone?: string;
  jobTitle?: string;
  worksFor?: StructuredDataOrganization;
  sameAs?: string[];
  knowsAbout?: string[];
}

export interface StructuredDataOffer {
  '@type': 'Offer';
  price?: string;
  priceCurrency?: string;
  availability?: string;
  validFrom?: string;
  itemOffered?: string | StructuredDataBase;
  seller?: StructuredDataOrganization;
}

export interface StructuredDataProduct extends StructuredDataBase {
  '@type': 'Product';
  brand?: string;
  manufacturer?: string;
  model?: string;
  offers?: StructuredDataOffer[];
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: number;
    reviewCount: number;
    bestRating?: number;
    worstRating?: number;
  };
  reviews?: StructuredDataReview[];
}

export interface StructuredDataReview {
  '@type': 'Review';
  itemReviewed: string | StructuredDataBase;
  reviewBody: string;
  author: StructuredDataPerson;
  datePublished?: string;
  ratingValue: number;
  bestRating?: number;
  worstRating?: number;
}

export interface StructuredDataArticle extends StructuredDataBase {
  '@type': 'Article';
  headline: string;
  alternativeHeadline?: string;
  image?: string | string[];
  author: StructuredDataPerson | StructuredDataOrganization;
  publisher?: StructuredDataOrganization;
  datePublished?: string;
  dateModified?: string;
  articleBody?: string;
  articleSection?: string;
  keywords?: string[];
  thumbnailUrl?: string;
}

export interface StructuredDataLocalBusiness extends StructuredDataBase {
  '@type': 'LocalBusiness';
  address: {
    '@type': 'PostalAddress';
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  geo?: {
    '@type': 'GeoCoordinates';
    latitude: number;
    longitude: number;
  };
  openingHours?: string[];
  telephone?: string;
  priceRange?: string;
  paymentAccepted?: string[];
  currenciesAccepted?: string[];
}

export interface StructuredDataEvent extends StructuredDataBase {
  '@type': 'Event';
  startDate: string;
  endDate: string;
  location?: StructuredDataLocalBusiness;
  organizer?: StructuredDataPerson | StructuredDataOrganization;
  performer?: StructuredDataPerson | StructuredDataOrganization;
  attendee?: StructuredDataPerson[];
  offers?: StructuredDataOffer[];
  eventStatus?: string;
  eventAttendanceMode?: string;
}

export interface StructuredDataCourse extends StructuredDataBase {
  '@type': 'Course';
  provider: StructuredDataOrganization;
  educationalLevel?: string;
  inLanguage?: string[];
  about?: string[];
  syllabusSections?: Array<{
    name: string;
    description: string;
    timeRequired?: string;
  }>;
  totalTime?: string;
  coursePrerequisites?: string[];
  educationalCredentialAwarded?: string;
  offers?: StructuredDataOffer[];
}

export interface StructuredDataVideo extends StructuredDataBase {
  '@type': 'VideoObject';
  thumbnailUrl: string;
  contentUrl?: string;
  embedUrl?: string;
  uploadDate?: string;
  duration?: string;
  description?: string;
  transcript?: string;
  caption?: string;
}

export interface StructuredDataService extends StructuredDataBase {
  '@type': 'Service';
  provider: StructuredDataOrganization;
  serviceType: string;
  areaServed?: string;
  hasOfferCatalog?: {
    '@type': 'OfferCatalog';
    name: string;
    itemListElement?: StructuredDataOffer[];
  };
  hoursAvailable?: string[];
  audience?: string;
}

export interface StructuredDataWebsite extends StructuredDataBase {
  '@type': 'WebSite';
  publisher?: StructuredDataOrganization;
  potentialAction?: {
    '@type': 'SearchAction';
    target: string;
    'query-input': string;
  };
  mainEntity?: StructuredDataBase;
}

// Union type for all structured data types
export type StructuredData = 
  | StructuredDataOrganization
  | StructuredDataPerson
  | StructuredDataProduct
  | StructuredDataArticle
  | StructuredDataLocalBusiness
  | StructuredDataEvent
  | StructuredDataCourse
  | StructuredDataVideo
  | StructuredDataService
  | StructuredDataWebsite;

// ============================================================================
// DATABASE & API TYPES
// ============================================================================

/**
 * Database types for Supabase integration
 */
export interface DatabaseUser extends DatabaseEntityBase {
  email: string;
  name?: string;
  avatar_url?: string;
  subscription_tier?: 'free' | 'pro' | 'enterprise';
}

export interface DatabaseRobot extends DatabaseEntityBase {
  name: string;
  description?: string;
  code: string;
  strategy_params: Record<string, unknown>;
  chat_history: ChatMessage[];
  analysis_result?: AnalysisResult;
  tags?: string[];
  is_public?: boolean;
  forked_from?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    tokens?: number;
    model?: string;
    temperature?: number;
  };
}

export interface AnalysisResult {
  success: boolean;
  score?: number;
  risk_level?: 'low' | 'medium' | 'high';
  profitability_score?: number;
  recommendations?: string[];
  warnings?: string[];
  metrics?: Record<string, number>;
}

/**
 * Market data types
 */
export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  bid?: number;
  ask?: number;
  high?: number;
  low?: number;
}

export interface MarketTicker {
  symbol: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  timestamp: number;
  bid?: number;
  ask?: number;
  high?: number;
  low?: number;
  open?: number;
}

/**
 * API Request/Response types
 */
export interface CreateRobotRequest {
  name: string;
  description?: string;
  initial_code?: string;
  strategy_params?: Record<string, unknown>;
}

export interface UpdateRobotRequest {
  name?: string;
  description?: string;
  code?: string;
  strategy_params?: Record<string, unknown>;
  tags?: string[];
  is_public?: boolean;
}

export interface GetRobotsResponse {
  robots: DatabaseRobot[];
  total: number;
  page: number;
  limit: number;
}

export interface AnalyticsData {
  pageViews: number;
  uniqueVisitors: number;
  bounceRate: number;
  avgSessionDuration: number;
  topPages: Array<{
    path: string;
    views: number;
    uniqueViews: number;
  }>;
  events: Array<{
    name: string;
    count: number;
  }>;
  conversionRate?: number;
  timestamp: string;
}

// ============================================================================
// CHART & VISUALIZATION TYPES
// ============================================================================

/**
 * Recharts compatible types
 */
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: unknown;
}

export interface PieChartData extends ChartDataPoint {
  fill?: string;
}

export interface LineChartData extends ChartDataPoint {
  x?: number;
  y?: number;
  y0?: number;
  y1?: number;
}

export interface BarChartData extends ChartDataPoint {
  fill?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ChartAxisDomain {
  dataMin?: number;
  dataMax?: number;
  interval?: number;
  ticks?: number[];
}

export interface ChartColors {
  primary: string;
  secondary: string;
  tertiary: string;
  quaternary: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic utility types
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Event handler types
 */
export interface EventHandler<T = Event> {
  (event: T): void | Promise<void>;
}

export interface AsyncEventHandler<T = Event> {
  (event: T): Promise<void>;
}

/**
 * Configuration types
 */
export interface AIProvider {
  name: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StrategyConfig {
  name: string;
  timeframe: string;
  risk_level: 'low' | 'medium' | 'high';
  stop_loss_pips?: number;
  take_profit_pips?: number;
  custom_inputs: Array<{
    name: string;
    type: 'number' | 'string' | 'boolean';
    default_value: string | number | boolean;
    description?: string;
  }>;
}

// ============================================================================
// DATABASE QUERY BUILDER TYPES
// ============================================================================

/**
 * Types for fluent database query builder interface
 */
export interface SupabaseSelectBuilder<T = unknown> {
  eq(column: string, value: unknown): SupabaseSelectBuilder<T>;
  neq(column: string, value: unknown): SupabaseSelectBuilder<T>;
  gt(column: string, value: unknown): SupabaseSelectBuilder<T>;
  gte(column: string, value: unknown): SupabaseSelectBuilder<T>;
  lt(column: string, value: unknown): SupabaseSelectBuilder<T>;
  lte(column: string, value: unknown): SupabaseSelectBuilder<T>;
  in(column: string, values: unknown[]): SupabaseSelectBuilder<T>;
  order(column: string, options?: { ascending: boolean }): SupabaseSelectBuilder<T>;
  limit(count: number): SupabaseSelectBuilder<T>;
  range(from: number, to: number): SupabaseSelectBuilder<T>;
  single(): Promise<T | null>;
  maybeSingle(): Promise<T | null>;
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
}

export interface SupabaseInsertBuilder<T = unknown> {
  values(data: Partial<T>[]): SupabaseInsertBuilder<T>;
  values(data: Partial<T>): SupabaseInsertBuilder<T>;
  select(columns?: string): SupabaseSelectBuilder<T>;
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
}

export interface SupabaseUpdateBuilder<T = unknown> {
  eq(column: string, value: unknown): SupabaseUpdateBuilder<T>;
  match(criteria: Partial<T>): SupabaseUpdateBuilder<T>;
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
}

export interface SupabaseDeleteBuilder<T = unknown> {
  eq(column: string, value: unknown): SupabaseDeleteBuilder<T>;
  match(criteria: Partial<T>): SupabaseDeleteBuilder<T>;
  then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
}

export interface ResilientSupabaseClient {
  from<T = unknown>(table: string): SupabaseTableBuilder<T>;
}

export interface SupabaseTableBuilder<T = unknown> {
  select(columns?: string): SupabaseSelectBuilder<T>;
  insert(data: Partial<T>): SupabaseInsertBuilder<T>;
  update(data: Partial<T>): SupabaseUpdateBuilder<T>;
  delete(): SupabaseDeleteBuilder<T>;
}