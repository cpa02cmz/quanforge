import React, { useEffect, useState, useRef, useCallback } from 'react';

interface MetaTagsProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  type?: 'website' | 'article' | 'software';
  structuredData?: Record<string, any>[];
  noIndex?: boolean;
  alternateUrls?: Array<{ hrefLang: string; url: string }>;
}

interface SEOAnalyticsProps {
  pageUrl: string;
  pageTitle: string;
  pageType?: 'article' | 'product' | 'homepage' | 'other';
  enabled?: boolean;
}

interface AnalyticsData {
  scrollDepth: number;
  timeOnPage: number;
  clicks: number;
  formInteractions: number;
  isVisible: boolean;
}

// Enhanced SEO Head component with comprehensive optimization
export const SEOHead: React.FC<MetaTagsProps> = ({
  title = 'QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5',
  description = 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5 with visual strategy configuration and real-time market simulation.',
  keywords = 'MQL5 generator, MetaTrader 5, trading robot, Expert Advisor, AI trading, automated trading, forex robot, algorithmic trading, Gemini AI, trading strategy generator, MT5 EA, quantitative trading, forex EA, MQL5 EA builder, automated forex trading, AI trading bot, MetaTrader expert advisor, trading algorithm generator, MQL5 development, forex algorithm, trading automation, AI trading system, quantitative finance, algorithmic trading platform, MT5 programming, Expert Advisor development, forex bot creator, automated trading software, MQL5 coder, trading strategy automation, AI-powered trading, forex robot development, MetaTrader automation',
  ogImage = '/og-image.png',
  ogUrl = 'https://quanforge.ai',
  canonicalUrl = 'https://quanforge.ai',
  type = 'website',
  structuredData = [],
  noIndex = false,
alternateUrls = []
}) => {
  const siteTitle = 'QuantForge AI';
  const fullTitle = title.includes(siteTitle) ? title : `${title} | ${siteTitle}`;

  // Enhanced alternate URLs with comprehensive language support
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

    // Optimized meta tag updater with cleanup
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

    // Basic Meta Tags with enhanced SEO
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('author', 'QuantForge AI');
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    
    // Language and geo targeting
    updateMetaTag('language', 'en');
    updateMetaTag('geo.region', 'US');
    updateMetaTag('geo.placename', 'Global');
    updateMetaTag('distribution', 'global');
    updateMetaTag('rating', 'general');
    updateMetaTag('revisit-after', '7 days');
    updateMetaTag('category', 'finance, technology, trading, artificial intelligence');
    updateMetaTag('coverage', 'Worldwide');
    updateMetaTag('target', 'all');
    
    // Mobile optimization
    updateMetaTag('HandheldFriendly', 'True');
    updateMetaTag('MobileOptimized', '320');
    updateMetaTag('apple-mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');
    updateMetaTag('format-detection', 'telephone=no');
    updateMetaTag('mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-title', 'QuantForge AI');
    updateMetaTag('application-name', 'QuantForge AI');
    
    // Theme and branding
    updateMetaTag('theme-color', '#22c55e');
    updateMetaTag('msapplication-TileColor', '#22c55e');
    updateMetaTag('msapplication-config', '/browserconfig.xml');
    updateMetaTag('msapplication-TileImage', '/mstile-144x144.png');
    
    // Security and privacy
    updateMetaTag('referrer', 'no-referrer-when-downgrade');
    updateMetaTag('copyright', 'QuantForge AI');
    updateMetaTag('classification', 'Software');
    
    // Content classification
    updateMetaTag('content-language', 'en');
    updateMetaTag('content-type', 'text/html; charset=utf-8');
    
    // Search engine verification (placeholders)
    updateMetaTag('google-site-verification', 'your-google-verification-code');
    updateMetaTag('msvalidate.01', 'your-bing-verification-code');
    updateMetaTag('yandex-verification', 'your-yandex-verification-code');
    updateMetaTag('p:domain_verify', 'your-pinterest-verification-code');

    // Canonical URL
    let canonical: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);
    
    // Alternate language links
    const existingAlternateLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existingAlternateLinks.forEach(link => link.remove());
    
    allAlternateUrls.forEach(alt => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', alt.hrefLang);
      link.setAttribute('href', alt.url);
      document.head.appendChild(link);
    });
    
    // Open Graph Tags with enhanced social media optimization
    updateMetaTag('og:title', fullTitle, 'og:title');
    updateMetaTag('og:description', description, 'og:description');
    updateMetaTag('og:type', type, 'og:type');
    updateMetaTag('og:image', ogImage, 'og:image');
    updateMetaTag('og:image:width', '1200', 'og:image:width');
    updateMetaTag('og:image:height', '630', 'og:image:height');
    updateMetaTag('og:image:alt', title, 'og:image:alt');
    updateMetaTag('og:url', ogUrl, 'og:url');
    updateMetaTag('og:site_name', siteTitle, 'og:site_name');
    updateMetaTag('og:locale', 'en_US', 'og:locale');
    
    // Enhanced Open Graph tags
    if (type === 'article') {
      updateMetaTag('article:author', 'QuantForge AI', 'article:author');
      updateMetaTag('article:section', 'Financial Technology', 'article:section');
      updateMetaTag('article:tag', 'MQL5, Trading Robots, AI, Algorithmic Trading', 'article:tag');
      updateMetaTag('article:published_time', new Date().toISOString(), 'article:published_time');
      updateMetaTag('article:modified_time', new Date().toISOString(), 'article:modified_time');
    }
    
    // Facebook specific
    updateMetaTag('fb:app_id', 'your-facebook-app-id', 'fb:app_id');
    
    // Twitter Card Tags with enhanced Twitter optimization
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', ogImage);
    updateMetaTag('twitter:image:alt', title);
    updateMetaTag('twitter:site', '@quanforge');
    updateMetaTag('twitter:creator', '@quanforge');
    updateMetaTag('twitter:domain', 'quanforge.ai');
    
    // Clean up existing structured data
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => script.remove());
    
    // Add structured data
    structuredData.forEach((data) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });

    // Add DNS prefetch for performance
    const dnsPrefetchDomains = [
      '//fonts.googleapis.com',
      '//fonts.gstatic.com',
      '//cdn.tailwindcss.com',
      '//cdnjs.cloudflare.com',
      '//www.googletagmanager.com',
      '//connect.facebook.net',
      '//www.google-analytics.com',
      '//*.supabase.co'
    ];
    
    dnsPrefetchDomains.forEach(domain => {
      let link: HTMLLinkElement | null = document.querySelector(`link[rel="dns-prefetch"][href="${domain}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'dns-prefetch');
        link.setAttribute('href', domain);
        document.head.appendChild(link);
      }
    });

    // Add preconnect for critical resources
    const preconnectDomains = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com'
    ];
    
    preconnectDomains.forEach(domain => {
      let link: HTMLLinkElement | null = document.querySelector(`link[rel="preconnect"][href="${domain}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'preconnect');
        link.setAttribute('href', domain);
        if (domain.includes('gstatic')) {
          link.setAttribute('crossorigin', 'anonymous');
        }
        document.head.appendChild(link);
      }
    });

    return () => {
      // Cleanup function if needed
    };
  }, [fullTitle, description, keywords, canonicalUrl, type, ogImage, ogUrl, siteTitle, structuredData, noIndex, allAlternateUrls]);

  return null;
};

// Enhanced analytics hook with performance optimization
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
        // Send to Google Analytics 4
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', eventType, {
            ...data,
            custom_parameter_1: 'quantforge_ai',
            custom_parameter_2: pageType,
            send_to: 'G-XXXXXXXXXX' // Replace with actual GA4 measurement ID
          });
        }

        // Send to data layer for GTM
        if (typeof window !== 'undefined' && (window as any).dataLayer) {
          (window as any).dataLayer.push({
            event: eventType,
            ...data
          });
        }

        // Log for debugging
        if (process.env['NODE_ENV'] === 'development') {
          console.debug('Analytics Event:', eventType, data);
        }
      } catch (error) {
        // Silent fail to not break user experience
      }
    }, delay);
  }, [enabled, pageType]);

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

  // Track Core Web Vitals
  useEffect(() => {
    if (!enabled) return;

    const trackPerformance = () => {
      if ('performance' in window) {
        // Track navigation timing
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          sendAnalyticsEvent('page_load_time', {
            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            page: pageTitle,
            url: pageUrl
          });
        }

        // Track Largest Contentful Paint (LCP)
        if ('PerformanceObserver' in window) {
          try {
            const observer = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              if (lastEntry) {
                sendAnalyticsEvent('lcp', {
                  value: Math.round(lastEntry.startTime),
                  page: pageTitle,
                  url: pageUrl
                });
              }
            });
            observer.observe({ entryTypes: ['largest-contentful-paint'] });
          } catch (error) {
            // LCP not supported
          }
        }
      }
    };

    // Track after page loads
    if (document.readyState === 'complete') {
      trackPerformance();
    } else {
      window.addEventListener('load', trackPerformance);
      return () => window.removeEventListener('load', trackPerformance);
    }
    return undefined;
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
      totalTime: Date.now() - startTime.current,
      engagementScore: calculateEngagementScore(analyticsData.scrollDepth, analyticsData.timeOnPage, analyticsData.clicks)
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

// Calculate engagement score
const calculateEngagementScore = (depth: number, time: number, clickCount: number): number => {
  const depthScore = Math.min(depth / 100, 1) * 30;
  const timeScore = Math.min(time / 300, 1) * 40; // 5 minutes max
  const clickScore = Math.min(clickCount / 10, 1) * 30;
  return Math.round(depthScore + timeScore + clickScore);
};

// SEO Analytics component
export const SEOAnalytics: React.FC<SEOAnalyticsProps> = (props) => {
  useSEOAnalytics(props);
  return null;
};

// Enhanced structured data templates
export const structuredDataTemplates = {
  softwareApplication: {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "QuantForge AI",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "description": "Advanced MQL5 Trading Robot Generator powered by AI",
    "url": "https://quanforge.ai",
    "downloadUrl": "https://quanforge.ai/download",
    "softwareVersion": "1.0.0",
    "applicationSubCategory": [
      "Trading Software",
      "AI Tools",
      "Financial Technology",
      "Algorithmic Trading"
    ],
    "softwareHelp": {
      "@type": "CreativeWork",
      "url": "https://quanforge.ai/wiki"
    },
    "softwareRequirements": [
      "MetaTrader 5 Platform",
      "Internet Connection"
    ],
    "featureList": [
      "AI-Powered MQL5 Code Generation",
      "Visual Strategy Configuration",
      "Real-time Market Simulation",
      "Risk Analysis",
      "Strategy Backtesting",
      "Expert Advisor Creation",
      "Multi-Language Support",
      "Cloud Storage",
      "Advanced Analytics",
      "Monte Carlo Simulation"
    ],
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "QuantForge AI"
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "150",
      "bestRating": "5",
      "worstRating": "1"
    },
    "screenshot": [
      {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/screenshots/generator.png",
        "caption": "MQL5 Trading Robot Generator Interface"
      },
      {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/screenshots/chat-interface.png",
        "caption": "AI Strategy Discussion Interface"
      },
      {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/screenshots/backtesting.png",
        "caption": "Strategy Backtesting and Analysis"
      }
    ]
  },

  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "QuantForge AI",
    "description": "Advanced MQL5 Trading Robot Generator powered by AI",
    "url": "https://quanforge.ai",
    "logo": {
      "@type": "ImageObject",
      "url": "https://quanforge.ai/logo.png",
      "width": 512,
      "height": 512
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "availableLanguage": ["English", "Indonesian"]
    },
    "sameAs": [
      "https://twitter.com/quanforge",
      "https://github.com/quanforge",
      "https://linkedin.com/company/quanforge"
    ],
    "foundingDate": "2024",
    "areaServed": "Worldwide",
    "knowsAbout": [
      "MQL5 Programming",
      "MetaTrader 5",
      "Algorithmic Trading",
      "AI Code Generation",
      "Forex Trading",
      "Expert Advisors",
      "Trading Robots",
      "Financial Technology"
    ]
  },

  webPage: (name: string, description: string, url: string) => ({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": name,
    "description": description,
    "url": url,
    "dateModified": new Date().toISOString(),
    "datePublished": new Date().toISOString(),
    "lastReviewed": new Date().toISOString(),
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png",
        "width": 512,
        "height": 512
      }
    },
    "isPartOf": {
      "@type": "WebSite",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai",
      "description": "Advanced MQL5 Trading Robot Generator powered by AI"
    },
    "about": {
      "@type": "Thing",
      "name": "MQL5 Trading Robot Generation",
      "description": "Creating automated trading strategies using AI"
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [{
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://quanforge.ai"
      }]
    },
    "potentialAction": {
      "@type": "CreateAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://quanforge.ai/generator",
        "actionPlatform": [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform"
        ]
      },
      "result": {
        "@type": "SoftwareSourceCode",
        "name": "MQL5 Trading Robot",
        "programmingLanguage": "MQL5"
      }
    }
  }),

  article: (headline: string, description: string, url: string, author: string = 'QuantForge AI', datePublished?: string) => ({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": headline,
    "description": description,
    "url": url,
    "dateModified": new Date().toISOString(),
    "datePublished": datePublished || new Date().toISOString(),
    "author": {
      "@type": "Organization",
      "name": author
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    }
  }),

  breadcrumb: (breadcrumbs: Array<{ name: string; url: string }>) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.url,
      "image": index === breadcrumbs.length - 1 ? {
        "@type": "ImageObject",
        "url": `https://quanforge.ai/breadcrumbs/${crumb.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        "caption": crumb.name
      } : undefined
    }))
  }),

  faq: (questions: Array<{ question: string; answer: string }>) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": questions.map(q => ({
      "@type": "Question",
      "name": q.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": q.answer
      }
    }))
  }),

  howTo: (name: string, description: string, steps: Array<{ name: string; text: string }>) => ({
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": name,
    "description": description,
    "totalTime": "PT15M",
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": "USD",
      "value": "0"
    },
    "supply": [
      {
        "@type": "HowToSupply",
        "name": "MetaTrader 5 Platform",
        "estimatedCost": {
          "@type": "MonetaryAmount",
          "currency": "USD",
          "value": "0"
        }
      },
      {
        "@type": "HowToSupply", 
        "name": "Trading Account",
        "estimatedCost": {
          "@type": "MonetaryAmount",
          "currency": "USD",
          "value": "0"
        }
      }
    ],
    "tool": [
      {
        "@type": "HowToTool",
        "name": "QuantForge AI",
        "url": "https://quanforge.ai"
      }
    ],
    "step": steps.map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step.name,
      "text": step.text,
      "image": {
        "@type": "ImageObject",
        "url": `https://quanforge.ai/howto/step-${index + 1}.png`,
        "caption": step.name
      }
    })),
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png",
        "width": 512,
        "height": 512
      }
    }
  }),

  course: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "Course",
    "name": name,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "online",
      "instructor": {
        "@type": "Organization",
        "name": "QuantForge AI"
      }
    }
  }),

  videoObject: (name: string, description: string, thumbnailUrl: string, contentUrl?: string) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": name,
    "description": description,
    "thumbnailUrl": thumbnailUrl,
    "uploadDate": new Date().toISOString(),
    "contentUrl": contentUrl || "https://quanforge.ai/videos/",
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png"
      }
    }
  }),

  searchAction: () => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": "https://quanforge.ai",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://quanforge.ai/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  }),

website: (name: string, description: string, url: string) => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": name,
    "description": description,
    "url": url,
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${url}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  }),

  // Enhanced financial service schema
  financialService: {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    "name": "QuantForge AI Trading Robot Generation",
    "description": "AI-powered MQL5 trading robot generation and analysis services",
    "provider": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "serviceType": "Investment Services",
    "areaServed": "Worldwide",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "validFrom": "2024-01-01"
    },
    "audience": {
      "@type": "Audience",
      "audienceType": "Traders, Developers, Financial Institutions"
    },
    "serviceOutput": {
      "@type": "SoftwareSourceCode",
      "programmingLanguage": "MQL5",
      "name": "Trading Robot Code"
    }
  },

  // Enhanced course schema for educational content
  educationalCourse: {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "MQL5 Trading Robot Development with AI",
    "description": "Complete course on developing MQL5 trading robots using AI technology",
    "provider": {
      "@type": "Organization",
      "name": "QuantForge AI Academy",
      "url": "https://quanforge.ai/academy"
    },
    "educationalLevel": "Beginner to Advanced",
    "inLanguage": ["en", "id", "zh", "ja", "es", "fr", "de", "ko", "pt", "ru"],
    "about": ["MQL5 Programming", "Algorithmic Trading", "AI Integration"],
    "teaches": [
      "MQL5 Programming Fundamentals",
      "Trading Strategy Development",
      "AI-Powered Code Generation",
      "Risk Management",
      "Backtesting Techniques",
      "Performance Optimization"
    ],
    "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "online",
      "instructor": {
        "@type": "Organization",
        "name": "QuantForge AI"
      },
      "courseSchedule": {
        "@type": "Schedule",
        "repeatFrequency": "daily",
        "duration": "PT2H"
      }
    },
    "totalTime": "PT40H",
    "coursePrerequisites": "Basic programming knowledge recommended"
  },

  // Enhanced review schema
  aggregateReview: {
    "@context": "https://schema.org",
    "@type": "AggregateRating",
    "itemReviewed": {
      "@type": "SoftwareApplication",
      "name": "QuantForge AI",
      "applicationCategory": "FinanceApplication"
    },
    "ratingValue": "4.8",
    "reviewCount": "150",
    "bestRating": "5",
    "worstRating": "1",
    "ratingExplanation": "Highly rated by traders and developers worldwide for ease of use and powerful features"
  },

  // Enhanced video schema
  educationalVideo: (name: string, description: string, thumbnailUrl: string) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": name,
    "description": description,
    "thumbnailUrl": thumbnailUrl,
    "uploadDate": new Date().toISOString(),
    "duration": "PT10M",
    "contentUrl": "https://quanforge.ai/videos/",
    "embedUrl": "https://quanforge.ai/videos/embed/",
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png"
      }
    },
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "educationalUse": "instruction",
    "learningResourceType": "video",
    "audience": {
      "@type": "EducationalAudience",
      "educationalRole": "student"
    },
    "inLanguage": "en",
    "isAccessibleForFree": true,
    "isFamilyFriendly": true
  })
};

// Enhanced utility functions
export const generateSeoUrl = (title: string, id?: string, category?: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  const parts = [slug];
  if (category) parts.unshift(category);
  if (id) parts.push(id);
  
  return parts.join('/');
};

export const generateMetaDescription = (content: string, maxLength: number = 160): string => {
  const cleaned = content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/&[^;]+;/g, ' ') // Remove HTML entities
    .trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  // Try to break at word boundary
  const truncated = cleaned.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
};

export const generateTableOfContents = (content: string): Array<{
  id: string;
  title: string;
  level: number;
  anchor: string;
}> => {
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
  const headings: Array<{ id: string; title: string; level: number; anchor: string }> = [];
  let match;
  let index = 0;
  
  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1] || '1');
    const title = match[2]?.replace(/<[^>]*>/g, '').trim() || '';
    const anchor = title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    headings.push({
      id: `heading-${index}`,
      title,
      level,
      anchor: anchor || `heading-${index}`
    });
    index++;
  }
  
  return headings;
};

export const optimizeImageSrc = (src: string, width?: number, height?: number, quality: number = 80) => {
  // If using a CDN like Cloudinary or similar, you can optimize images here
  if (src.includes('cloudinary') || src.includes('imgix')) {
    const params = new URLSearchParams();
    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    params.append('q', quality.toString());
    params.append('auto', 'format');
    
    return `${src}?${params.toString()}`;
  }
  
  return src;
};

export const analyzeKeywordDensity = (text: string, keywords: string[]): Record<string, {
  density: number;
  count: number;
  prominence: number;
}> => {
  const words = text.toLowerCase().split(/\s+/);
  const totalWords = words.length;
  const firstWords = words.slice(0, 100); // First 100 words for prominence
  const results: Record<string, any> = {};
  
  keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    const count = words.filter(word => word.includes(keywordLower)).length;
    const density = totalWords > 0 ? (count / totalWords) * 100 : 0;
    const prominenceCount = firstWords.filter(word => word.includes(keywordLower)).length;
    const prominence = firstWords.length > 0 ? (prominenceCount / firstWords.length) * 100 : 0;
    
    results[keyword] = {
      density: Math.round(density * 100) / 100,
      count,
      prominence: Math.round(prominence * 100) / 100
    };
  });
  
  return results;
};

// Enhanced SEO utility functions
export const generateStructuredDataForPage = (pageType: string, pageData: any) => {
  switch (pageType) {
    case 'home':
      return [
        structuredDataTemplates.softwareApplication,
        structuredDataTemplates.organization,
        structuredDataTemplates.website(
          'QuantForge AI - Advanced MQL5 Trading Robot Generator',
          'Generate professional MQL5 trading robots using AI technology',
          'https://quanforge.ai'
        )
      ];
    case 'generator':
      return [
        structuredDataTemplates.softwareApplication,
        structuredDataTemplates.webPage(
          'MQL5 Trading Robot Generator',
          'Create professional trading robots with AI-powered code generation',
          'https://quanforge.ai/generator'
        )
      ];
    case 'wiki':
      return [
        structuredDataTemplates.educationalCourse,
        structuredDataTemplates.webPage(
          'Trading Robot Documentation',
          'Comprehensive guides for MQL5 trading robot development',
          'https://quanforge.ai/wiki'
        )
      ];
    case 'faq':
      return [
        structuredDataTemplates.faq(pageData.questions || []),
        structuredDataTemplates.webPage(
          'Frequently Asked Questions',
          'Common questions about QuantForge AI and MQL5 trading robots',
          'https://quanforge.ai/faq'
        )
      ];
    default:
      return [
        structuredDataTemplates.webPage(
          pageData.title || 'QuantForge AI',
          pageData.description || 'Advanced MQL5 Trading Robot Generator',
          pageData.url || 'https://quanforge.ai'
        )
      ];
  }
};

export const generateMetaTagsFromContent = (content: string, baseUrl: string = 'https://quanforge.ai') => {
  const title = extractTitle(content) || 'QuantForge AI';
  const description = generateMetaDescription(content);
  const keywords = extractKeywords(content);
  
  return {
    title,
    description,
    keywords,
    ogUrl: baseUrl,
    canonicalUrl: baseUrl,
    type: 'website' as const
  };
};

export const extractTitle = (content: string): string | null => {
  const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
  return titleMatch ? titleMatch[1]?.replace(/<[^>]*>/g, '').trim() || null : null;
};

export const extractKeywords = (content: string): string => {
  const text = content.replace(/<[^>]*>/g, '').toLowerCase();
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'];
  
  const words = text.split(/\s+/).filter(word => 
    word.length > 3 && 
    !commonWords.includes(word) &&
    !/^\d+$/.test(word)
  );
  
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  const sortedWords = Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
  
  const tradingKeywords = ['mql5', 'trading', 'robot', 'ai', 'algorithmic', 'forex', 'metatrader', 'expert', 'advisor', 'quantitative'];
  const filteredKeywords = sortedWords.filter(word => 
    tradingKeywords.some(keyword => word.includes(keyword))
  );
  
  return [...filteredKeywords, ...sortedWords.slice(0, 5)].join(', ');
};

export const calculateReadabilityScore = (text: string): {
  score: number;
  level: string;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
} => {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = words.reduce((sum, word) => sum + countSyllables(word), 0) / words.length;
  
  // Flesch Reading Ease Score
  const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
  
  let level = '';
  if (score >= 90) level = 'Very Easy';
  else if (score >= 80) level = 'Easy';
  else if (score >= 70) level = 'Fairly Easy';
  else if (score >= 60) level = 'Standard';
  else if (score >= 50) level = 'Fairly Difficult';
  else if (score >= 30) level = 'Difficult';
  else level = 'Very Difficult';
  
  return {
    score: Math.round(score),
    level,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10
  };
};

const countSyllables = (word: string): number => {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  
  const vowels = 'aeiouy';
  let syllableCount = 0;
  let previousWasVowel = false;
  
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    if (char) {
      const isVowel = vowels.includes(char);
      if (isVowel && !previousWasVowel) {
        syllableCount++;
      }
      previousWasVowel = isVowel;
    }
  }
  
  // Adjust for silent 'e'
  if (word.endsWith('e') && syllableCount > 1) {
    syllableCount--;
  }
  
  return Math.max(1, syllableCount);
};

export const generateInternalLinks = (content: string, sitePages: Array<{ title: string; url: string; keywords: string[] }>): Array<{
  text: string;
  url: string;
  relevance: number;
}> => {
  const contentWords = content.toLowerCase().split(/\s+/);
  const links: Array<{ text: string; url: string; relevance: number }> = [];
  
  sitePages.forEach(page => {
    let relevance = 0;
    const pageKeywords = page.keywords.map(k => k.toLowerCase());
    
    pageKeywords.forEach(keyword => {
      const count = contentWords.filter(word => word.includes(keyword)).length;
      relevance += count;
    });
    
    if (relevance > 0) {
      links.push({
        text: page.title,
        url: page.url,
        relevance
      });
    }
  });
  
  return links.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
};

// Core Web Vitals monitoring utility (without external dependency)
export const trackCoreWebVitals = () => {
  if (typeof window === 'undefined') return;
  
  const sendToAnalytics = (name: string, value: number, id: string) => {
    // Send to Google Analytics or other analytics service
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', name, {
        value: Math.round(value),
        event_category: 'Web Vitals',
        event_label: id,
        non_interaction: true,
      });
    }
    
    // Log for debugging
    if (process.env['NODE_ENV'] === 'development') {
      console.debug(`[Web Vitals] ${name}:`, Math.round(value), { id });
    }
  };
  
  // Track Largest Contentful Paint (LCP)
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          sendToAnalytics('LCP', lastEntry.startTime, 'lcp-metric');
        }
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      // LCP not supported
    }
  }
  
  // Track First Input Delay (FID)
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.processingStart && entry.startTime) {
            const fid = entry.processingStart - entry.startTime;
            sendToAnalytics('FID', fid, 'fid-metric');
          }
        });
      });
      observer.observe({ entryTypes: ['first-input'] });
    } catch (error) {
      // FID not supported
    }
  }
  
  // Track Cumulative Layout Shift (CLS)
  if ('PerformanceObserver' in window) {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        sendToAnalytics('CLS', clsValue * 1000, 'cls-metric'); // Convert to smaller units
      });
      observer.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      // CLS not supported
    }
  }
  
  // Track Time to First Byte (TTFB)
  if ('performance' in window && 'getEntriesByType' in performance) {
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation && navigation.responseStart && navigation.requestStart) {
        const ttfb = navigation.responseStart - navigation.requestStart;
        sendToAnalytics('TTFB', ttfb, 'ttfb-metric');
      }
    } catch (error) {
      // TTFB not available
    }
  }
};

// Export default for backward compatibility
export default SEOHead;