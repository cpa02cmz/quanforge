/**
 * Legacy SEO Service - DEPRECATED
 * This module has been consolidated into utils/seoUnified.tsx
 * Please import from seoUnified.tsx instead
 */

import { SEOService as UnifiedSEOService } from './seoUnified';

// Re-export for backward compatibility
export class SEOService {
  static monitor = UnifiedSEOService.monitor;
  static Head = UnifiedSEOService.Head;
  static useAnalytics = UnifiedSEOService.useAnalytics;
  
  static startAudit = () => UnifiedSEOService.startAudit();
  static generateReport = () => UnifiedSEOService.generateReport();
  static getMetrics = () => UnifiedSEOService.getMetrics();
}