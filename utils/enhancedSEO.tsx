import React, { useEffect, useState, useRef, useMemo } from 'react';
import { SEOHead, structuredDataTemplates, SEOAnalytics } from './seoUnified';

interface EnhancedSEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  type?: 'website' | 'article' | 'software';
  structuredData?: Record<string, any>[];
  enableAnalytics?: boolean;
  pageType?: 'homepage' | 'generator' | 'dashboard' | 'wiki' | 'blog' | 'faq' | 'other';
  customMeta?: Record<string, string>;
  jsonLd?: Record<string, any>[];
  alternateLanguages?: Record<string, string>;
  noIndex?: boolean;
  lastModified?: string;
  author?: string;
  publishedDate?: string;
  category?: string;
  tags?: string[];
}

interface PageSEOData {
  title: string;
  description: string;
  keywords: string[];
  structuredData: Record<string, any>[];
  breadcrumbs: Array<{ name: string; url: string }>;
}

interface SEOAnalyticsProps {
  pageUrl: string;
  pageTitle: string;
  pageType?: 'article' | 'product' | 'homepage' | 'other';
}

const SEO_CONFIG = {
  siteName: 'QuantForge AI',
  siteUrl: 'https://quanforge.ai',
  defaultImage: '/og-image.png',
  twitterHandle: '@quanforge',
  author: 'QuantForge AI',
  themeColor: '#22c55e',
  language: 'en',
  locale: 'en_US'
};

const PAGE_SEO_CONFIGS: Record<string, Partial<PageSEOData>> = {
  homepage: {
    title: 'QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5',
    description: 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5.',
    keywords: [
      'MQL5 generator', 'MetaTrader 5', 'trading robot', 'Expert Advisor', 'AI trading',
      'automated trading', 'forex robot', 'algorithmic trading', 'Gemini AI', 'trading strategy generator',
      'MT5 EA', 'quantitative trading', 'forex EA', 'MQL5 EA builder', 'automated forex trading',
      'AI trading bot', 'MetaTrader expert advisor', 'trading algorithm generator'
    ],
    breadcrumbs: [{ name: 'Home', url: 'https://quanforge.ai/' }]
  },
  generator: {
    title: 'Create Trading Robot - AI-Powered MQL5 Generator',
    description: 'Create professional MQL5 trading robots using AI. Describe your strategy and generate Expert Advisors for MetaTrader 5 with visual configuration.',
    keywords: [
      'MQL5 generator', 'trading robot creator', 'Expert Advisor builder', 'AI trading strategy',
      'MetaTrader 5 robot', 'forex EA builder', 'automated trading bot', 'MT5 expert advisor'
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://quanforge.ai/' },
      { name: 'Generator', url: 'https://quanforge.ai/generator' }
    ]
  },
  dashboard: {
    title: 'Dashboard - Trading Robots Management',
    description: 'Manage your MQL5 trading robots and Expert Advisors. View, edit, duplicate, and analyze your automated trading strategies.',
    keywords: [
      'trading robot dashboard', 'MQL5 management', 'Expert Advisor dashboard',
      'automated trading portfolio', 'forex robot management', 'MT5 EA portfolio'
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://quanforge.ai/' },
      { name: 'Dashboard', url: 'https://quanforge.ai/' }
    ]
  },
  wiki: {
    title: 'Documentation - MQL5 Trading Robot Development Guide',
    description: 'Comprehensive documentation for MQL5 trading robot development. Learn best practices, strategies, and advanced techniques.',
    keywords: [
      'MQL5 documentation', 'trading robot tutorial', 'Expert Advisor guide',
      'MetaTrader 5 programming', 'algorithmic trading guide', 'forex robot development'
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://quanforge.ai/' },
      { name: 'Wiki', url: 'https://quanforge.ai/wiki' }
    ]
  },
  faq: {
    title: 'FAQ - QuantForge AI Trading Robot Generator',
    description: 'Frequently asked questions about QuantForge AI. Learn how to create MQL5 trading robots, pricing, features, and technical support.',
    keywords: [
      'QuantForge AI FAQ', 'MQL5 generator questions', 'trading robot help',
      'Expert Advisor FAQ', 'MetaTrader 5 support', 'AI trading bot questions'
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://quanforge.ai/' },
      { name: 'FAQ', url: 'https://quanforge.ai/faq' }
    ]
  }
};

export const EnhancedSEO: React.FC<EnhancedSEOProps> = ({
  title,
  description,
  keywords,
  ogImage = SEO_CONFIG.defaultImage,
  ogUrl,
  canonicalUrl,
  type = 'website',
  structuredData = [],
  enableAnalytics = true,
  pageType = 'other',
  customMeta = {},
  jsonLd = [],
  alternateLanguages = {},
  noIndex = false,
  lastModified,
  author = SEO_CONFIG.author,
  publishedDate,
  category,
  tags = []
}) => {
  // Get page-specific configuration
  const pageConfig = useMemo(() => PAGE_SEO_CONFIGS[pageType] || {}, [pageType]);
  
  // Merge props with page configuration
  const finalTitle = title || pageConfig.title || SEO_CONFIG.siteName;
  const finalDescription = description || pageConfig.description || '';
  const finalKeywords = keywords || pageConfig.keywords?.join(', ') || '';
  const finalCanonicalUrl = canonicalUrl || ogUrl || SEO_CONFIG.siteUrl;
  const finalBreadcrumbs = pageConfig.breadcrumbs || [];
  
  // Generate enhanced structured data
  const enhancedStructuredData = useMemo(() => {
    const data = [...structuredData];
    
    // Add basic structured data based on page type
    if (pageType === 'homepage') {
      data.push(structuredDataTemplates.softwareApplication);
      data.push(structuredDataTemplates.localBusiness);
      data.push(structuredDataTemplates.webPage(finalTitle, finalDescription, finalCanonicalUrl));
    } else if (pageType === 'generator') {
      data.push(structuredDataTemplates.softwareApplication);
      data.push(structuredDataTemplates.breadcrumb(finalBreadcrumbs));
      data.push(structuredDataTemplates.howTo(
        'Create a Trading Robot with QuantForge AI',
        finalDescription,
        [
          { name: 'Describe Your Strategy', text: 'Explain your trading strategy in natural language.' },
          { name: 'Configure Parameters', text: 'Set risk management, timeframes, and symbols.' },
          { name: 'Generate Code', text: 'AI generates professional MQL5 code.' },
          { name: 'Test & Deploy', text: 'Validate and deploy to MetaTrader 5.' }
        ]
      ));
    } else if (pageType === 'dashboard') {
      data.push(structuredDataTemplates.breadcrumb(finalBreadcrumbs));
      data.push(structuredDataTemplates.webPage(finalTitle, finalDescription, finalCanonicalUrl));
    } else if (pageType === 'wiki') {
      data.push(structuredDataTemplates.breadcrumb(finalBreadcrumbs));
      data.push(structuredDataTemplates.course(finalTitle, finalDescription));
    } else if (pageType === 'faq') {
      data.push(structuredDataTemplates.breadcrumb(finalBreadcrumbs));
      data.push(structuredDataTemplates.faq([
        {
          question: 'What is QuantForge AI?',
          answer: 'QuantForge AI is an advanced platform that uses artificial intelligence to generate MQL5 trading robots for MetaTrader 5.'
        },
        {
          question: 'How does the AI generate trading robots?',
          answer: 'Our AI analyzes your strategy description and generates professional MQL5 code using Google Gemini models.'
        },
        {
          question: 'Is QuantForge AI free to use?',
          answer: 'Yes, QuantForge AI offers free access to generate and test trading robots.'
        },
        {
          question: 'What programming language does QuantForge AI use?',
          answer: 'QuantForge AI generates MQL5 (MetaQuotes Language 5) code, which is the native language for MetaTrader 5 trading platforms.'
        },
        {
          question: 'Can I customize the generated trading robots?',
          answer: 'Yes, you can customize risk parameters, timeframes, trading symbols, and other settings through our visual interface.'
        },
        {
          question: 'Does QuantForge AI support backtesting?',
          answer: 'Yes, QuantForge AI includes built-in backtesting tools and Monte Carlo simulation to validate your trading strategies.'
        },
        {
          question: 'What types of trading strategies can I create?',
          answer: 'You can create various strategies including scalping, trend following, grid trading, martingale, and custom algorithmic strategies.'
        },
        {
          question: 'Is my trading data secure?',
          answer: 'Yes, all trading data and strategies are encrypted and stored securely with enterprise-grade security measures.'
        }
      ]));
    }
    
    // Add custom JSON-LD data
    data.push(...jsonLd);
    
    // Add article structured data for blog-like content
    if (pageType === 'blog' || publishedDate) {
      data.push(structuredDataTemplates.article(
        finalTitle,
        finalDescription,
        finalCanonicalUrl
      ));
    }
    
    // Add additional FAQ structured data if tags include FAQ-related terms
    if (tags.some(tag => tag.toLowerCase().includes('faq'))) {
      data.push(structuredDataTemplates.faq([
        {
          question: 'What is QuantForge AI?',
          answer: 'QuantForge AI is an advanced platform that uses artificial intelligence to generate MQL5 trading robots for MetaTrader 5.'
        },
        {
          question: 'How does the AI generate trading robots?',
          answer: 'Our AI analyzes your strategy description and generates professional MQL5 code using Google Gemini models.'
        },
        {
          question: 'Is QuantForge AI free to use?',
          answer: 'Yes, QuantForge AI offers free access to generate and test trading robots.'
        }
      ]));
    }
    
    return data;
  }, [pageType, finalTitle, finalDescription, finalCanonicalUrl, finalBreadcrumbs, structuredData, jsonLd, publishedDate, tags]);
  
  // Generate alternate language links
  const alternateLanguageLinks = useMemo(() => {
    const links: Array<{ rel: string; hrefLang: string; href: string }> = [];
    
    // Add default alternate languages
    links.push({ rel: 'alternate', hrefLang: 'en', href: finalCanonicalUrl });
    links.push({ rel: 'alternate', hrefLang: 'x-default', href: finalCanonicalUrl });
    links.push({ rel: 'alternate', hrefLang: 'id', href: `${finalCanonicalUrl}?lang=id` });
    
    // Add custom alternate languages
    Object.entries(alternateLanguages).forEach(([lang, url]) => {
      links.push({ rel: 'alternate', hrefLang: lang, href: url });
    });
    
    return links;
  }, [finalCanonicalUrl, alternateLanguages]);
  
  // SEO analytics component
  const analyticsComponent = enableAnalytics ? (
    <SEOAnalytics
      pageUrl={finalCanonicalUrl}
      pageTitle={finalTitle}
      pageType={pageType === 'homepage' ? 'homepage' : pageType === 'blog' ? 'article' : 'other'}
    />
  ) : null;
  
  // Update meta tags dynamically
  useEffect(() => {
    // Update document title
    document.title = finalTitle.includes(SEO_CONFIG.siteName) ? finalTitle : `${finalTitle} | ${SEO_CONFIG.siteName}`;
    
    // Update or create meta tags
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
    
    // Basic meta tags
    updateMetaTag('description', finalDescription);
    updateMetaTag('keywords', finalKeywords);
    updateMetaTag('author', author);
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    
    if (lastModified) {
      updateMetaTag('last-modified', lastModified);
    }
    
    if (publishedDate) {
      updateMetaTag('article:published_time', publishedDate);
    }
    
    if (category) {
      updateMetaTag('article:section', category);
    }
    
    // Add tags as article:tag meta tags
    tags.forEach(tag => {
      updateMetaTag('article:tag', tag);
    });
    
    // Open Graph tags
    updateMetaTag('og:title', finalTitle, 'og:title');
    updateMetaTag('og:description', finalDescription, 'og:description');
    updateMetaTag('og:type', type, 'og:type');
    updateMetaTag('og:image', ogImage, 'og:image');
    updateMetaTag('og:url', finalCanonicalUrl, 'og:url');
    updateMetaTag('og:site_name', SEO_CONFIG.siteName, 'og:site_name');
    updateMetaTag('og:locale', SEO_CONFIG.locale, 'og:locale');
    
    if (author) {
      updateMetaTag('article:author', author, 'article:author');
    }
    
    if (publishedDate) {
      updateMetaTag('article:published_time', publishedDate, 'article:published_time');
    }
    
    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', finalTitle);
    updateMetaTag('twitter:description', finalDescription);
    updateMetaTag('twitter:image', ogImage);
    updateMetaTag('twitter:site', SEO_CONFIG.twitterHandle);
    updateMetaTag('twitter:creator', SEO_CONFIG.twitterHandle);
    
    // Technical meta tags
    updateMetaTag('theme-color', SEO_CONFIG.themeColor);
    updateMetaTag('language', SEO_CONFIG.language);
    updateMetaTag('distribution', 'global');
    updateMetaTag('rating', 'general');
    updateMetaTag('revisit-after', '7 days');
    updateMetaTag('geo.region', 'US');
    updateMetaTag('geo.placename', 'Global');
    updateMetaTag('category', 'finance, technology, trading, artificial intelligence');
    updateMetaTag('coverage', 'Worldwide');
    updateMetaTag('target', 'all');
    
    // Custom meta tags
    Object.entries(customMeta).forEach(([name, content]) => {
      updateMetaTag(name, content);
    });
    
    // Canonical URL
    let canonical: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', finalCanonicalUrl);
    
    // Alternate language links
    alternateLanguageLinks.forEach(({ rel, hrefLang, href }) => {
      let link: HTMLLinkElement | null = document.querySelector(`link[rel="${rel}"][hreflang="${hrefLang}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', rel);
        link.setAttribute('hreflang', hrefLang);
        document.head.appendChild(link);
      }
      link.setAttribute('href', href);
    });
    
    // Clean up and add structured data
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => script.remove());
    
    enhancedStructuredData.forEach((data) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });
  }, [
    finalTitle,
    finalDescription,
    finalKeywords,
    author,
    noIndex,
    lastModified,
    publishedDate,
    category,
    tags,
    type,
    ogImage,
    finalCanonicalUrl,
    customMeta,
    alternateLanguageLinks,
    enhancedStructuredData,
    finalBreadcrumbs
  ]);
  
  return (
    <>
      {analyticsComponent}
      <SEOHead
        title={finalTitle}
        description={finalDescription}
        keywords={finalKeywords}
        ogImage={ogImage}
        ogUrl={finalCanonicalUrl}
        canonicalUrl={finalCanonicalUrl}
        type={type}
        structuredData={enhancedStructuredData}
      />
    </>
  );
};

// Hook for accessing page SEO data
export const usePageSEO = () => {
  const [pageData, setPageData] = useState<PageSEOData | null>(null);
  
  useEffect(() => {
    // This would typically be populated by the EnhancedSEO component
    // For now, return a default structure
    setPageData({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      keywords: [],
      structuredData: [],
      breadcrumbs: []
    });
  }, []);
  
  return pageData;
};

// Helper function to generate SEO-friendly URLs
export const generateSEOFriendlyUrl = (title: string, basePath: string = ''): string => {
  const urlFriendly = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return basePath ? `${basePath}/${urlFriendly}` : urlFriendly;
};

// Helper function to generate structured data for blog posts
export const generateBlogStructuredData = (
  title: string,
  description: string,
  url: string,
  author: string,
  publishDate: string,
  imageUrl?: string
) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    image: imageUrl || `${SEO_CONFIG.siteUrl}/og-image.png`,
    url,
    datePublished: publishDate,
    dateModified: new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: author
    },
    publisher: {
      '@type': 'Organization',
      name: SEO_CONFIG.siteName,
      logo: {
        '@type': 'ImageObject',
        url: `${SEO_CONFIG.siteUrl}/logo.png`,
        width: 512,
        height: 512
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url
    }
  };
};

// Helper function to generate product structured data
export const generateProductStructuredData = (
  name: string,
  description: string,
  price: string,
  currency: string = 'USD',
  availability: string = 'InStock'
) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    brand: {
      '@type': 'Brand',
      name: SEO_CONFIG.siteName
    },
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: currency,
      availability: `https://schema.org/${availability}`,
      seller: {
        '@type': 'Organization',
        name: SEO_CONFIG.siteName
      }
    }
  };
};

export const EnhancedSEOAnalytics: React.FC<SEOAnalyticsProps> = ({ 
  pageUrl, 
  pageTitle, 
  pageType = 'other' 
}) => {
  const [scrollDepth, setScrollDepth] = useState(0);
  const [timeOnPage, setTimeOnPage] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [clicks, setClicks] = useState(0);
  const [formInteractions, setFormInteractions] = useState(0);
  const startTime = useRef(Date.now());
  const lastScrollPosition = useRef(0);

  // Track scroll depth with enhanced precision
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollPercentage = Math.round((scrollTop / (documentHeight - windowHeight)) * 100);
      
      // Track scroll milestones
      if (scrollPercentage > scrollDepth) {
        setScrollDepth(scrollPercentage);
        
        // Send scroll milestone events
        if (scrollPercentage === 25 || scrollPercentage === 50 || 
            scrollPercentage === 75 || scrollPercentage === 90) {
          sendAnalyticsEvent('scroll_milestone', {
            depth: scrollPercentage,
            page: pageTitle,
            url: pageUrl
          });
        }
      }
      
      lastScrollPosition.current = scrollTop;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollDepth, pageTitle, pageUrl]);

  // Track time on page with visibility API
  useEffect(() => {
    const timer = setInterval(() => {
      if (isVisible && !document.hidden) {
        setTimeOnPage(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible]);

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasVisible = isVisible;
      setIsVisible(!document.hidden);
      
      // Send engagement data when page becomes hidden
      if (wasVisible && document.hidden) {
        sendEngagementData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isVisible]);

  // Track user interactions
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      setClicks(prev => prev + 1);
      
      // Track click on important elements
      const target = e.target as HTMLElement;
      const elementData = {
        tagName: target.tagName,
        className: target.className,
        id: target.id,
        textContent: target.textContent?.substring(0, 50)
      };
      
      sendAnalyticsEvent('user_click', {
        element: elementData,
        page: pageTitle,
        url: pageUrl
      });
    };

    const handleFormInteraction = (e: Event) => {
      setFormInteractions(prev => prev + 1);
      
      const target = e.target as HTMLElement;
      sendAnalyticsEvent('form_interaction', {
        elementType: target.tagName,
        elementName: (target as HTMLInputElement).name || 'unknown',
        page: pageTitle,
        url: pageUrl
      });
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('focus', handleFormInteraction, true);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('focus', handleFormInteraction, true);
    };
  }, [pageTitle, pageUrl]);

  // Send engagement data on page unload
  useEffect(() => {
    const handlePageUnload = () => {
      sendEngagementData();
    };

    window.addEventListener('beforeunload', handlePageUnload);
    return () => window.removeEventListener('beforeunload', handlePageUnload);
  }, [pageUrl, pageTitle, scrollDepth, timeOnPage]);

  // Track Core Web Vitals (basic implementation without external library)
  useEffect(() => {
    // Basic performance tracking without external dependencies
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
  }, [pageTitle, pageUrl]);

  const sendMetric = (metric: any) => {
    sendAnalyticsEvent('web_vital', {
      name: metric.name,
      value: metric.value,
      id: metric.id,
      page: pageTitle,
      url: pageUrl
    });
  };
  
  // Prevent unused variable warning
  void sendMetric;

  const sendEngagementData = () => {
    const totalTime = Math.round((Date.now() - startTime.current) / 1000);
    
    sendAnalyticsEvent('page_engagement', {
      page_title: pageTitle,
      page_location: pageUrl,
      page_type: pageType,
      scroll_depth: scrollDepth,
      time_on_page: totalTime,
      active_time: timeOnPage,
      total_clicks: clicks,
      form_interactions: formInteractions,
      engagement_score: calculateEngagementScore(scrollDepth, timeOnPage, clicks)
    });
  };

  const calculateEngagementScore = (depth: number, time: number, clickCount: number): number => {
    const depthScore = Math.min(depth / 100, 1) * 30;
    const timeScore = Math.min(time / 300, 1) * 40; // 5 minutes max
    const clickScore = Math.min(clickCount / 10, 1) * 30;
    return Math.round(depthScore + timeScore + clickScore);
  };

  const sendAnalyticsEvent = (eventName: string, data: Record<string, any>) => {
    // Send to Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, {
        ...data,
        custom_parameter_1: 'quantforge_ai',
        custom_parameter_2: pageType
      });
    }

    // Send to other analytics services if available
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: eventName,
        ...data
      });
    }

    // Analytics event tracked
  };

  return null; // This component doesn't render anything
};

// Enhanced structured data generator
export const generateEnhancedStructuredData = (
  type: string, 
  data: Record<string, any>,
  additionalData?: Record<string, any>
) => {
  const baseSchema = {
    "@context": "https://schema.org",
    "@type": type,
    ...data,
    ...additionalData,
    "dateModified": new Date().toISOString()
  };

  return JSON.stringify(baseSchema);
};

// Lazy loading component with intersection observer
export const OptimizedImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  srcSet?: string;
}> = ({ 
  src, 
  alt, 
  className, 
  width, 
  height, 
  loading = 'lazy',
  sizes,
  srcSet
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (imgRef.current && loading === 'lazy') {
      observer.observe(imgRef.current);
    } else {
      setIsInView(true);
    }

    return () => observer.disconnect();
  }, [loading]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  if (hasError) {
    return (
      <div 
        className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <span className="text-gray-500 text-sm">Failed to load image</span>
      </div>
    );
  }

  return (
    <div ref={imgRef} className={className}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          sizes={sizes}
          srcSet={srcSet}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
          className="w-full h-full object-cover"
        />
      )}
      {!isLoaded && isInView && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
      )}
    </div>
  );
};

// Preload critical resources
export const preloadCriticalResources = (resources: Array<{
  href: string;
  as: string;
  type?: string;
  crossOrigin?: string;
}>) => {
  resources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource.href;
    link.as = resource.as;
    if (resource.type) link.type = resource.type;
    if (resource.crossOrigin) link.crossOrigin = resource.crossOrigin;
    document.head.appendChild(link);
  });
};

// Generate SEO-friendly URLs with better handling
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

// Enhanced meta description generator
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

// Advanced keyword density analyzer
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

// Generate table of contents with anchor links
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

// Schema.org WebSite generator with search action
export const generateWebsiteSchema = (siteName: string, siteUrl: string, siteDescription?: string) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": siteName,
  "url": siteUrl,
  ...(siteDescription && { "description": siteDescription }),
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": `${siteUrl}/search?q={search_term_string}`
    },
    "query-input": "required name=search_term_string"
  }
});

// Generate FAQ schema for better SEO
export const generateFAQSchema = (faqs: Array<{ question: string; answer: string }>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(faq => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer
    }
  }))
});

// Open Graph optimizer for social media
export const optimizeOpenGraph = (title: string, description: string, url: string, image?: string) => ({
  'og:title': title,
  'og:description': description,
  'og:url': url,
  'og:type': 'website',
  'og:image': image || '/og-image.png',
  'og:image:width': '1200',
  'og:image:height': '630',
  'og:site_name': 'QuantForge AI',
  'og:locale': 'en_US'
});

// Twitter Card optimizer
export const optimizeTwitterCard = (title: string, description: string, image?: string) => ({
  'twitter:card': 'summary_large_image',
  'twitter:title': title,
  'twitter:description': description,
  'twitter:image': image || '/twitter-image.png',
  'twitter:site': '@quanforge',
  'twitter:creator': '@quanforge'
});

// Enhanced structured data templates for better SEO
export const enhancedStructuredDataTemplates = {
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

  financialProduct: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "name": name,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "category": "Trading Software",
    "audience": {
      "@type": "Audience",
      "audienceType": "Traders, Developers, Investors"
    }
  }),

  educationalOrganization: {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "QuantForge AI Academy",
    "description": "Learn MQL5 programming and algorithmic trading with AI-powered tools",
    "url": "https://quanforge.ai/wiki",
    "provider": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Trading Education Courses",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Course",
            "name": "MQL5 Programming Basics",
            "description": "Learn the fundamentals of MQL5 programming"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Course",
            "name": "Algorithmic Trading Strategies",
            "description": "Master advanced trading strategies"
          }
        }
      ]
    }
  },

  videoObject: (name: string, description: string, thumbnailUrl: string) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": name,
    "description": description,
    "thumbnailUrl": thumbnailUrl,
    "uploadDate": new Date().toISOString(),
    "contentUrl": "https://quanforge.ai/videos/",
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png"
      }
    }
  }),

  quoraQuestion: (name: string, text: string, answerCount: number) => ({
    "@context": "https://schema.org",
    "@type": "Question",
    "name": name,
    "text": text,
    "answerCount": answerCount,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "QuantForge AI provides the best solution for generating MQL5 trading robots using advanced AI technology.",
      "author": {
        "@type": "Organization",
        "name": "QuantForge AI"
      }
    },
    "suggestedAnswer": [
      {
        "@type": "Answer",
        "text": "You can create professional trading robots by describing your strategy in natural language.",
        "author": {
          "@type": "Organization",
          "name": "QuantForge AI"
        }
      }
    ]
  }),

  dataset: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": name,
    "description": description,
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "license": "https://creativecommons.org/licenses/by/4.0/",
    "distribution": [
      {
        "@type": "DataDownload",
        "encodingFormat": "application/json",
        "contentUrl": "https://quanforge.ai/api/data"
      }
    ]
  }),

  creativeWork: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "name": name,
    "description": description,
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png"
      }
    },
    "dateModified": new Date().toISOString(),
    "datePublished": new Date().toISOString()
  }),

  service: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    "name": name,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "serviceType": "Software Development",
    "areaServed": "Worldwide",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Trading Robot Generation Services",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "MQL5 Robot Generation",
            "description": "AI-powered MQL5 trading robot generation"
          },
          "price": "0",
          "priceCurrency": "USD"
        }
      ]
    }
  }),

  review: (itemReviewed: string, reviewBody: string, author: string, rating: number) => ({
    "@context": "https://schema.org",
    "@type": "Review",
    "itemReviewed": {
      "@type": "SoftwareApplication",
      "name": itemReviewed,
      "applicationCategory": "FinanceApplication"
    },
    "reviewBody": reviewBody,
    "author": {
      "@type": "Person",
      "name": author
    },
    "datePublished": new Date().toISOString(),
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": rating.toString(),
      "bestRating": "5",
      "worstRating": "1"
    }
  }),

  event: (name: string, description: string, startDate: string, endDate: string) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    "name": name,
    "description": description,
    "startDate": startDate,
    "endDate": endDate,
    "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
    "eventStatus": "https://schema.org/EventScheduled",
    "location": {
      "@type": "VirtualLocation",
      "url": "https://quanforge.ai"
    },
    "organizer": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    }
  }),

  person: (name: string, jobTitle: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "Person",
    "name": name,
    "jobTitle": jobTitle,
    "description": description,
    "worksFor": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "sameAs": [
      "https://linkedin.com/in/" + name.toLowerCase().replace(/\s+/g, ''),
      "https://twitter.com/" + name.toLowerCase().replace(/\s+/g, '')
    ]
  }),

  book: (name: string, description: string, author: string) => ({
    "@context": "https://schema.org",
    "@type": "Book",
    "name": name,
    "description": description,
    "author": {
      "@type": "Person",
      "name": author
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI Publishing"
    },
    "datePublished": new Date().toISOString(),
    "inLanguage": "en",
    "genre": ["Technology", "Finance", "Programming"],
    "keywords": "MQL5, Trading, Algorithmic Trading, MetaTrader 5"
  }),

  recipe: (name: string, description: string, ingredients: string[], instructions: string[]) => ({
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": name,
    "description": description,
    "recipeIngredient": ingredients,
    "recipeInstructions": instructions.map((instruction, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "text": instruction
    })),
    "recipeCategory": "Technology",
    "recipeCuisine": "Algorithmic Trading"
  })
};