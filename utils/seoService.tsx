import React, { useEffect, useState, useRef, useCallback } from 'react';

// Enhanced SEO interfaces
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
  customMeta?: Record<string, string>;
  lastModified?: string;
  author?: string;
  publishedDate?: string;
  category?: string;
  tags?: string[];
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

interface SEOConfig {
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultKeywords: string;
  baseUrl: string;
  ogImage: string;
  twitterHandle: string;
  author: string;
  themeColor: string;
  language: string;
  locale: string;
}

// Enhanced SEO Configuration
const SEO_CONFIG: SEOConfig = {
  siteName: 'QuantForge AI',
  defaultTitle: 'QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5',
  defaultDescription: 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5 with visual strategy configuration and real-time market simulation.',
  defaultKeywords: 'MQL5 generator, MetaTrader 5, trading robot, Expert Advisor, AI trading, automated trading, forex robot, algorithmic trading, Gemini AI, trading strategy generator, MT5 EA, quantitative trading, forex EA, MQL5 EA builder, automated forex trading, AI trading bot, MetaTrader expert advisor, trading algorithm generator, MQL5 development, forex algorithm, trading automation, AI-powered trading, forex robot development, MetaTrader automation',
  baseUrl: 'https://quanforge.ai',
  ogImage: '/og-image.png',
  twitterHandle: '@quanforge',
  author: 'QuantForge AI',
  themeColor: '#22c55e',
  language: 'en',
  locale: 'en_US'
};

// Enhanced SEO Head Component
export const SEOHead: React.FC<MetaTagsProps> = ({
  title,
  description,
  keywords,
  ogImage,
  ogUrl,
  canonicalUrl,
  type = 'website',
  structuredData = [],
  noIndex = false,
  alternateUrls = [],
  customMeta = {},
  lastModified,
  author = SEO_CONFIG.author,
  publishedDate,
  category,
  tags = []
}) => {
  const siteTitle = SEO_CONFIG.siteName;
  const fullTitle = title ? 
    (title.includes(siteTitle) ? title : `${title} | ${siteTitle}`) : 
    SEO_CONFIG.defaultTitle;

  const finalDescription = description || SEO_CONFIG.defaultDescription;
  const finalKeywords = keywords || SEO_CONFIG.defaultKeywords;
  const finalOgImage = ogImage || SEO_CONFIG.ogImage;
  const finalOgUrl = ogUrl || SEO_CONFIG.baseUrl;
  const finalCanonicalUrl = canonicalUrl || SEO_CONFIG.baseUrl;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, property?: string) => {
      const selector = property ? `meta[property="${property}"]` : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        if (property) {
          meta.setAttribute('property', property);
        } else {
          meta.setAttribute('name', name);
        }
        document.head.appendChild(meta);
      }
      
      meta.content = content;
    };

    // Basic meta tags
    updateMetaTag('description', finalDescription);
    updateMetaTag('keywords', finalKeywords);
    updateMetaTag('author', author);
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    
    // Enhanced meta tags
    updateMetaTag('language', SEO_CONFIG.language);
    updateMetaTag('geo.region', 'US');
    updateMetaTag('geo.placename', 'Global');
    updateMetaTag('distribution', 'global');
    updateMetaTag('rating', 'general');
    updateMetaTag('revisit-after', '7 days');
    updateMetaTag('category', category || 'finance, technology, trading, artificial intelligence');
    updateMetaTag('coverage', 'Worldwide');
    updateMetaTag('target', 'all');
    
    // Mobile optimization
    updateMetaTag('HandheldFriendly', 'True');
    updateMetaTag('MobileOptimized', '320');
    updateMetaTag('apple-mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');
    updateMetaTag('format-detection', 'telephone=no');
    updateMetaTag('mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-title', SEO_CONFIG.siteName);
    updateMetaTag('application-name', SEO_CONFIG.siteName);
    
    // Theme and branding
    updateMetaTag('theme-color', SEO_CONFIG.themeColor);
    updateMetaTag('msapplication-TileColor', SEO_CONFIG.themeColor);
    updateMetaTag('msapplication-config', '/browserconfig.xml');
    
    // Security and privacy
    updateMetaTag('referrer', 'no-referrer-when-downgrade');
    updateMetaTag('copyright', SEO_CONFIG.author);
    updateMetaTag('classification', 'Software');
    
    // Content classification
    updateMetaTag('content-language', SEO_CONFIG.language);
    updateMetaTag('content-type', 'text/html; charset=utf-8');
    
    // Date-related meta tags
    if (lastModified) {
      updateMetaTag('last-modified', lastModified);
    }
    
    if (publishedDate) {
      updateMetaTag('article:published_time', publishedDate);
      updateMetaTag('article:modified_time', new Date().toISOString());
    }
    
    if (category) {
      updateMetaTag('article:section', category);
    }
    
    // Add tags as article:tag meta tags
    tags.forEach(tag => {
      updateMetaTag('article:tag', tag);
    });
    
    // Custom meta tags
    Object.entries(customMeta).forEach(([name, content]) => {
      updateMetaTag(name, content);
    });

    // Open Graph tags (enhanced)
    updateMetaTag('og:title', fullTitle, 'property');
    updateMetaTag('og:description', finalDescription, 'property');
    updateMetaTag('og:image', finalOgImage, 'property');
    updateMetaTag('og:image:width', '1200', 'property');
    updateMetaTag('og:image:height', '630', 'property');
    updateMetaTag('og:image:alt', title || fullTitle, 'property');
    updateMetaTag('og:url', finalOgUrl, 'property');
    updateMetaTag('og:type', type, 'property');
    updateMetaTag('og:site_name', siteTitle, 'property');
    updateMetaTag('og:locale', SEO_CONFIG.locale, 'property');
    
    // Enhanced Open Graph tags for articles
    if (type === 'article') {
      updateMetaTag('article:author', author, 'property');
      updateMetaTag('article:section', category || 'Financial Technology', 'property');
      updateMetaTag('article:tag', tags.join(', '), 'property');
      if (publishedDate) {
        updateMetaTag('article:published_time', publishedDate, 'property');
        updateMetaTag('article:modified_time', new Date().toISOString(), 'property');
      }
    }
    
    // Facebook specific
    updateMetaTag('fb:app_id', 'your-facebook-app-id', 'property');

    // Twitter Card tags (enhanced)
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', finalDescription);
    updateMetaTag('twitter:image', finalOgImage);
    updateMetaTag('twitter:image:alt', title || fullTitle);
    updateMetaTag('twitter:site', SEO_CONFIG.twitterHandle);
    updateMetaTag('twitter:creator', SEO_CONFIG.twitterHandle);
    updateMetaTag('twitter:domain', 'quanforge.ai');

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.href = finalCanonicalUrl;
    
    // Alternate language links
    const existingAlternateLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existingAlternateLinks.forEach(link => link.remove());
    
    // Add default alternate languages
    const defaultAlternates = [
      { hrefLang: 'en', url: finalCanonicalUrl },
      { hrefLang: 'x-default', url: finalCanonicalUrl },
      { hrefLang: 'en-US', url: finalCanonicalUrl },
      { hrefLang: 'id', url: `${finalCanonicalUrl}?lang=id` }
    ];
    
    [...defaultAlternates, ...alternateUrls].forEach(alt => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', alt.hrefLang);
      link.setAttribute('href', alt.url);
      document.head.appendChild(link);
    });
    
    // DNS prefetch for performance
    const dnsPrefetchDomains = [
      '//fonts.googleapis.com',
      '//fonts.gstatic.com',
      '//cdn.tailwindcss.com',
      '//cdnjs.cloudflare.com',
      '//www.googletagmanager.com',
      '//connect.facebook.net',
      '//www.google-analytics.com',
      '//api.supabase.io'
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

    // Preconnect for critical resources
    const preconnectDomains = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://api.supabase.io'
    ];
    
    preconnectDomains.forEach(domain => {
      let link: HTMLLinkElement | null = document.querySelector(`link[rel="preconnect"][href="${domain}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'preconnect');
        link.setAttribute('href', domain);
        if (domain.includes('gstatic') || domain.includes('supabase')) {
          link.setAttribute('crossorigin', 'anonymous');
        }
        document.head.appendChild(link);
      }
    });

    // Clean up and add structured data
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => script.remove());

    if (structuredData.length > 0) {
      structuredData.forEach((data) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
      });
    }

    // Cleanup function
    return () => {
      // Optional: Clean up added tags if needed
    };
  }, [fullTitle, finalDescription, finalKeywords, finalOgImage, finalOgUrl, finalCanonicalUrl, type, structuredData, noIndex, alternateUrls, customMeta, lastModified, author, publishedDate, category, tags]);

  return null; // This component doesn't render anything
};

// Consolidated SEO Analytics Hook
export const useSEOAnalytics = ({ pageUrl, pageTitle, pageType = 'other', enabled = true }: SEOAnalyticsProps) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    scrollDepth: 0,
    timeOnPage: 0,
    clicks: 0,
    formInteractions: 0,
    isVisible: false
  });

  const startTimeRef = useRef<number>(Date.now());
  const maxScrollRef = useRef<number>(0);
  const isTrackingRef = useRef<boolean>(false);

  // Track scroll depth
  const trackScrollDepth = useCallback(() => {
    if (!enabled || isTrackingRef.current) return;
    
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const currentScroll = window.scrollY;
    const scrollPercentage = scrollHeight > 0 ? (currentScroll / scrollHeight) * 100 : 0;
    
    if (scrollPercentage > maxScrollRef.current) {
      maxScrollRef.current = scrollPercentage;
      setAnalyticsData(prev => ({ ...prev, scrollDepth: Math.round(scrollPercentage) }));
    }
  }, [enabled]);

  // Track clicks
  const trackClicks = useCallback(() => {
    if (!enabled) return;
    setAnalyticsData(prev => ({ ...prev, clicks: prev.clicks + 1 }));
  }, [enabled]);

  // Track form interactions
  const trackFormInteractions = useCallback(() => {
    if (!enabled) return;
    setAnalyticsData(prev => ({ ...prev, formInteractions: prev.formInteractions + 1 }));
  }, [enabled]);

  // Track time on page
  const updateTimeOnPage = useCallback(() => {
    if (!enabled) return;
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
    setAnalyticsData(prev => ({ ...prev, timeOnPage: timeSpent }));
  }, [enabled]);

  // Track visibility
  const trackVisibility = useCallback(() => {
    if (!enabled) return;
    const isVisible = !document.hidden;
    setAnalyticsData(prev => ({ ...prev, isVisible }));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    isTrackingRef.current = true;

    // Add event listeners
    window.addEventListener('scroll', trackScrollDepth, { passive: true });
    document.addEventListener('click', trackClicks);
    document.addEventListener('focusin', trackFormInteractions);
    document.addEventListener('visibilitychange', trackVisibility);

    // Update time on page every second
    const timeInterval = setInterval(updateTimeOnPage, 1000);

    // Initial visibility check
    trackVisibility();

    return () => {
      isTrackingRef.current = false;
      window.removeEventListener('scroll', trackScrollDepth);
      document.removeEventListener('click', trackClicks);
      document.removeEventListener('focusin', trackFormInteractions);
      document.removeEventListener('visibilitychange', trackVisibility);
      clearInterval(timeInterval);
    };
  }, [enabled, trackScrollDepth, trackClicks, trackFormInteractions, trackVisibility, updateTimeOnPage]);

  // Send analytics data to server/analytics service
  const sendAnalytics = useCallback(() => {
    if (!enabled) return;

    const analyticsPayload = {
      pageUrl,
      pageTitle,
      pageType,
      timestamp: new Date().toISOString(),
      ...analyticsData
    };

    // Send to analytics service (implement as needed)
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'page_engagement', analyticsPayload);
    }

    // Also send to custom analytics endpoint if needed
    // fetch('/api/analytics', { method: 'POST', body: JSON.stringify(analyticsPayload) });
  }, [enabled, pageUrl, pageTitle, pageType, analyticsData]);

  // Auto-send analytics every 30 seconds
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(sendAnalytics, 30000);
    return () => clearInterval(interval);
  }, [enabled, sendAnalytics]);

  return {
    analyticsData,
    sendAnalytics
  };
};

// Page Meta component for route-specific SEO
export const PageMeta: React.FC<{ 
  title: string; 
  description: string; 
  keywords?: string;
  path?: string;
}> = ({ title, description, keywords, path }) => {
  const canonicalUrl = path ? `${SEO_CONFIG.baseUrl}${path}` : SEO_CONFIG.baseUrl;
  
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description: description,
      url: canonicalUrl,
      publisher: {
        '@type': 'Organization',
        name: SEO_CONFIG.siteName,
        url: SEO_CONFIG.baseUrl
      }
    }
  ];

  return (
    <SEOHead
      title={title}
      description={description}
      keywords={keywords}
      canonicalUrl={canonicalUrl}
      ogUrl={canonicalUrl}
      structuredData={structuredData}
    />
  );
};

// Enhanced SEO utility functions
export const generateSEOFriendlyUrl = (title: string, basePath: string = ''): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  return basePath ? `${basePath}/${slug}` : slug;
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

// Structured data generators
export const generateStructuredData = (type: string, data: Record<string, any>) => {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': type,
    publisher: {
      '@type': 'Organization',
      name: SEO_CONFIG.siteName,
      url: SEO_CONFIG.baseUrl
    }
  };

  return { ...baseData, ...data };
};

export const generateWebsiteSchema = (siteName: string, siteUrl: string, siteDescription?: string) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  'name': siteName,
  'url': siteUrl,
  ...(siteDescription && { 'description': siteDescription }),
  'potentialAction': {
    '@type': 'SearchAction',
    'target': {
      '@type': 'EntryPoint',
      'urlTemplate': `${siteUrl}/search?q={search_term_string}`
    },
    'query-input': 'required name=search_term_string'
  }
});

export const generateOrganizationSchema = (name: string, description: string, url: string) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  'name': name,
  'description': description,
  'url': url,
  'logo': {
    '@type': 'ImageObject',
    'url': `${url}/logo.png`,
    'width': 512,
    'height': 512
  },
  'contactPoint': {
    '@type': 'ContactPoint',
    'contactType': 'customer service',
    'availableLanguage': ['English', 'Indonesian']
  },
  'sameAs': [
    'https://twitter.com/quanforge',
    'https://github.com/quanforge',
    'https://linkedin.com/company/quanforge'
  ]
});

export const generateSoftwareApplicationSchema = (name: string, description: string, url: string) => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  'name': name,
  'description': description,
  'url': url,
  'applicationCategory': 'FinanceApplication',
  'operatingSystem': 'Web',
  'offers': {
    '@type': 'Offer',
    'price': '0',
    'priceCurrency': 'USD'
  },
  'aggregateRating': {
    '@type': 'AggregateRating',
    'ratingValue': '4.8',
    'ratingCount': '150'
  }
});

export const generateFAQSchema = (faqs: Array<{ question: string; answer: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': faqs.map(faq => ({
    '@type': 'Question',
    'name': faq.question,
    'acceptedAnswer': {
      '@type': 'Answer',
      'text': faq.answer
    }
  }))
});

export const generateBreadcrumbSchema = (breadcrumbs: Array<{ name: string; url: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  'itemListElement': breadcrumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    'position': index + 1,
    'name': crumb.name,
    'item': crumb.url
  }))
});

export const generateArticleSchema = (
  headline: string,
  description: string,
  url: string,
  author: string = SEO_CONFIG.author,
  datePublished?: string,
  image?: string
) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  'headline': headline,
  'description': description,
  'url': url,
  'dateModified': new Date().toISOString(),
  'datePublished': datePublished || new Date().toISOString(),
  'author': {
    '@type': 'Organization',
    'name': author
  },
  'publisher': {
    '@type': 'Organization',
    'name': SEO_CONFIG.siteName,
    'logo': {
      '@type': 'ImageObject',
      'url': `${SEO_CONFIG.baseUrl}/logo.png`
    }
  },
  'mainEntityOfPage': {
    '@type': 'WebPage',
    '@id': url
  },
  ...(image && { 'image': image })
});

export const generateHowToSchema = (
  name: string,
  description: string,
  steps: Array<{ name: string; text: string }>
) => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  'name': name,
  'description': description,
  'totalTime': 'PT15M',
  'estimatedCost': {
    '@type': 'MonetaryAmount',
    'currency': 'USD',
    'value': '0'
  },
  'supply': [
    {
      '@type': 'HowToSupply',
      'name': 'MetaTrader 5 Platform',
      'estimatedCost': {
        '@type': 'MonetaryAmount',
        'currency': 'USD',
        'value': '0'
      }
    }
  ],
  'tool': [
    {
      '@type': 'HowToTool',
      'name': 'QuantForge AI',
      'url': SEO_CONFIG.baseUrl
    }
  ],
  'step': steps.map((step, index) => ({
    '@type': 'HowToStep',
    'position': index + 1,
    'name': step.name,
    'text': step.text,
    'image': {
      '@type': 'ImageObject',
      'url': `${SEO_CONFIG.baseUrl}/howto/step-${index + 1}.png`,
      'caption': step.name
    }
  })),
  'author': {
    '@type': 'Organization',
    'name': SEO_CONFIG.author
  }
});

// Performance optimization utilities
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

// Lazy loading image component
export const OptimizedImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
}> = ({ 
  src, 
  alt, 
  className, 
  width, 
  height, 
  loading = 'lazy'
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isInView, setIsInView] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
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