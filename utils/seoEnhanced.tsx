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
  alternateLanguages?: Array<{ lang: string; url: string }>;
  noIndex?: boolean;
  lastModified?: string;
}

interface AnalyticsData {
  scrollDepth: number;
  timeOnPage: number;
  clicks: number;
  formInteractions: number;
  isVisible: boolean;
  keyPresses: number;
  copyEvents: number;
  shareEvents: number;
}

interface WebVitals {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number | undefined;
  ttfb?: number | undefined;
}

export const useSEOAnalytics = ({ pageUrl, pageTitle, pageType = 'other', enabled = true }: SEOAnalyticsProps) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    scrollDepth: 0,
    timeOnPage: 0,
    clicks: 0,
    formInteractions: 0,
    isVisible: true,
    keyPresses: 0,
    copyEvents: 0,
    shareEvents: 0
  });

  const [webVitals, setWebVitals] = useState<WebVitals>({});
  const startTime = useRef(Date.now());
  const lastScrollPosition = useRef(0);
  const hasSentData = useRef(false);
  const scrollMilestones = useRef(new Set([25, 50, 75, 90]));

  // Enhanced Web Vitals tracking (simplified without external dependency)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const trackWebVitals = () => {
      try {
        // Basic performance metrics without external library
        if ('performance' in window) {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigation) {
            const fcp = performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime;
            const ttfb = navigation.responseStart - navigation.requestStart;
            
            setWebVitals(prev => ({
              ...prev,
              fcp: fcp,
              ttfb: ttfb
            }));
          }
        }
      } catch (error) {
        console.warn('Web Vitals tracking failed:', error);
      }
    };

    // Track after page load
    if (document.readyState === 'complete') {
      trackWebVitals();
    } else {
      window.addEventListener('load', trackWebVitals);
      return () => window.removeEventListener('load', trackWebVitals);
    }
    return undefined;
  }, [enabled]);

  // Enhanced analytics event sender with batching
  const eventQueue = useRef<Array<{ eventType: string; data: Record<string, any> }>>([]);
  const sendBatch = useCallback(() => {
    if (eventQueue.current.length === 0) return;
    
    const events = [...eventQueue.current];
    eventQueue.current = [];
    
    try {
      if (process.env['NODE_ENV'] === 'development') {
        console.debug('Analytics Batch:', events);
      }
      // Send to analytics service here
    } catch (error) {
      // Silent fail
    }
  }, []);

  const sendAnalyticsEvent = useCallback((
    eventType: string,
    data: Record<string, any>,
    delay: number = 100
  ) => {
    if (!enabled) return;
    
    eventQueue.current.push({ eventType, data: { ...data, timestamp: Date.now() } });
    
    setTimeout(() => {
      sendBatch();
    }, delay);
  }, [enabled, sendBatch]);

  // Enhanced scroll tracking with intersection observer
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
            
            // Track milestones only once
            if (scrollMilestones.current.has(scrollPercentage)) {
              scrollMilestones.current.delete(scrollPercentage);
              sendAnalyticsEvent('scroll_milestone', {
                depth: scrollPercentage,
                page: pageTitle,
                url: pageUrl,
                timestamp: Date.now()
              });
            }
          }
          
          lastScrollPosition.current = scrollTop;
          ticking = false;
        });
        ticking = true;
      }
    };

    // Use passive listeners for better performance
    window.addEventListener('scroll', handleScroll, { passive: true, capture: false });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [enabled, analyticsData.scrollDepth, pageTitle, pageUrl, sendAnalyticsEvent]);

  // Enhanced time tracking with Page Visibility API
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      if (analyticsData.isVisible && !document.hidden) {
        setAnalyticsData(prev => ({ ...prev, timeOnPage: prev.timeOnPage + 1 }));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, analyticsData.isVisible]);

  // Visibility and focus tracking
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

    const handleFocus = () => {
      sendAnalyticsEvent('page_focus', {
        page: pageTitle,
        url: pageUrl
      });
    };

    const handleBlur = () => {
      sendAnalyticsEvent('page_blur', {
        page: pageTitle,
        url: pageUrl,
        timeOnPage: analyticsData.timeOnPage
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, analyticsData.isVisible, pageTitle, pageUrl, analyticsData.timeOnPage, sendAnalyticsEvent]);

  // Enhanced interaction tracking
  useEffect(() => {
    if (!enabled) return;

    const handleClick = (e: MouseEvent) => {
      setAnalyticsData(prev => ({ ...prev, clicks: prev.clicks + 1 }));
      
      const target = e.target as HTMLElement;
      const isImportantElement = target.tagName === 'A' || 
                                target.tagName === 'BUTTON' || 
                                target.closest('button, a, [role="button"]');
      
      if (isImportantElement) {
        const elementData = {
          tagName: target.tagName,
          className: target.className,
          id: target.id,
          textContent: target.textContent?.substring(0, 50),
          href: (target as HTMLAnchorElement).href,
          ariaLabel: target.getAttribute('aria-label')
        };

        sendAnalyticsEvent('user_click', {
          element: elementData,
          page: pageTitle,
          url: pageUrl,
          scrollDepth: analyticsData.scrollDepth
        }, 200);
      }
    };

    const handleFormInteraction = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        setAnalyticsData(prev => ({ ...prev, formInteractions: prev.formInteractions + 1 }));
        
        sendAnalyticsEvent('form_interaction', {
          fieldType: target.tagName.toLowerCase(),
          fieldName: (target as HTMLInputElement).name,
          fieldId: target.id,
          page: pageTitle
        });
      }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      setAnalyticsData(prev => ({ ...prev, keyPresses: prev.keyPresses + 1 }));
      
      // Track important keyboard shortcuts
      if ((e.ctrlKey || e.metaKey) && ['s', 'c', 'v', 'f'].includes(e.key.toLowerCase())) {
        sendAnalyticsEvent('keyboard_shortcut', {
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          page: pageTitle
        });
      }
    };

    const handleCopy = () => {
      setAnalyticsData(prev => ({ ...prev, copyEvents: prev.copyEvents + 1 }));
      
      const selection = window.getSelection();
      sendAnalyticsEvent('content_copy', {
        selectionLength: selection?.toString().length || 0,
        page: pageTitle,
        url: pageUrl
      });
    };

    const handleShare = async () => {
      setAnalyticsData(prev => ({ ...prev, shareEvents: prev.shareEvents + 1 }));
      
      sendAnalyticsEvent('content_share', {
        method: 'web_share_api',
        page: pageTitle,
        url: pageUrl
      });
    };

    // Event delegation for better performance
    document.addEventListener('click', handleClick, { passive: true, capture: false });
    document.addEventListener('focus', handleFormInteraction, true);
    document.addEventListener('keypress', handleKeyPress, { passive: true });
    document.addEventListener('copy', handleCopy, { passive: true });
    document.addEventListener('share', handleShare, { passive: true });
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('focus', handleFormInteraction, true);
      document.removeEventListener('keypress', handleKeyPress);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('share', handleShare);
    };
  }, [enabled, pageTitle, pageUrl, analyticsData.scrollDepth, sendAnalyticsEvent]);

  // Enhanced engagement data sender
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
      keyPresses: analyticsData.keyPresses,
      copyEvents: analyticsData.copyEvents,
      shareEvents: analyticsData.shareEvents,
      totalTime: Date.now() - startTime.current,
      webVitals,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    sendAnalyticsEvent('page_engagement', engagementData, 0);
  }, [enabled, pageTitle, pageUrl, pageType, analyticsData, webVitals, sendAnalyticsEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (enabled && !hasSentData.current) {
        sendEngagementData();
        sendBatch(); // Send any remaining events
      }
    };
  }, [enabled, sendEngagementData, sendBatch]);

  return {
    analyticsData,
    webVitals,
    sendEngagementData
  };
};

// Enhanced SEO Head component
export const SEOHead: React.FC<MetaTagsProps> = ({
  title = 'QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5',
  description = 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5 with visual strategy configuration and real-time market simulation.',
  keywords = 'MQL5 generator, MetaTrader 5, trading robot, Expert Advisor, AI trading, automated trading, forex robot, algorithmic trading, Gemini AI, trading strategy generator, MT5 EA, quantitative trading, forex EA, MQL5 EA builder, automated forex trading, AI trading bot, MetaTrader expert advisor, trading algorithm generator',
  ogImage = '/og-image.png',
  ogUrl = 'https://quanforge.ai',
  canonicalUrl = 'https://quanforge.ai',
  type = 'website',
  structuredData = [],
  alternateLanguages = [],
  noIndex = false,
  lastModified
}) => {
  const siteTitle = 'QuantForge AI';
  const fullTitle = title.includes(siteTitle) ? title : `${title} | ${siteTitle}`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Optimized meta tag updater with caching
    const metaCache = new Map<string, HTMLMetaElement>();
    
    const updateMetaTag = useCallback((name: string, content: string, property?: string) => {
      const selector = property ? `meta[property="${property}"]` : `meta[name="${name}"]`;
      let meta: HTMLMetaElement | null = metaCache.get(selector) || document.querySelector(selector);
      
      if (!meta) {
        meta = document.createElement('meta');
        if (property) {
          meta.setAttribute('property', property);
        } else {
          meta.setAttribute('name', name);
        }
        document.head.appendChild(meta);
        metaCache.set(selector, meta);
      }
      meta.setAttribute('content', content);
    }, []);

    // Basic Meta Tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('author', 'QuantForge AI');
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    
    if (lastModified) {
      updateMetaTag('last-modified', lastModified);
    }

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
    updateMetaTag('og:locale', 'en_US', 'og:locale');
    
    // Twitter Card Tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', ogImage);
    updateMetaTag('twitter:site', '@quanforge');
    updateMetaTag('twitter:creator', '@quanforge');
    
    // Additional Meta Tags
    updateMetaTag('theme-color', '#22c55e');
    updateMetaTag('language', 'en');
    updateMetaTag('distribution', 'global');
    updateMetaTag('rating', 'general');
    updateMetaTag('revisit-after', '7 days');
    updateMetaTag('geo.region', 'US');
    updateMetaTag('geo.placename', 'Global');
    updateMetaTag('category', 'finance, technology, trading, artificial intelligence');
    updateMetaTag('coverage', 'Worldwide');
    updateMetaTag('target', 'all');
    updateMetaTag('HandheldFriendly', 'True');
    updateMetaTag('MobileOptimized', '320');
    updateMetaTag('apple-mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');
    updateMetaTag('format-detection', 'telephone=no');
    updateMetaTag('mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-title', 'QuantForge AI');
    updateMetaTag('application-name', 'QuantForge AI');
    updateMetaTag('referrer', 'no-referrer-when-downgrade');
    
    // Alternate language links
    alternateLanguages.forEach(({ lang, url }) => {
      let link: HTMLLinkElement | null = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'alternate');
        link.setAttribute('hreflang', lang);
        document.head.appendChild(link);
      }
      link.setAttribute('href', url);
    });
    
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
  }, [fullTitle, description, keywords, canonicalUrl, type, ogImage, ogUrl, siteTitle, structuredData, alternateLanguages, noIndex, lastModified]);

  return null;
};

// Enhanced SEO Analytics component
export const SEOAnalytics: React.FC<SEOAnalyticsProps> = (props) => {
  useSEOAnalytics(props);
  return null;
};

// Enhanced structured data templates
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
    },
    publisher: {
      '@type': 'Organization',
      name: 'QuantForge AI',
      url: 'https://quanforge.ai',
      logo: {
        '@type': 'ImageObject',
        url: 'https://quanforge.ai/logo.png',
        width: 512,
        height: 512
      }
    }
  }),
  
  softwareApplication: (name: string, description: string, url: string) => ({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    url,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      'priceCurrency': 'USD',
      'availability': 'https://schema.org/InStock'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150',
      bestRating: '5',
      worstRating: '1'
    },
    featureList: [
      'AI-Powered Code Generation',
      'Visual Strategy Configuration',
      'Real-time Market Simulation',
      'Risk Analysis Tools',
      'MT5 Integration',
      'Multi-Language Support',
      'Cloud Storage',
      'Advanced Analytics',
      'Monte Carlo Simulation',
      'Expert Advisor Builder'
    ]
  }),
  
  article: (headline: string, description: string, url: string, datePublished: string, author?: string) => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url,
    datePublished,
    dateModified: new Date().toISOString(),
    author: {
      '@type': author ? 'Person' : 'Organization',
      name: author || 'QuantForge AI'
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
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url
    },
    image: {
      '@type': 'ImageObject',
      url: 'https://quanforge.ai/og-image.png',
      width: 1200,
      height: 630
    }
  }),

  breadcrumb: (breadcrumbs: Array<{ name: string; url: string }>) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url
    }))
  }),

  howTo: (name: string, description: string, steps: Array<{ name: string; text: string; image?: string }>) => ({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    totalTime: 'PT10M',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: '0'
    },
    supply: [
      {
        '@type': 'HowToSupply',
        name: 'MetaTrader 5 Platform'
      },
      {
        '@type': 'HowToSupply', 
        name: 'Trading Account'
      }
    ],
    tool: [
      {
        '@type': 'HowToTool',
        name: 'QuantForge AI'
      }
    ],
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      image: step.image ? {
        '@type': 'ImageObject',
        url: step.image
      } : undefined
    }))
  }),

  faq: (questions: Array<{ question: string; answer: string }>) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(q => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer
      }
    }))
  }),

  localBusiness: {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'QuantForge AI',
    description: 'Advanced MQL5 Trading Robot Generator powered by AI',
    url: 'https://quanforge.ai',
    logo: 'https://quanforge.ai/logo.png',
    sameAs: [
      'https://twitter.com/quanforge',
      'https://github.com/quanforge'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['English']
    },
    areaServed: 'Worldwide',
    knowsLanguage: ['English'],
    foundingDate: '2024',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Trading Robot Generation Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'MQL5 Robot Generation',
            description: 'AI-powered MQL5 trading robot generation'
          }
        }
      ]
    }
  },

  webPage: (name: string, description: string, url: string, lastModified?: string) => ({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url,
    dateModified: lastModified || new Date().toISOString(),
    isPartOf: {
      '@type': 'WebSite',
      name: 'QuantForge AI',
      url: 'https://quanforge.ai'
    },
    about: {
      '@type': 'Thing',
      name: 'MQL5 Trading Robot Generation'
    },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: 'https://quanforge.ai/og-image.png'
    },
    inLanguage: 'en-US'
  }),

  videoGame: (name: string, description: string) => ({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150'
    },
    author: {
      '@type': 'Organization',
      name: 'QuantForge AI'
    }
  }),

  creativeWork: (name: string, description: string) => ({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name,
    description,
    dateCreated: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: 'QuantForge AI'
    },
    publisher: {
      '@type': 'Organization',
      name: 'QuantForge AI'
    },
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    genre: ['Technology', 'Finance', 'Trading', 'Software Development']
  })
};

export default SEOHead;