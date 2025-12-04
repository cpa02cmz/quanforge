import React, { useEffect, useState, useRef, useCallback } from 'react';

// Consolidated SEO interfaces
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
}

// SEO Configuration
const SEO_CONFIG: SEOConfig = {
  siteName: 'QuantForge AI',
  defaultTitle: 'QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5',
  defaultDescription: 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5 with visual strategy configuration and real-time market simulation.',
  defaultKeywords: 'MQL5 generator, MetaTrader 5, trading robot, Expert Advisor, AI trading, automated trading, forex robot, algorithmic trading, Gemini AI, trading strategy generator, MT5 EA, quantitative trading, forex EA, MQL5 EA builder, automated forex trading, AI trading bot, MetaTrader expert advisor, trading algorithm generator, MQL5 development, forex algorithm, trading automation, AI-powered trading, forex robot development, MetaTrader automation',
  baseUrl: 'https://quanforge.ai',
  ogImage: '/og-image.png'
};

// Consolidated SEO Head Component
export const SEOHead: React.FC<MetaTagsProps> = ({
  title,
  description,
  keywords,
  ogImage,
  ogUrl,
  canonicalUrl,
  type = 'website',
  structuredData = []
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
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        if (property) {
          meta.setAttribute('property', name);
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

    // Open Graph tags
    updateMetaTag('og:title', fullTitle, 'property');
    updateMetaTag('og:description', finalDescription, 'property');
    updateMetaTag('og:image', finalOgImage, 'property');
    updateMetaTag('og:url', finalOgUrl, 'property');
    updateMetaTag('og:type', type, 'property');
    updateMetaTag('og:site_name', siteTitle, 'property');

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', finalDescription);
    updateMetaTag('twitter:image', finalOgImage);

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.href = finalCanonicalUrl;

    // Structured data
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    if (structuredData.length > 0) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    // Cleanup function
    return () => {
      // Optional: Clean up added tags if needed
    };
  }, [fullTitle, finalDescription, finalKeywords, finalOgImage, finalOgUrl, finalCanonicalUrl, type, structuredData]);

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

// Export SEO utilities for backward compatibility
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

export const getMetaTags = (props: MetaTagsProps) => {
  return {
    title: props.title || SEO_CONFIG.defaultTitle,
    description: props.description || SEO_CONFIG.defaultDescription,
    keywords: props.keywords || SEO_CONFIG.defaultKeywords,
    ogImage: props.ogImage || SEO_CONFIG.ogImage,
    ogUrl: props.ogUrl || SEO_CONFIG.baseUrl,
    canonicalUrl: props.canonicalUrl || SEO_CONFIG.baseUrl
  };
};