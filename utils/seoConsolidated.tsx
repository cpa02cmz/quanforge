import React, { useEffect, useState, useRef, useCallback } from 'react';

interface SEOAnalyticsProps {
  pageUrl: string;
  pageTitle: string;
  pageType?: 'article' | 'product' | 'homepage' | 'other';
  enabled?: boolean;
}

interface MetaTagsProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  type?: 'website' | 'article' | 'software';
  structuredData?: Record<string, any>[];
}

// Consolidated analytics data structure
interface AnalyticsData {
  scrollDepth: number;
  timeOnPage: number;
  clicks: number;
  formInteractions: number;
  isVisible: boolean;
}

// Optimized analytics hook
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
    
    // Use setTimeout to throttle events
    setTimeout(() => {
      try {
        // Send to analytics service (implementation depends on your analytics provider)
        if (process.env['NODE_ENV'] === 'development') {
          console.debug('Analytics Event:', eventType, data);
        }
      } catch (error) {
        // Silent fail to not break user experience
      }
    }, delay);
  }, [enabled]);

  // Optimized scroll tracking with requestAnimationFrame
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
            
            // Track important milestones only
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

  // Optimized time tracking with visibility API
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      if (analyticsData.isVisible && !document.hidden) {
        setAnalyticsData(prev => ({ ...prev, timeOnPage: prev.timeOnPage + 1 }));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, analyticsData.isVisible]);

  // Visibility tracking
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      const wasVisible = analyticsData.isVisible;
      setAnalyticsData(prev => ({ ...prev, isVisible: !document.hidden }));
      
      if (wasVisible && document.hidden && !hasSentData.current) {
        sendEngagementData();
        hasSentData.current = true;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, analyticsData.isVisible]);

  // Optimized interaction tracking with event delegation
  useEffect(() => {
    if (!enabled) return;

    const handleClick = (e: MouseEvent) => {
      setAnalyticsData(prev => ({ ...prev, clicks: prev.clicks + 1 }));
      
      // Only track important clicks to reduce noise
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('button, a')) {
        sendAnalyticsEvent('user_click', {
          element: {
            tagName: target.tagName,
            className: target.className,
            id: target.id,
            textContent: target.textContent?.substring(0, 50)
          },
          page: pageTitle,
          url: pageUrl
        }, 200);
      }
    };

    const handleFormInteraction = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        setAnalyticsData(prev => ({ ...prev, formInteractions: prev.formInteractions + 1 }));
      }
    };

    // Use event delegation for better performance
    document.addEventListener('click', handleClick, { passive: true });
    document.addEventListener('focus', handleFormInteraction, true);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('focus', handleFormInteraction, true);
    };
  }, [enabled, pageTitle, pageUrl, sendAnalyticsEvent]);

  const sendEngagementData = useCallback(() => {
    if (!enabled || hasSentData.current) return;
    
    const engagementData = {
      page: pageTitle,
      url: pageUrl,
      pageType,
      scrollDepth: analyticsData.scrollDepth,
      timeOnPage: analyticsData.timeOnPage,
      clicks: analyticsData.clicks,
      formInteractions: analyticsData.formInteractions,
      totalTime: Date.now() - startTime.current
    };

    sendAnalyticsEvent('page_engagement', engagementData, 0);
  }, [enabled, pageTitle, pageUrl, pageType, analyticsData, sendAnalyticsEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (enabled && !hasSentData.current) {
        sendEngagementData();
      }
    };
  }, [enabled, sendEngagementData]);

  return {
    analyticsData,
    sendEngagementData
  };
};

// Consolidated SEO Head component
export const SEOHead: React.FC<MetaTagsProps> = ({
  title = 'QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5',
  description = 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5 with visual strategy configuration and real-time market simulation.',
  keywords = 'MQL5 generator, MetaTrader 5, trading robot, Expert Advisor, AI trading, automated trading, forex robot, algorithmic trading, Gemini AI, trading strategy generator, MT5 EA, quantitative trading, forex EA, MQL5 EA builder, automated forex trading, AI trading bot, MetaTrader expert advisor, trading algorithm generator',
  ogImage = '/og-image.png',
  ogUrl = 'https://quanforge.ai',
  canonicalUrl = 'https://quanforge.ai',
  type = 'website',
  structuredData = []
}) => {
  const siteTitle = 'QuantForge AI';
  const fullTitle = title.includes(siteTitle) ? title : `${title} | ${siteTitle}`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Optimized meta tag updater
    const updateMetaTag = useCallback((name: string, content: string, property?: string) => {
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
    }, []);

    // Basic Meta Tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('author', 'QuantForge AI');
    updateMetaTag('robots', 'index, follow');
    
    // Canonical URL
    const updateCanonical = useCallback(() => {
      let canonical: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', canonicalUrl);
    }, [canonicalUrl]);

    updateCanonical();
    
    // Open Graph Tags
    updateMetaTag('og:title', fullTitle, 'og:title');
    updateMetaTag('og:description', description, 'og:description');
    updateMetaTag('og:type', type, 'og:type');
    updateMetaTag('og:image', ogImage, 'og:image');
    updateMetaTag('og:url', ogUrl, 'og:url');
    updateMetaTag('og:site_name', siteTitle, 'og:site_name');
    
    // Twitter Card Tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', ogImage);
    
    // Additional Meta Tags
    updateMetaTag('theme-color', '#22c55e');
    updateMetaTag('language', 'en');
    
    // Clean up and add structured data
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => script.remove());
    
    structuredData.forEach((data) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });

    return () => {
      // Cleanup is handled by the effect dependency array
    };
  }, [fullTitle, description, keywords, canonicalUrl, type, ogImage, ogUrl, siteTitle, structuredData]);

  return null;
};

// Consolidated SEO Analytics component
export const SEOAnalytics: React.FC<SEOAnalyticsProps> = (props) => {
  useSEOAnalytics(props);
  return null;
};

// Structured data templates
export const structuredDataTemplates = {
  website: (url: string, name: string, description: string) => ({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    description,
    url,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${url}?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  }),
  
  softwareApplication: (name: string, description: string, url: string) => ({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    url,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    }
  }),
  
  article: (headline: string, description: string, url: string, datePublished: string) => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url,
    datePublished,
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
  })
};

// Export default for backward compatibility
export default SEOHead;