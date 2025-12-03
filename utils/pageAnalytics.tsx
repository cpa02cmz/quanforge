import React, { useEffect } from 'react';

interface PageAnalyticsProps {
  pageUrl: string;
  pageTitle: string;
  pageType?: 'homepage' | 'generator' | 'dashboard' | 'wiki' | 'other';
}

export const PageAnalytics: React.FC<PageAnalyticsProps> = ({ 
  pageUrl, 
  pageTitle, 
  pageType = 'other' 
}) => {
  useEffect(() => {
    // Track page view
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
        page_title: pageTitle,
        page_location: pageUrl,
        page_path: (() => {
          try {
            return new URL(pageUrl).pathname;
          } catch {
            return '/';
          }
        })(),
        custom_parameter_1: 'quantforge_ai',
        custom_parameter_2: pageType
      });
    }

    // Track page performance metrics
    const trackPerformance = () => {
      if ('performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation && navigation.loadEventEnd && navigation.loadEventStart && navigation.domContentLoadedEventEnd && navigation.domContentLoadedEventStart) {
          const metrics = {
            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            firstPaint: 0,
            firstContentfulPaint: 0,
            largestContentfulPaint: 0
          };

          // Track paint metrics
          const paintEntries = performance.getEntriesByType('paint');
          paintEntries.forEach((entry) => {
            if (entry.name === 'first-paint') {
              metrics.firstPaint = entry.startTime;
            }
            if (entry.name === 'first-contentful-paint') {
              metrics.firstContentfulPaint = entry.startTime;
            }
          });

          // Track LCP
          const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
          if (lcpEntries.length > 0) {
            const lastEntry = lcpEntries[lcpEntries.length - 1];
            if (lastEntry && lastEntry.startTime) {
              metrics.largestContentfulPaint = lastEntry.startTime;
            }
          }

          // Send metrics to analytics
          if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'page_performance', {
              custom_parameter_1: 'quantforge_ai',
              custom_parameter_2: pageType,
              load_time: metrics.loadTime,
              dom_content_loaded: metrics.domContentLoaded,
              first_paint: metrics.firstPaint,
              first_contentful_paint: metrics.firstContentfulPaint,
              largest_contentful_paint: metrics.largestContentfulPaint
            });
          }
        }
      }
    };

    // Track performance after page load
    if (document.readyState === 'complete') {
      trackPerformance();
    } else {
      window.addEventListener('load', trackPerformance);
      return () => window.removeEventListener('load', trackPerformance);
    }
    return undefined;
  }, [pageUrl, pageTitle, pageType]);

  // Track user engagement
  useEffect(() => {
    let startTime = Date.now();
    let isActive = true;
    let scrollDepth = 0;

    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const currentScrollDepth = Math.round((scrollTop / (documentHeight - windowHeight)) * 100);
      
      if (currentScrollDepth > scrollDepth) {
        scrollDepth = currentScrollDepth;
        
        // Track scroll milestones
        if (scrollDepth === 25 || scrollDepth === 50 || scrollDepth === 75 || scrollDepth === 90) {
          if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'scroll_milestone', {
              custom_parameter_1: 'quantforge_ai',
              custom_parameter_2: pageType,
              scroll_depth: scrollDepth,
              page_title: pageTitle
            });
          }
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        isActive = false;
        const timeOnPage = Math.round((Date.now() - startTime) / 1000);
        
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'page_engagement', {
            custom_parameter_1: 'quantforge_ai',
            custom_parameter_2: pageType,
            time_on_page: timeOnPage,
            scroll_depth: scrollDepth,
            page_title: pageTitle
          });
        }
      } else if (!document.hidden && !isActive) {
        isActive = true;
        startTime = Date.now();
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const elementData = {
        tagName: target.tagName,
        className: target.className,
        id: target.id,
        textContent: target.textContent?.substring(0, 50)
      };
      
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'user_click', {
          custom_parameter_1: 'quantforge_ai',
          custom_parameter_2: pageType,
          element_tag: elementData.tagName,
          element_class: elementData.className,
          element_id: elementData.id,
          page_title: pageTitle
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleClick);
      
      // Final engagement tracking
      if (isActive) {
        const timeOnPage = Math.round((Date.now() - startTime) / 1000);
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'page_engagement', {
            custom_parameter_1: 'quantforge_ai',
            custom_parameter_2: pageType,
            time_on_page: timeOnPage,
            scroll_depth: scrollDepth,
            page_title: pageTitle,
            session_end: true
          });
        }
      }
    };
  }, [pageTitle, pageType]);

  return null;
};

// Core Web Vitals tracking
export const trackWebVitals = (metric: any) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', metric.name, {
      custom_parameter_1: 'quantforge_ai',
      custom_parameter_2: 'web_vital',
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true
    });
  }
};

// Enhanced structured data generator
export const generatePageStructuredData = (
  pageType: string,
  title: string,
  description: string,
  url: string,
  additionalData?: Record<string, any>
) => {
  const baseSchema = {
    "@context": "https://schema.org",
    "@type": pageType === 'homepage' ? 'WebSite' : 'WebPage',
    "name": title,
    "description": description,
    "url": url,
    "dateModified": new Date().toISOString(),
    "isPartOf": {
      "@type": "WebSite",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png"
      }
    },
    ...additionalData
  };

  return baseSchema;
};

// SEO-friendly URL generator
export const generateSeoFriendlyUrl = (title: string, id?: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  return id ? `${slug}-${id}` : slug;
};

// Meta description optimizer
export const optimizeMetaDescription = (content: string, maxLength: number = 160): string => {
  const cleaned = content
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  const truncated = cleaned.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
};