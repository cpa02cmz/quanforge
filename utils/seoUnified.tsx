/**
 * Unified SEO Utility - Consolidates all SEO functionality
 * Replaces: comprehensiveSEO.tsx, seoEnhanced.tsx, seoService.tsx, seoAnalytics.tsx, seo.tsx, seoConsolidated.tsx
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';

// ---------- INTERFACES ----------

interface MetaTagsProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  type?: 'website' | 'article' | 'software' | 'product' | 'service';
  structuredData?: Record<string, any>[];
  noIndex?: boolean;
  alternateUrls?: Array<{ hrefLang: string; url: string }>;
  pageType?: 'homepage' | 'generator' | 'wiki' | 'blog' | 'faq' | 'about' | 'other';
  author?: string;
  publishDate?: string;
  modifiedDate?: string;
  category?: string;
  tags?: string[];
  enableAnalytics?: boolean;
  breadcrumbs?: Array<{ name: string; url: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  howToSteps?: Array<{ name: string; text: string; image?: string }>;
  videoData?: {
    name: string;
    description: string;
    thumbnailUrl: string;
    contentUrl?: string;
    duration?: number;
  };
  courseData?: {
    name: string;
    description: string;
    provider: string;
    educationalLevel?: string;
  };
  eventData?: {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
  };
  productData?: {
    name: string;
    description: string;
    price: string;
    currency?: string;
    availability?: string;
    brand?: string;
  };
}

interface SEOAnalyticsProps {
  pageUrl: string;
  pageTitle: string;
  pageType?: 'article' | 'product' | 'homepage' | 'other';
  enabled?: boolean;
}

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

interface AnalyticsData {
  scrollDepth: number;
  timeOnPage: number;
  clicks: number;
  formInteractions: number;
  isVisible: boolean;
}

// ---------- SEO HEAD COMPONENT ----------

export const SEOHead: React.FC<MetaTagsProps> = ({
  title = 'QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5',
  description = 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5 with visual strategy configuration and real-time market simulation.',
  keywords = 'MQL5 generator, MetaTrader 5, trading robot, Expert Advisor, AI trading, automated trading, forex robot, algorithmic trading, Gemini AI, trading strategy generator, MT5 EA, quantitative trading, forex EA, MQL5 EA builder, automated forex trading, AI trading bot, MetaTrader expert advisor, trading algorithm generator, MQL5 development, forex algorithm, trading automation, AI-powered trading, forex robot development, MetaTrader automation',
  ogImage = '/og-image.png',
  ogUrl = 'https://quanforge.ai',
  canonicalUrl = 'https://quanforge.ai',
  type = 'website',
  structuredData = [],
  noIndex = false,
  alternateUrls = [],
  author,
  publishDate,
  modifiedDate,
  category,
  tags,
  breadcrumbs,
  faqs,
  howToSteps,
  // Note: Additional props available but not used in core implementation
}: MetaTagsProps) => {
  const siteTitle = 'QuantForge AI';
  const fullTitle = title.includes(siteTitle) ? title : `${title} | ${siteTitle}`;

  // Comprehensive alternate URLs with language support
  const defaultAlternateUrls = [
    { hrefLang: 'en', url: canonicalUrl || 'https://quanforge.ai' },
    { hrefLang: 'en-US', url: canonicalUrl || 'https://quanforge.ai' },
    { hrefLang: 'x-default', url: canonicalUrl || 'https://quanforge.ai' },
    { hrefLang: 'id', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=id` },
    { hrefLang: 'zh-CN', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=zh` },
    { hrefLang: 'ja', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=ja` },
    { hrefLang: 'es', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=es` },
    { hrefLang: 'fr', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=fr` },
    { hrefLang: 'de', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=de` },
    { hrefLang: 'ko', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=ko` },
    { hrefLang: 'pt', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=pt` },
    { hrefLang: 'ru', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=ru` },
    { hrefLang: 'ar', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=ar` },
    { hrefLang: 'hi', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=hi` },
    { hrefLang: 'it', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=it` },
    { hrefLang: 'nl', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=nl` },
    { hrefLang: 'tr', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=tr` }
  ];

  const allAlternateUrls = [...defaultAlternateUrls, ...alternateUrls];

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Optimized meta tag updater
    const updateMetaTag = (name: string, content: string, property?: string) => {
      const selector = property ? `meta[property="${property}"]` : `meta[name="${name}"]`;
      let meta: HTMLMetaElement | null = document.querySelector(selector);
      
      if (!meta) {
        meta = document.createElement('meta');
        if (property) {
          meta.setAttribute('property', property);
        } else {
          meta.setAttribute('name', name);
        }
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Update basic meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    
    // Update OG tags
    updateMetaTag('', fullTitle, 'og:title');
    updateMetaTag('', description, 'og:description');
    updateMetaTag('', ogImage, 'og:image');
    updateMetaTag('', ogUrl || canonicalUrl, 'og:url');
    updateMetaTag('', type, 'og:type');
    updateMetaTag('', 'QuantForge AI', 'og:site_name');
    
    // Update Twitter tags
    updateMetaTag('', 'summary_large_image', 'twitter:card');
    updateMetaTag('', '@QuantForgeAI', 'twitter:site');
    updateMetaTag('', fullTitle, 'twitter:title');
    updateMetaTag('', description, 'twitter:description');
    updateMetaTag('', ogImage, 'twitter:image');
    
    // Update canonical URL
    let canonical: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);
    
    // Update robots tag
    const robotsContent = noIndex ? 'noindex,nofollow' : 'index,follow';
    updateMetaTag('robots', robotsContent);
    
    // Add alternate URLs
    allAlternateUrls.forEach(({ hrefLang, url }) => {
      let alternate: HTMLLinkElement | null = document.querySelector(`link[rel="alternate"][hreflang="${hrefLang}"]`);
      if (!alternate) {
        alternate = document.createElement('link');
        alternate.setAttribute('rel', 'alternate');
        alternate.setAttribute('hreflang', hrefLang);
        document.head.appendChild(alternate);
      }
      alternate.setAttribute('href', url);
    });

    // Add structured data
    if (structuredData.length > 0 || breadcrumbs || faqs || howToSteps) {
      updateStructuredData();
    }

    function updateStructuredData() {
      const structuredDataArray: Record<string, any>[] = [
        ...structuredData,
        // Website schema
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteTitle,
          description: description,
          url: canonicalUrl,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${canonicalUrl}?q={search_term_string}`,
            'query-input': 'required name=search_term_string'
          }
        },
        // Organization schema
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: siteTitle,
          url: canonicalUrl,
          logo: `${canonicalUrl}/logo.png`,
          description: 'Advanced MQL5 trading robot generator powered by AI'
        }
      ];

      // Add breadcrumbs if provided
      if (breadcrumbs && breadcrumbs.length > 0) {
        structuredDataArray.push({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbs.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url
          }))
        });
      }

      // Add FAQ if provided
      if (faqs && faqs.length > 0) {
        structuredDataArray.push({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer
            }
          }))
        });
      }

      // Add HowTo if provided
      if (howToSteps && howToSteps.length > 0) {
        structuredDataArray.push({
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: title,
          description: description,
          step: howToSteps.map((step, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: step.name,
            text: step.text,
            image: step.image
          }))
        });
      }

      // Add Article/Software schema
      if (type === 'article' || type === 'software') {
        const articleSchema: Record<string, any> = {
          '@context': 'https://schema.org',
          '@type': type === 'article' ? 'Article' : 'SoftwareApplication',
          headline: title,
          description: description,
          url: canonicalUrl,
          datePublished: publishDate,
          dateModified: modifiedDate || publishDate,
          author: {
            '@type': 'Organization',
            name: 'QuantForge AI'
          },
          publisher: {
            '@type': 'Organization',
            name: 'QuantForge AI',
            logo: {
              '@type': 'ImageObject',
              url: `${canonicalUrl}/logo.png`
            }
          }
        };

        if (tags) articleSchema['keywords'] = tags.join(', ');
        if (category) articleSchema['about'] = category;
        if (author) articleSchema['author']['@type'] = 'Person';

        structuredDataArray.push(articleSchema);
      }

      // Remove existing structured data
      const existingScript = document.querySelector('script[type="application/ld+json"]');
      if (existingScript) {
        existingScript.remove();
      }

      // Add new structured data
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredDataArray, null, 2);
      document.head.appendChild(script);
    }

    // Cleanup function
    return () => {
      // Remove added elements if needed
      const structuredDataScript = document.querySelector('script[type="application/ld+json"]');
      if (structuredDataScript) {
        structuredDataScript.remove();
      }
    };
  }, [fullTitle, description, keywords, ogImage, ogUrl, canonicalUrl, type, noIndex, allAlternateUrls, structuredData, breadcrumbs, faqs, howToSteps]);

  return null; // This component only updates head metadata
};

// ---------- SEO ANALYTICS HOOK ----------

export const useSEOAnalytics = ({ pageUrl, pageTitle, pageType = 'other', enabled = true }: SEOAnalyticsProps) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    scrollDepth: 0,
    timeOnPage: 0,
    clicks: 0,
    formInteractions: 0,
    isVisible: true
  });

  const startTime = useRef(Date.now());
  const lastScrollPosition = useRef(0);
  const hasSentData = useRef(false);

  // Throttled analytics event sender
  const sendAnalyticsEvent = useCallback((
    eventType: string,
    data: Record<string, any>,
    delay: number = 100
  ) => {
    if (!enabled) return;
    
    setTimeout(() => {
      try {
        if (process.env['NODE_ENV'] === 'development') {
          console.debug('Analytics Event:', eventType, data);
        }
        // In production, send to analytics service
      } catch (error) {
        // Silent fail
      }
    }, delay);
  }, [enabled]);

  // Scroll tracking with requestAnimationFrame
  useEffect(() => {
    if (!enabled) return;

    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const windowHeight = window.innerHeight;
          const documentHeight = document.documentElement.scrollHeight;
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollPercentage = Math.round((scrollTop / (documentHeight - windowHeight)) * 100);
          
          if (scrollPercentage > analyticsData.scrollDepth) {
            setAnalyticsData(prev => ({ ...prev, scrollDepth: scrollPercentage }));
            
            if ([25, 50, 75, 90].includes(scrollPercentage)) {
              sendAnalyticsEvent('scroll_milestone', {
                depth: scrollPercentage,
                page: pageTitle,
                url: pageUrl
              });
            }
          }
          
          lastScrollPosition.current = scrollTop;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [enabled, analyticsData.scrollDepth, pageTitle, pageUrl, sendAnalyticsEvent]);

  // Click tracking
  useEffect(() => {
    if (!enabled) return;

    const handleClick = () => {
      setAnalyticsData(prev => ({ ...prev, clicks: prev.clicks + 1 }));
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [enabled]);

  // Form interaction tracking
  useEffect(() => {
    if (!enabled) return;

    const handleFormInteraction = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        setAnalyticsData(prev => ({ ...prev, formInteractions: prev.formInteractions + 1 }));
      }
    };

    window.addEventListener('focusin', handleFormInteraction);
    return () => window.removeEventListener('focusin', handleFormInteraction);
  }, [enabled]);

  // Page time tracking
  useEffect(() => {
    if (!enabled) return;

    const timeInterval = setInterval(() => {
      setAnalyticsData(prev => ({ 
        ...prev, 
        timeOnPage: Date.now() - startTime.current 
      }));
    }, 1000);

    return () => clearInterval(timeInterval);
  }, [enabled]);

  // Visibility tracking
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      setAnalyticsData(prev => ({ ...prev, isVisible: !document.hidden }));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled]);

  // Send analytics on page unload
  useEffect(() => {
    if (!enabled || hasSentData.current) return;

    const sendData = () => {
      hasSentData.current = true;
      sendAnalyticsEvent('page_engagement', {
        ...analyticsData,
        timeOnPage: Date.now() - startTime.current,
        page: pageTitle,
        url: pageUrl,
        pageType
      });
    };

    const handlePageUnload = () => {
      sendData();
    };

    window.addEventListener('beforeunload', handlePageUnload);
    return () => {
      window.removeEventListener('beforeunload', handlePageUnload);
      if (!hasSentData.current) {
        sendData();
      }
    };
  }, [enabled, analyticsData, pageTitle, pageUrl, pageType, sendAnalyticsEvent]);

  return analyticsData;
};

// ---------- SEO MONITOR SERVICE ----------

class SEOMonitorService {
  private metrics: Partial<SEOMetrics> = {};
  private auditStartTime: number = 0; // Used for audit duration tracking

  constructor() {
    this.initializePerformanceTracking();
  }

  private initializePerformanceTracking(): void {
    if (typeof window === 'undefined') return;

    this.trackPageLoadTiming();
    this.trackCoreWebVitals();
    this.trackUserInteractions();
  }

  private trackPageLoadTiming(): void {
    if ('performance' in window && 'getEntriesByType' in performance) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigation) {
            this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
            this.metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
            this.metrics.timeToInteractive = this.calculateTimeToInteractive(navigation);
          }
        }, 0);
      });
    }
  }

  private trackCoreWebVitals(): void {
    if (!('PerformanceObserver' in window)) return;

    // Track CLS
    const clsObserver = new PerformanceObserver((list) => {
      let clsValue = 0;
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.metrics.cumulativeLayoutShift = clsValue;
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    // Track FID
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.metrics.firstInputDelay = (entry as any).processingStart - entry.startTime;
      }
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Track LCP
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.largestContentfulPaint = lastEntry?.startTime;
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  }

  private trackUserInteractions(): void {
    if (typeof window === 'undefined') return;

    let lastInteractionTime = Date.now();
    
    const trackInteraction = () => {
      lastInteractionTime = Date.now();
      console.debug('User interaction tracked at:', lastInteractionTime);
    };

    // Track various user interactions
    ['click', 'scroll', 'keypress', 'touchstart'].forEach(event => {
      window.addEventListener(event, trackInteraction, { passive: true });
    });
  }

  private calculateTimeToInteractive(navigation: PerformanceNavigationTiming): number {
    // Approximate TTI based on available metrics
    const domComplete = navigation.domComplete - navigation.fetchStart;
    const domInteractive = navigation.domInteractive - navigation.fetchStart;
    return Math.max(domComplete, domInteractive);
  }

  public startAudit(): void {
    this.auditStartTime = Date.now();
  }

  public getAuditDuration(): number {
    return this.auditStartTime ? Date.now() - this.auditStartTime : 0;
  }

  public generateAuditReport(): SEOAuditResult {
    const issues: SEOAuditResult['issues'] = [];
    const score = 100;
    
    // Check performance metrics
    if (this.metrics.firstContentfulPaint && this.metrics.firstContentfulPaint > 1800) {
      issues.push({
        type: 'warning',
        message: `Slow First Contentful Paint: ${this.metrics.firstContentfulPaint}ms`,
        recommendation: 'Optimize critical resources and reduce server response time'
      });
    }

    if (this.metrics.cumulativeLayoutShift && this.metrics.cumulativeLayoutShift > 0.1) {
      issues.push({
        type: 'error',
        message: `High Cumulative Layout Shift: ${this.metrics.cumulativeLayoutShift.toFixed(3)}`,
        recommendation: 'Add size attributes to images and avoid inserting content above existing content'
      });
    }

    // Check meta tags
    const hasTitle = !!document.querySelector('title') && document.title.length > 0;
    const hasDescription = !!document.querySelector('meta[name="description"]');
    
    if (!hasTitle) {
      issues.push({
        type: 'error',
        message: 'Missing or empty title tag',
        recommendation: 'Add descriptive title tag between 30-60 characters'
      });
    }
    
    if (!hasDescription) {
      issues.push({
        type: 'error',
        message: 'Missing description tag',
        recommendation: 'Add a detailed meta-description between 120-160 characters'
      });
    }

    // Check structured data
    const hasStructuredData = !!document.querySelector('script[type="application/ld+json"]');
    if (!hasStructuredData) {
      issues.push({
        type: 'warning',
        message: 'Missing structured data',
        recommendation: 'Add JSON-LD structured data to improve search result appearance'
      });
    }

    return {
      score: Math.max(0, score - issues.length * 5),
      issues,
      metrics: this.metrics as SEOMetrics,
      recommendations: issues.map(issue => issue.recommendation)
    };
  }

  public getMetrics(): Partial<SEOMetrics> {
    return { ...this.metrics };
  }
}

// ---------- EXPORTS ----------

export const seoMonitor = new SEOMonitorService();

// Legacy exports for backward compatibility
export const SEOHeadComponent = SEOHead;
export const useAnalytics = useSEOAnalytics;
export const SEOAnalytics = useSEOAnalytics;

// Service class exports
export class SEOService {
  static monitor = seoMonitor;
  static Head = SEOHead;
  static useAnalytics = useSEOAnalytics;
  
  static startAudit = () => seoMonitor.startAudit();
  static generateReport = () => seoMonitor.generateAuditReport();
  static getMetrics = () => seoMonitor.getMetrics();
}

// Structured data templates for common use cases
export const structuredDataTemplates = {
  softwareApplication: {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'QuantForge AI',
    description: 'Advanced MQL5 trading robot generator powered by AI',
    url: 'https://quanforge.ai',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'InStock'
    }
  },
  webPage: (title: string, description: string, url: string) => ({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: description,
    url: url,
    mainEntityOfPage: url,
    lastReviewed: new Date().toISOString()
  }),
  breadcrumb: (items: Array<{ name: string; url: string }>) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  }),
  article: (title: string, description: string, url: string) => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    url: url,
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: 'QuantForge AI'
    },
    publisher: {
      '@type': 'Organization',
      name: 'QuantForge AI',
      logo: {
        '@type': 'ImageObject',
        url: 'https://quanforge.ai/logo.png'
      }
    }
  }),
  course: (title: string, description: string) => ({
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: title,
    description: description,
    provider: {
      '@type': 'Organization',
      name: 'QuantForge AI',
      url: 'https://quanforge.ai'
    },
    educationalLevel: 'Beginner to Advanced'
  }),
  faq: (questions: Array<{ question: string; answer: string }>) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  }),
  organization: {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'QuantForge AI',
    url: 'https://quanforge.ai',
    description: 'AI-powered trading robot generation platform',
    logo: {
      '@type': 'ImageObject',
      url: 'https://quanforge.ai/logo.png'
    },
    sameAs: [
      'https://twitter.com/QuantForgeAI'
    ]
  }
};

// Export types
export type {
  MetaTagsProps,
  SEOAnalyticsProps,
  SEOMetrics,
  SEOAuditResult,
  AnalyticsData
};