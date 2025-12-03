import React, { useEffect, useState, useRef } from 'react';

interface SEOAnalyticsProps {
  pageUrl: string;
  pageTitle: string;
  pageType?: 'article' | 'product' | 'homepage' | 'other';
}

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

    // Log for debugging (remove in production)
    if (process.env['NODE_ENV'] === 'development') {
      console.log('Analytics Event:', eventName, data);
    }
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