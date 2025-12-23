/**
 * Legacy Comprehensive SEO - DEPRECATED
 * This module has been consolidated into utils/seoUnified.tsx
 * Please import from seoUnified.tsx instead
 */

import { SEOHead, useSEOAnalytics } from './seoUnified';

// Re-export for backward compatibility
export { SEOHead, useSEOAnalytics };

// Export with legacy name
export const ComprehensiveSEO = SEOHead;
export const useComprehensiveSEOAnalytics = useSEOAnalytics;