/**
 * Resource Preloader Utility
 * 
 * Optimizes critical resource loading with intelligent preloading strategies.
 * Improves perceived performance by prioritizing essential resources.
 * 
 * Features:
 * - Critical CSS preloading
 * - Font preloading with display swap
 * - Image preloading with lazy fallback
 * - Script preloading with execution hints
 * - Connection预热 for API endpoints
 * - DNS prefetching for external domains
 * 
 * @module utils/resourcePreloader
 */

import { createScopedLogger } from './logger';

const logger = createScopedLogger('resource-preloader');

// ========== TYPES ==========

export interface PreloadOptions {
  /** Resource priority: 'high' | 'low' | 'auto' */
  priority?: 'high' | 'low' | 'auto';
  /** Resource type for proper header hints */
  as?: 'script' | 'style' | 'font' | 'image' | 'fetch' | 'document';
  /** CORS setting for cross-origin resources */
  crossOrigin?: 'anonymous' | 'use-credentials';
  /** Type attribute for fonts */
  type?: string;
  /** For fonts: font-display property */
  fontDisplay?: 'swap' | 'block' | 'fallback' | 'optional';
  /** Image preload specific: fetchpriority */
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Whether to use modulepreload for scripts */
  module?: boolean;
}

export interface PrefetchOptions {
  /** Resource type */
  as?: 'script' | 'style' | 'font' | 'image' | 'fetch' | 'document';
  /** CORS setting */
  crossOrigin?: 'anonymous' | 'use-credentials';
}

export interface PreconnectOptions {
  /** Whether to include credentials */
  crossOrigin?: 'anonymous' | 'use-credentials';
}

export interface DnsPrefetchOptions {
  /** Whether to use secure DNS */
  secure?: boolean;
}

export interface ResourcePreloaderStats {
  preloaded: string[];
  prefetched: string[];
  preconnected: string[];
  dnsPrefetched: string[];
  cacheHits: number;
  cacheMisses: number;
}

// ========== CONSTANTS ==========

const PRELOADED_RESOURCES = new Set<string>();
const PREFETCHED_RESOURCES = new Set<string>();
const PRECONNECTED_ORIGINS = new Set<string>();
const DNS_PREFETCHED_DOMAINS = new Set<string>();

// ========== UTILITY FUNCTIONS ==========

/**
 * Check if a URL is absolute
 */
function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

/**
 * Create and append link element to head
 */
function appendLinkToHead(link: HTMLLinkElement): void {
  if (typeof document === 'undefined') return;
  
  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;
  
  // Check if link already exists
  const existing = head.querySelector(`link[href="${link.href}"]`);
  if (!existing) {
    head.appendChild(link);
  }
}

// ========== MAIN CLASS ==========

class ResourcePreloader {
  private stats: ResourcePreloaderStats = {
    preloaded: [],
    prefetched: [],
    preconnected: [],
    dnsPrefetched: [],
    cacheHits: 0,
    cacheMisses: 0,
  };

  /**
   * Preload a critical resource
   * Use for resources needed immediately in the current page
   * 
   * @param href - URL of the resource
   * @param options - Preload options
   * 
   * @example
   * // Preload a critical font
   * resourcePreloader.preload('/fonts/inter-var.woff2', {
   *   as: 'font',
   *   type: 'font/woff2',
   *   crossOrigin: 'anonymous',
   *   priority: 'high'
   * });
   * 
   * @example
   * // Preload a critical CSS file
   * resourcePreloader.preload('/styles/critical.css', {
   *   as: 'style',
   *   priority: 'high'
   * });
   */
  preload(href: string, options: PreloadOptions = {}): void {
    if (typeof document === 'undefined') return;
    if (PRELOADED_RESOURCES.has(href)) {
      this.stats.cacheHits++;
      return;
    }

    const {
      priority = 'auto',
      as,
      crossOrigin,
      type,
      fontDisplay,
      fetchPriority,
      module,
    } = options;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;

    if (as) link.setAttribute('as', as);
    if (crossOrigin) link.crossOrigin = crossOrigin;
    if (type) link.type = type;
    if (priority) link.setAttribute('importance', priority);
    if (fetchPriority) link.setAttribute('fetchpriority', fetchPriority);
    if (module) link.rel = 'modulepreload';

    // Font-specific handling
    if (as === 'font' && fontDisplay) {
      link.setAttribute('crossorigin', crossOrigin || 'anonymous');
    }

    appendLinkToHead(link);
    PRELOADED_RESOURCES.add(href);
    this.stats.preloaded.push(href);
    this.stats.cacheMisses++;

    logger.debug(`Preloaded: ${href} (as: ${as || 'unknown'}, priority: ${priority})`);
  }

  /**
   * Prefetch a resource for future navigation
   * Use for resources likely needed for the next page
   * 
   * @param href - URL of the resource
   * @param options - Prefetch options
   * 
   * @example
   * // Prefetch a page for faster navigation
   * resourcePreloader.prefetch('/dashboard', { as: 'document' });
   */
  prefetch(href: string, options: PrefetchOptions = {}): void {
    if (typeof document === 'undefined') return;
    if (PREFETCHED_RESOURCES.has(href)) {
      this.stats.cacheHits++;
      return;
    }

    const { as, crossOrigin } = options;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;

    if (as) link.setAttribute('as', as);
    if (crossOrigin) link.crossOrigin = crossOrigin;

    appendLinkToHead(link);
    PREFETCHED_RESOURCES.add(href);
    this.stats.prefetched.push(href);
    this.stats.cacheMisses++;

    logger.debug(`Prefetched: ${href} (as: ${as || 'unknown'})`);
  }

  /**
   * Preconnect to an origin for faster subsequent requests
   * Use for domains you'll make requests to soon
   * 
   * @param origin - Origin URL to preconnect to
   * @param options - Preconnect options
   * 
   * @example
   * // Preconnect to API server
   * resourcePreloader.preconnect('https://api.example.com');
   */
  preconnect(origin: string, options: PreconnectOptions = {}): void {
    if (typeof document === 'undefined') return;
    if (!isAbsoluteUrl(origin)) {
      logger.warn(`Preconnect requires absolute URL: ${origin}`);
      return;
    }
    if (PRECONNECTED_ORIGINS.has(origin)) {
      this.stats.cacheHits++;
      return;
    }

    const { crossOrigin } = options;

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    if (crossOrigin) link.crossOrigin = crossOrigin;

    appendLinkToHead(link);
    PRECONNECTED_ORIGINS.add(origin);
    this.stats.preconnected.push(origin);
    this.stats.cacheMisses++;

    logger.debug(`Preconnected: ${origin}`);
  }

  /**
   * Prefetch DNS for external domain
   * Use when you might connect to a domain but don't know the full URL yet
   * 
   * @param domain - Domain to prefetch DNS for
   * @param options - DNS prefetch options
   * 
   * @example
   * // Prefetch DNS for CDN
   * resourcePreloader.dnsPrefetch('cdn.example.com');
   */
  dnsPrefetch(domain: string, options: DnsPrefetchOptions = {}): void {
    if (typeof document === 'undefined') return;
    if (DNS_PREFETCHED_DOMAINS.has(domain)) {
      this.stats.cacheHits++;
      return;
    }

    const { secure } = options;
    const href = secure ? `https://${domain}` : `//${domain}`;

    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = href;

    appendLinkToHead(link);
    DNS_PREFETCHED_DOMAINS.add(domain);
    this.stats.dnsPrefetched.push(domain);
    this.stats.cacheMisses++;

    logger.debug(`DNS prefetched: ${domain}`);
  }

  /**
   * Batch preload multiple resources
   * Optimized for loading multiple critical resources
   */
  preloadBatch(resources: Array<{ href: string; options?: PreloadOptions }>): void {
    resources.forEach(({ href, options }) => {
      this.preload(href, options);
    });
  }

  /**
   * Batch prefetch multiple resources
   * Optimized for preparing next-page resources
   */
  prefetchBatch(resources: Array<{ href: string; options?: PrefetchOptions }>): void {
    resources.forEach(({ href, options }) => {
      this.prefetch(href, options);
    });
  }

  /**
   * Preconnect to multiple origins
   */
  preconnectBatch(origins: string[]): void {
    origins.forEach((origin) => {
      this.preconnect(origin);
    });
  }

  /**
   * Preload critical fonts
   * Convenience method for font preloading
   */
  preloadFonts(fonts: Array<{ href: string; type?: string }>): void {
    fonts.forEach(({ href, type = 'font/woff2' }) => {
      this.preload(href, {
        as: 'font',
        type,
        crossOrigin: 'anonymous',
        priority: 'high',
        fontDisplay: 'swap',
      });
    });
  }

  /**
   * Preload critical images
   * Convenience method for above-the-fold images
   */
  preloadImages(images: Array<{ href: string; fetchPriority?: 'high' | 'low' | 'auto' }>): void {
    images.forEach(({ href, fetchPriority = 'high' }) => {
      this.preload(href, {
        as: 'image',
        fetchPriority,
      });
    });
  }

  /**
   * Setup preloading for common application resources
   * Call this early in application lifecycle
   */
  setupApplicationPreloading(config?: {
    apiOrigins?: string[];
    cdnDomains?: string[];
    criticalFonts?: string[];
    criticalImages?: string[];
  }): void {
    const {
      apiOrigins = [],
      cdnDomains = [],
      criticalFonts = [],
      criticalImages = [],
    } = config || {};

    // Preconnect to API origins
    this.preconnectBatch(apiOrigins);

    // DNS prefetch CDN domains
    cdnDomains.forEach((domain) => {
      this.dnsPrefetch(domain, { secure: true });
    });

    // Preload critical fonts
    this.preloadFonts(criticalFonts.map((href) => ({ href })));

    // Preload critical images
    this.preloadImages(criticalImages.map((href) => ({ href })));

    logger.info('Application preloading setup complete', {
      apiOrigins: apiOrigins.length,
      cdnDomains: cdnDomains.length,
      criticalFonts: criticalFonts.length,
      criticalImages: criticalImages.length,
    });
  }

  /**
   * Get preloading statistics
   */
  getStats(): ResourcePreloaderStats {
    return { ...this.stats };
  }

  /**
   * Check if a resource is already preloaded
   */
  isPreloaded(href: string): boolean {
    return PRELOADED_RESOURCES.has(href);
  }

  /**
   * Check if a resource is already prefetched
   */
  isPrefetched(href: string): boolean {
    return PREFETCHED_RESOURCES.has(href);
  }

  /**
   * Check if an origin is already preconnected
   */
  isPreconnected(origin: string): boolean {
    return PRECONNECTED_ORIGINS.has(origin);
  }

  /**
   * Clear all cached resource references
   */
  reset(): void {
    PRELOADED_RESOURCES.clear();
    PREFETCHED_RESOURCES.clear();
    PRECONNECTED_ORIGINS.clear();
    DNS_PREFETCHED_DOMAINS.clear();
    this.stats = {
      preloaded: [],
      prefetched: [],
      preconnected: [],
      dnsPrefetched: [],
      cacheHits: 0,
      cacheMisses: 0,
    };
    logger.info('Resource preloader reset');
  }
}

// ========== SINGLETON EXPORT ==========

export const resourcePreloader = new ResourcePreloader();

// ========== CONVENIENCE FUNCTIONS ==========

/**
 * Quick preload function for single resources
 */
export function preloadResource(href: string, options?: PreloadOptions): void {
  resourcePreloader.preload(href, options);
}

/**
 * Quick prefetch function for single resources
 */
export function prefetchResource(href: string, options?: PrefetchOptions): void {
  resourcePreloader.prefetch(href, options);
}

/**
 * Quick preconnect function for single origins
 */
export function preconnectOrigin(origin: string): void {
  resourcePreloader.preconnect(origin);
}

export default resourcePreloader;
