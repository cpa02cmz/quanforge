import { logger } from './logger';

interface SEOMetrics {
  pageLoadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
}

interface SEOAuditResult {
  score: number;
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    recommendation: string;
  }>;
  metrics: SEOMetrics;
  recommendations: string[];
}

class SEOService {
  private metrics: Partial<SEOMetrics> = {};
  private auditStartTime: number = 0;

  constructor() {
    this.initializePerformanceTracking();
  }

  // Initialize comprehensive performance tracking
  private initializePerformanceTracking(): void {
    if (typeof window === 'undefined') return;

    // Track page load timing
    this.trackPageLoadTiming();
    
    // Track Core Web Vitals
    this.trackCoreWebVitals();
    
    // Track user interactions
    this.trackUserInteractions();
  }

  // Track page load timing metrics
  private trackPageLoadTiming(): void {
    if ('performance' in window && 'getEntriesByType' in performance) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigation) {
            this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.loadEventStart;
            this.metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
            
            logger.info('Page load metrics:', {
              pageLoadTime: this.metrics.pageLoadTime,
              domContentLoaded: this.metrics.domContentLoaded
            });
          }
        }, 0);
      });
    }
  }

  // Track Core Web Vitals
  private trackCoreWebVitals(): void {
    // Track Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            this.metrics.largestContentfulPaint = lastEntry.startTime;
            this.sendMetricToAnalytics('LCP', lastEntry.startTime);
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        logger.warn('LCP tracking not supported:', error);
      }

      // Track Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.metrics.cumulativeLayoutShift = clsValue;
          this.sendMetricToAnalytics('CLS', clsValue * 1000);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        logger.warn('CLS tracking not supported:', error);
      }

      // Track First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.processingStart && entry.startTime) {
              const fid = entry.processingStart - entry.startTime;
              this.metrics.firstInputDelay = fid;
              this.sendMetricToAnalytics('FID', fid);
            }
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (error) {
        logger.warn('FID tracking not supported:', error);
      }

      // Track First Contentful Paint (FCP)
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
          if (fcpEntry) {
            this.metrics.firstContentfulPaint = fcpEntry.startTime;
            this.sendMetricToAnalytics('FCP', fcpEntry.startTime);
          }
        });
        fcpObserver.observe({ entryTypes: ['paint'] });
      } catch (error) {
        logger.warn('FCP tracking not supported:', error);
      }
    }
  }

  // Track user interactions for engagement metrics
  private trackUserInteractions(): void {
    if (typeof window === 'undefined') return;

    let interactionCount = 0;
    const maxInteractions = 100; // Limit to avoid excessive tracking

    const trackInteraction = (event: Event) => {
      if (interactionCount >= maxInteractions) return;
      
      interactionCount++;
      const interactionType = (event.target as HTMLElement)?.tagName || 'unknown';
      
      this.sendMetricToAnalytics('user_interaction', 1, {
        interaction_type: interactionType,
        interaction_number: interactionCount
      });
    };

    // Track clicks and touches
    document.addEventListener('click', trackInteraction, { passive: true });
    document.addEventListener('touchstart', trackInteraction, { passive: true });

    // Track scroll depth
    let maxScrollDepth = 0;
    const trackScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.pageYOffset;
      const scrollPercentage = Math.round((currentScroll / scrollHeight) * 100);
      
      if (scrollPercentage > maxScrollDepth) {
        maxScrollDepth = scrollPercentage;
        
        // Track important milestones
        if ([25, 50, 75, 90].includes(scrollPercentage)) {
          this.sendMetricToAnalytics('scroll_depth', scrollPercentage, {
            milestone: scrollPercentage
          });
        }
      }
    };

    window.addEventListener('scroll', trackScroll, { passive: true });
  }

  // Send metrics to analytics
  private sendMetricToAnalytics(
    metricName: string, 
    value: number, 
    additionalData?: Record<string, any>
  ): void {
    if (typeof window === 'undefined') return;

    // Send to Google Analytics 4
    if ((window as any).gtag) {
      (window as any).gtag('event', metricName.toLowerCase(), {
        value: Math.round(value),
        event_category: 'Web Vitals',
        custom_parameter_1: 'quantforge_ai',
        ...additionalData
      });
    }

    // Send to data layer for GTM
    if ((window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: metricName.toLowerCase(),
        value: Math.round(value),
        category: 'Web Vitals',
        ...additionalData
      });
    }

    // Log for debugging
    if (process.env['NODE_ENV'] === 'development') {
      logger.debug(`[SEO Metric] ${metricName}:`, Math.round(value), additionalData);
    }
  }

  // Start SEO audit
  startAudit(): void {
    this.auditStartTime = performance.now();
    this.metrics = {};
    logger.info('SEO audit started');
  }

  // Complete SEO audit and return results
  completeAudit(): SEOAuditResult {
    const auditEndTime = performance.now();
    const auditDuration = auditEndTime - this.auditStartTime;

    const issues = this.identifySEOIssues();
    const score = this.calculateSEOScore(issues);
    const recommendations = this.generateRecommendations(issues);

    const result: SEOAuditResult = {
      score,
      issues,
      metrics: this.metrics as SEOMetrics,
      recommendations
    };

    logger.info('SEO audit completed:', {
      score,
      auditDuration,
      issuesCount: issues.length
    });

    // Send audit results to analytics
    this.sendMetricToAnalytics('seo_audit_score', score, {
      issues_count: issues.length,
      audit_duration: Math.round(auditDuration)
    });

    return result;
  }

  // Identify SEO issues
  private identifySEOIssues(): Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    recommendation: string;
  }> {
    const issues: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      recommendation: string;
    }> = [];

    // Check page load time
    if (this.metrics.pageLoadTime && this.metrics.pageLoadTime > 3000) {
      issues.push({
        type: 'warning',
        message: `Page load time is ${Math.round(this.metrics.pageLoadTime)}ms (recommended: < 3000ms)`,
        recommendation: 'Optimize images, enable compression, and reduce server response time'
      });
    }

    // Check LCP
    if (this.metrics.largestContentfulPaint && this.metrics.largestContentfulPaint > 2500) {
      issues.push({
        type: 'warning',
        message: `LCP is ${Math.round(this.metrics.largestContentfulPaint)}ms (recommended: < 2500ms)`,
        recommendation: 'Optimize largest contentful paint element and reduce server response time'
      });
    }

    // Check CLS
    if (this.metrics.cumulativeLayoutShift && this.metrics.cumulativeLayoutShift > 0.1) {
      issues.push({
        type: 'error',
        message: `CLS is ${this.metrics.cumulativeLayoutShift.toFixed(3)} (recommended: < 0.1)`,
        recommendation: 'Ensure proper image dimensions and avoid inserting content above existing content'
      });
    }

    // Check FID
    if (this.metrics.firstInputDelay && this.metrics.firstInputDelay > 100) {
      issues.push({
        type: 'warning',
        message: `FID is ${Math.round(this.metrics.firstInputDelay)}ms (recommended: < 100ms)`,
        recommendation: 'Reduce JavaScript execution time and break up long tasks'
      });
    }

    // Check meta tags
    const title = document.title;
    if (!title || title.length < 30 || title.length > 60) {
      issues.push({
        type: 'error',
        message: `Title length is ${title?.length || 0} characters (recommended: 30-60)`,
        recommendation: 'Optimize title length for better search engine display'
      });
    }

    const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
    if (!description || description.length < 120 || description.length > 160) {
      issues.push({
        type: 'error',
        message: `Meta description length is ${description?.length || 0} characters (recommended: 120-160)`,
        recommendation: 'Write compelling meta descriptions within the recommended length'
      });
    }

    // Check heading structure
    const h1Count = document.querySelectorAll('h1').length;
    if (h1Count !== 1) {
      issues.push({
        type: 'error',
        message: `Found ${h1Count} H1 tags (recommended: exactly 1)`,
        recommendation: 'Use exactly one H1 tag per page for proper heading hierarchy'
      });
    }

    // Check image alt attributes
    const images = document.querySelectorAll('img');
    const imagesWithoutAlt = Array.from(images).filter(img => !img.alt);
    if (imagesWithoutAlt.length > 0) {
      issues.push({
        type: 'warning',
        message: `${imagesWithoutAlt.length} images missing alt attributes`,
        recommendation: 'Add descriptive alt attributes to all images for accessibility and SEO'
      });
    }

    // Check internal links
    const internalLinks = document.querySelectorAll('a[href^="/"], a[href^="' + window.location.origin + '"]');
    if (internalLinks.length < 3) {
      issues.push({
        type: 'info',
        message: `Only ${internalLinks.length} internal links found`,
        recommendation: 'Add more internal links to improve site navigation and SEO'
      });
    }

    return issues;
  }

  // Calculate SEO score based on issues
  private calculateSEOScore(issues: Array<{ type: string }>): number {
    let score = 100;
    
    issues.forEach(issue => {
      switch (issue.type) {
        case 'error':
          score -= 10;
          break;
        case 'warning':
          score -= 5;
          break;
        case 'info':
          score -= 2;
          break;
      }
    });

    return Math.max(0, score);
  }

  // Generate recommendations based on issues
  private generateRecommendations(issues: Array<{ type: string; recommendation: string }>): string[] {
    const recommendations = new Set<string>();
    
    issues.forEach(issue => {
      recommendations.add(issue.recommendation);
    });

    // Add general recommendations
    recommendations.add('Regularly monitor Core Web Vitals');
    recommendations.add('Keep content fresh and relevant');
    recommendations.add('Ensure mobile-friendly design');
    recommendations.add('Use descriptive URLs and file names');
    recommendations.add('Implement proper schema markup');

    return Array.from(recommendations);
  }

  // Get current metrics
  getMetrics(): Partial<SEOMetrics> {
    return { ...this.metrics };
  }

  // Generate structured data for page
  generateStructuredData(pageType: string, pageData: any): Record<string, any>[] {
    const structuredData: Record<string, any>[] = [];

    // Add basic webpage schema
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: pageData.title || 'QuantForge AI',
      description: pageData.description || 'Advanced MQL5 Trading Robot Generator',
      url: pageData.url || 'https://quanforge.ai',
      dateModified: new Date().toISOString(),
      datePublished: pageData.publishDate || new Date().toISOString(),
      author: {
        '@type': 'Organization',
        name: 'QuantForge AI'
      },
      publisher: {
        '@type': 'Organization',
        name: 'QuantForge AI',
        logo: {
          '@type': 'ImageObject',
          url: 'https://quanforge.ai/logo.png',
          width: 512,
          height: 512
        }
      }
    });

    // Add page-specific schemas
    switch (pageType) {
      case 'generator':
        structuredData.push({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'QuantForge AI Generator',
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Web',
          description: 'AI-powered MQL5 trading robot generator',
          url: 'https://quanforge.ai/generator',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD'
          }
        });
        break;

      case 'blog':
        if (pageData.title && pageData.description) {
          structuredData.push({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: pageData.title,
            description: pageData.description,
            author: {
              '@type': 'Organization',
              name: 'QuantForge AI'
            },
            datePublished: pageData.publishDate || new Date().toISOString(),
            dateModified: new Date().toISOString()
          });
        }
        break;

      case 'faq':
        if (pageData.faqs && Array.isArray(pageData.faqs)) {
          structuredData.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: pageData.faqs.map((faq: { question: string; answer: string }) => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer
              }
            }))
          });
        }
        break;
    }

    return structuredData;
  }

  // Monitor SEO performance over time
  monitorPerformanceTrends(): void {
    // Store metrics in localStorage for trend analysis
    if (typeof window !== 'undefined') {
      const storedMetrics = localStorage.getItem('seo-metrics');
      const metrics = storedMetrics ? JSON.parse(storedMetrics) : [];
      
      const currentMetrics = {
        timestamp: Date.now(),
        ...this.metrics
      };

      metrics.push(currentMetrics);

      // Keep only last 30 entries
      if (metrics.length > 30) {
        metrics.shift();
      }

      localStorage.setItem('seo-metrics', JSON.stringify(metrics));

      // Analyze trends
      this.analyzeTrends(metrics);
    }
  }

  // Analyze performance trends
  private analyzeTrends(metrics: any[]): void {
    if (metrics.length < 2) return;

    const recent = metrics.slice(-5);
    const older = metrics.slice(-10, -5);

    if (recent.length >= 3 && older.length >= 3) {
      const recentAvg = recent.reduce((sum, m) => sum + (m.pageLoadTime || 0), 0) / recent.length;
      const olderAvg = older.reduce((sum, m) => sum + (m.pageLoadTime || 0), 0) / older.length;

      const trend = recentAvg - olderAvg;
      
      if (Math.abs(trend) > 500) {
        logger.info(`Performance trend detected: ${trend > 0 ? 'slower' : 'faster'} by ${Math.abs(Math.round(trend))}ms`);
        
        // Send trend alert to analytics
        this.sendMetricToAnalytics('performance_trend', trend, {
          direction: trend > 0 ? 'degradation' : 'improvement',
          magnitude: Math.abs(Math.round(trend))
        });
      }
    }
  }
}

// Export singleton instance
export const seoService = new SEOService();
export default seoService;