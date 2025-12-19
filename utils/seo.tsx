import React, { useEffect, useMemo, useRef } from 'react';

// SEO Configuration
const SEO_CONFIG = {
  siteName: 'QuantForge AI',
  siteUrl: 'https://quanforge.ai',
  baseUrl: 'https://quanforge.ai',
  defaultTitle: 'QuantForge AI',
  defaultImage: '/og-image.png',
  defaultDescription: 'Generate MQL5 trading strategies using AI-powered natural language processing',
  defaultKeywords: 'MQL5, trading strategies, AI, algorithmic trading, MetaTrader, forex',
  twitterHandle: '@quanforge',
  author: 'QuantForge AI',
  themeColor: '#22c55e',
  language: 'en',
  locale: 'en_US'
};

// SEO Interfaces
interface MetaTagsProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  type?: 'website' | 'article' | 'software' | 'product' | 'service';
  noIndex?: boolean;
  author?: string;
  publishDate?: string;
  modifiedDate?: string;
  category?: string;
  tags?: string[];
  customMeta?: Record<string, string>;
  alternateLanguages?: Record<string, string>;
}

interface SEOAnalyticsProps {
  pageUrl: string;
  pageTitle: string;
  pageType?: 'article' | 'product' | 'homepage' | 'other';
  enabled?: boolean;
}

interface StructuredDataProps {
  type: string;
  data: Record<string, any>;
}

// Meta tag utility
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
  meta.setAttribute('data-seo', 'true');
};

// Structured Data Generator
const generateStructuredData = (type: string, data: Record<string, any>) => {
  const baseData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data
  };

  // Add organization/site metadata
  if (['Article', 'SoftwareApplication', 'WebSite'].includes(type)) {
    baseData['publisher'] = {
      '@type': 'Organization',
      name: SEO_CONFIG.siteName,
      url: SEO_CONFIG.siteUrl
    };
  }

  return baseData;
};

// Main SEO Head Component
export const SEOHead: React.FC<MetaTagsProps> = ({
  title,
  description,
  keywords,
  ogImage,
  ogUrl,
  canonicalUrl,
  type = 'website',
  noIndex = false,
  author,
  publishDate,
  modifiedDate,
  category,
  tags,
  customMeta,
  alternateLanguages
}) => {
  const titleRef = useRef<string>('');
  const structuredDataRef = useRef<HTMLScriptElement[]>([]);

  const seoData = useMemo(() => {
    const finalTitle = title || SEO_CONFIG.defaultTitle;
    const finalDescription = description || SEO_CONFIG.defaultDescription;
    const finalKeywords = keywords || SEO_CONFIG.defaultKeywords;
    const finalOgImage = ogImage || SEO_CONFIG.defaultImage;
    const finalOgUrl = ogUrl || SEO_CONFIG.baseUrl;
    const finalCanonicalUrl = canonicalUrl || SEO_CONFIG.baseUrl;
    const finalAuthor = author || SEO_CONFIG.author;

    return {
      title: finalTitle,
      description: finalDescription,
      keywords: finalKeywords,
      ogImage: finalOgImage,
      ogUrl: finalOgUrl,
      canonicalUrl: finalCanonicalUrl,
      author: finalAuthor
    };
  }, [title, description, keywords, ogImage, ogUrl, canonicalUrl, author]);

  useEffect(() => {
    // Update page title
    if (seoData.title !== titleRef.current) {
      document.title = seoData.title.includes(SEO_CONFIG.siteName) 
        ? seoData.title 
        : `${seoData.title} | ${SEO_CONFIG.siteName}`;
      titleRef.current = seoData.title;
    }

    // Clear previous SEO meta tags
    const existingMetaTags = document.querySelectorAll('meta[data-seo="true"]');
    existingMetaTags.forEach(tag => tag.remove());

    // Clear previous structured data
    structuredDataRef.current.forEach(script => script.remove());
    structuredDataRef.current = [];

    // Basic Meta Tags
    updateMetaTag('description', seoData.description);
    updateMetaTag('keywords', seoData.keywords);
    updateMetaTag('author', seoData.author);
    updateMetaTag('language', SEO_CONFIG.language);
    updateMetaTag('content-language', SEO_CONFIG.language);

    // Open Graph Tags
    updateMetaTag('og:title', seoData.title, 'property');
    updateMetaTag('og:description', seoData.description, 'property');
    updateMetaTag('og:image', seoData.ogImage, 'property');
    updateMetaTag('og:url', seoData.ogUrl, 'property');
    updateMetaTag('og:type', type, 'property');
    updateMetaTag('og:site_name', SEO_CONFIG.siteName, 'property');
    updateMetaTag('og:locale', SEO_CONFIG.locale, 'property');

    // Twitter Card Tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', seoData.title);
    updateMetaTag('twitter:description', seoData.description);
    updateMetaTag('twitter:image', seoData.ogImage);
    updateMetaTag('twitter:site', SEO_CONFIG.twitterHandle);
    updateMetaTag('twitter:creator', SEO_CONFIG.twitterHandle);

    // Canonical URL
    updateMetaTag('canonical', seoData.canonicalUrl, 'rel');

    // SEO-specific tags
    updateMetaTag('robots', noIndex ? 'noindex,nofollow' : 'index,follow');
    updateMetaTag('googlebot', noIndex ? 'noindex,nofollow' : 'index,follow');

    // App/PWA Meta Tags
    updateMetaTag('apple-mobile-web-app-title', SEO_CONFIG.siteName);
    updateMetaTag('application-name', SEO_CONFIG.siteName);
    updateMetaTag('theme-color', SEO_CONFIG.themeColor);
    updateMetaTag('msapplication-TileColor', SEO_CONFIG.themeColor);

    // Article-specific tags
    if (type === 'article' && publishDate) {
      updateMetaTag('article:published_time', publishDate, 'property');
    }
    if (type === 'article' && modifiedDate) {
      updateMetaTag('article:modified_time', modifiedDate, 'property');
    }
    if (type === 'article' && author) {
      updateMetaTag('article:author', author, 'property');
    }
    if (type === 'article' && category) {
      updateMetaTag('article:section', category, 'property');
    }
    if (type === 'article' && tags) {
      tags.forEach(tag => {
        updateMetaTag('article:tag', tag, 'property');
      });
    }

    // Custom meta tags
    if (customMeta) {
      Object.entries(customMeta).forEach(([name, content]) => {
        updateMetaTag(name, content);
      });
    }

    // Alternate language links
    if (alternateLanguages) {
      Object.entries(alternateLanguages).forEach(([hrefLang, url]) => {
        const link = document.createElement('link');
        link.rel = 'alternate';
        link.hreflang = hrefLang;
        link.href = url;
        document.head.appendChild(link);
      });
    }

    // Generate structured data
    const structuredData = generateStructuredData(type, {
      name: seoData.title,
      description: seoData.description,
      url: seoData.ogUrl,
      image: seoData.ogImage,
      author: {
        '@type': 'Person',
        name: seoData.author
      },
      datePublished: publishDate,
      dateModified: modifiedDate,
      about: category,
      keywords: tags
    });

    // Add structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
    structuredDataRef.current.push(script);

    return () => {
      // Cleanup on unmount
      const metaTags = document.querySelectorAll('meta[data-seo="true"]');
      metaTags.forEach(tag => tag.remove());
      structuredDataRef.current.forEach(script => script.remove());
    };
  }, [seoData, type, noIndex, publishDate, modifiedDate, category, tags, customMeta, alternateLanguages]);

  return null;
};

// SEO Analytics Hook
export const useSEOAnalytics = ({ pageUrl, pageTitle, pageType = 'other', enabled = true }: SEOAnalyticsProps) => {
  useEffect(() => {
    if (!enabled) return;

    // Track page view for SEO analytics
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'page_view', {
        page_title: pageTitle,
        page_location: pageUrl,
        page_type: pageType
      });
    }

    // Track SEO performance metrics
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'largest-contentful-paint') {
            console.log('LCP:', entry.startTime);
          }
          if (entry.entryType === 'first-input') {
            const firstInputEntry = entry as any;
            console.log('FID:', firstInputEntry.processingStart - entry.startTime);
          }
        });
      });

      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] });

      return () => observer.disconnect();
    }
    
    return undefined;
  }, [pageUrl, pageTitle, pageType, enabled]);
};

// SEO Analytics Component
export const SEOAnalytics: React.FC<SEOAnalyticsProps> = (props) => {
  useSEOAnalytics(props);
  return null;
};

// SEO Utility Functions
export const generateSEOFriendlyUrl = (title: string, basePath: string = ''): string => {
  const urlFriendly = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  
  return basePath ? `${basePath}/${urlFriendly}` : urlFriendly;
};

export const generateStructuredDataForArticle = (
  title: string,
  description: string,
  author: string,
  publishDate: string,
  modifiedDate?: string,
  imageUrl?: string
) => {
  return generateStructuredData('Article', {
    headline: title,
    description,
    author: {
      '@type': 'Person',
      name: author
    },
    datePublished: publishDate,
    dateModified: modifiedDate,
    image: imageUrl,
    publisher: {
      '@type': 'Organization',
      name: SEO_CONFIG.siteName,
      logo: {
        '@type': 'ImageObject',
        url: `${SEO_CONFIG.siteUrl}/logo.png`
      }
    }
  });
};

export const generateStructuredDataForSoftware = (
  name: string,
  description: string,
  author: string,
  applicationCategory: string = 'FinanceApplication'
) => {
  return generateStructuredData('SoftwareApplication', {
    name,
    description,
    author: {
      '@type': 'Person',
      name: author
    },
    applicationCategory,
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    }
  });
};

// Structured data templates for backward compatibility
export const structuredDataTemplates = {
  article: generateStructuredDataForArticle,
  software: generateStructuredDataForSoftware,
  website: (title: string, description: string) => 
    generateStructuredData('WebSite', {
      name: title,
      description
    })
};

// Export config for external use
export { SEO_CONFIG };

// Types
export type { MetaTagsProps, SEOAnalyticsProps, StructuredDataProps };