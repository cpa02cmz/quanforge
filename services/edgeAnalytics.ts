/**
 * Edge Analytics Compatibility Wrapper
 * Redirects to consolidated edge analytics monitoring system
 */

import { edgeAnalyticsMonitoring } from './edgeAnalyticsMonitoring';

class EdgeAnalytics {
  trackCustomEvent(event: string, data: any): void {
    edgeAnalyticsMonitoring.trackUserEvent(event, 'custom', data);
  }

  trackPageView(path: string): void {
    edgeAnalyticsMonitoring.trackUserEvent('pageview', path);
  }

  trackUserInteraction(interaction: string, element: string): void {
    edgeAnalyticsMonitoring.trackUserEvent(interaction, element);
  }

  getAnalytics(): any {
    return edgeAnalyticsMonitoring.getMetrics();
  }
}

export const edgeAnalytics = new EdgeAnalytics();