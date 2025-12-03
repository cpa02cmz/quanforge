import React, { useEffect, useState, useMemo } from 'react';
import { SEOHead, structuredDataTemplates } from './seoEnhanced';
import { SEOAnalytics } from './seoAnalytics';

interface AdvancedSEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  type?: 'website' | 'article' | 'software';
  structuredData?: Record<string, any>[];
  enableAnalytics?: boolean;
  pageType?: 'homepage' | 'generator' | 'dashboard' | 'wiki' | 'blog' | 'other';
  customMeta?: Record<string, string>;
  jsonLd?: Record<string, any>[];
  alternateLanguages?: Record<string, string>;
  noIndex?: boolean;
  lastModified?: string;
  author?: string;
  publishedDate?: string;
  category?: string;
  tags?: string[];
  readingTime?: number;
  wordCount?: number;
  featuredImage?: string;
  tableOfContents?: Array<{ title: string; anchor: string; level: number }>;
  relatedArticles?: Array<{ title: string; url: string; image?: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  breadcrumbs?: Array<{ name: string; url: string }>;
}

interface PageSEOData {
  title: string;
  description: string;
  keywords: string[];
  structuredData: Record<string, any>[];
  breadcrumbs: Array<{ name: string; url: string }>;
}

const SEO_CONFIG = {
  siteName: 'QuantForge AI',
  siteUrl: 'https://quanforge.ai',
  defaultImage: '/og-image.png',
  twitterHandle: '@quanforge',
  author: 'QuantForge AI',
  themeColor: '#22c55e',
  language: 'en',
  locale: 'en_US',
  organization: {
    name: 'QuantForge AI',
    url: 'https://quanforge.ai',
    logo: 'https://quanforge.ai/logo.png',
    description: 'Advanced MQL5 Trading Robot Generator powered by AI'
  }
};

const PAGE_SEO_CONFIGS: Record<string, Partial<PageSEOData>> = {
  homepage: {
    title: 'QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5',
    description: 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5.',
    keywords: [
      'MQL5 generator', 'MetaTrader 5', 'trading robot', 'Expert Advisor', 'AI trading',
      'automated trading', 'forex robot', 'algorithmic trading', 'Gemini AI', 'trading strategy generator',
      'MT5 EA', 'quantitative trading', 'forex EA', 'MQL5 EA builder', 'automated forex trading',
      'AI trading bot', 'MetaTrader expert advisor', 'trading algorithm generator', 'MQL5 development',
      'forex algorithm', 'trading automation', 'AI trading system', 'quantitative finance',
      'algorithmic trading platform', 'MT5 programming', 'Expert Advisor development', 'forex bot creator',
      'automated trading software', 'MQL5 coder', 'trading strategy automation', 'AI-powered trading',
      'forex robot development', 'MetaTrader automation', 'trading bot generator', 'EA builder',
      'forex trading tools', 'algorithmic trading software', 'MT5 expert advisor generator'
    ],
    breadcrumbs: [{ name: 'Home', url: 'https://quanforge.ai/' }]
  },
  generator: {
    title: 'Create Trading Robot - AI-Powered MQL5 Generator',
    description: 'Create professional MQL5 trading robots using AI. Describe your strategy and generate Expert Advisors for MetaTrader 5 with visual configuration.',
    keywords: [
      'MQL5 generator', 'trading robot creator', 'Expert Advisor builder', 'AI trading strategy',
      'MetaTrader 5 robot', 'forex EA builder', 'automated trading bot', 'MT5 expert advisor',
      'AI code generation', 'trading algorithm generator', 'MQL5 development', 'forex robot creator',
      'automated trading software', 'EA generator', 'MetaTrader programming', 'algorithmic trading bot'
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
      'automated trading portfolio', 'forex robot management', 'MT5 EA portfolio',
      'trading algorithm dashboard', 'quantitative trading portfolio', 'EA management',
      'trading bot portfolio', 'automated trading dashboard', 'MetaTrader robot management'
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
      'MetaTrader 5 programming', 'algorithmic trading guide', 'forex robot development',
      'MQL5 tutorial', 'EA programming guide', 'trading automation tutorial', 'forex coding',
      'MetaTrader development', 'algorithmic trading education', 'MQL5 best practices'
    ],
    breadcrumbs: [
      { name: 'Home', url: 'https://quanforge.ai/' },
      { name: 'Wiki', url: 'https://quanforge.ai/wiki' }
    ]
  }
};

export const AdvancedSEO: React.FC<AdvancedSEOProps> = ({
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
  tags = [],
  readingTime,
  wordCount,
  featuredImage,
  tableOfContents = [],
  relatedArticles = [],
  faqs = [],
  breadcrumbs = []
}) => {
  // Get page-specific configuration
  const pageConfig = useMemo(() => PAGE_SEO_CONFIGS[pageType] || {}, [pageType]);
  
  // Merge props with page configuration
  const finalTitle = title || pageConfig.title || SEO_CONFIG.siteName;
  const finalDescription = description || pageConfig.description || '';
  const finalKeywords = keywords || pageConfig.keywords?.join(', ') || '';
  const finalCanonicalUrl = canonicalUrl || ogUrl || SEO_CONFIG.siteUrl;
  const finalBreadcrumbs = breadcrumbs.length > 0 ? breadcrumbs : pageConfig.breadcrumbs || [];
  
  // Generate enhanced structured data
  const enhancedStructuredData = useMemo(() => {
    const data = [...structuredData];
    
    // Add basic structured data based on page type
    if (pageType === 'homepage') {
      data.push(structuredDataTemplates.softwareApplication);
      data.push(structuredDataTemplates.localBusiness);
      data.push(structuredDataTemplates.webPage(finalTitle, finalDescription, finalCanonicalUrl));
      data.push(structuredDataTemplates.website(SEO_CONFIG.siteName, finalDescription, finalCanonicalUrl));
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
    }
    
    // Add article structured data for blog-like content
    if (pageType === 'blog' || publishedDate) {
      data.push(structuredDataTemplates.article(
        finalTitle,
        finalDescription,
        finalCanonicalUrl,
        author,
        publishedDate
      ));
    }
    
    // Add FAQ structured data if FAQs are provided
    if (faqs.length > 0) {
      data.push(structuredDataTemplates.faq(faqs));
    }
    
    // Add table of contents structured data
    if (tableOfContents.length > 0) {
      data.push({
        "@context": "https://schema.org",
        "@type": "Table",
        "name": "Table of Contents",
        "description": "Navigation table of contents for this page",
        "about": finalTitle,
        "mainEntity": tableOfContents.map((item, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": item.title,
          "url": `${finalCanonicalUrl}#${item.anchor}`
        }))
      });
    }
    
    // Add related articles structured data
    if (relatedArticles.length > 0) {
      data.push({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Related Articles",
        "itemListElement": relatedArticles.map((article, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "item": {
            "@type": "Article",
            "name": article.title,
            "url": article.url,
            ...(article.image && { "image": article.image })
          }
        }))
      });
    }
    
    // Add custom JSON-LD data
    data.push(...jsonLd);
    
    return data;
  }, [pageType, finalTitle, finalDescription, finalCanonicalUrl, finalBreadcrumbs, structuredData, jsonLd, publishedDate, author, faqs, tableOfContents, relatedArticles]);
  
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
    
    // Enhanced meta tags
    if (lastModified) {
      updateMetaTag('last-modified', lastModified);
    }
    
    if (publishedDate) {
      updateMetaTag('article:published_time', publishedDate);
    }
    
    if (category) {
      updateMetaTag('article:section', category);
    }
    
    if (readingTime) {
      updateMetaTag('article:reading_time', readingTime.toString());
    }
    
    if (wordCount) {
      updateMetaTag('article:word_count', wordCount.toString());
    }
    
    // Add tags as article:tag meta tags
    tags.forEach(tag => {
      updateMetaTag('article:tag', tag);
    });
    
    // Open Graph tags with enhanced attributes
    updateMetaTag('og:title', finalTitle, 'og:title');
    updateMetaTag('og:description', finalDescription, 'og:description');
    updateMetaTag('og:type', type, 'og:type');
    updateMetaTag('og:image', featuredImage || ogImage, 'og:image');
    updateMetaTag('og:image:width', '1200', 'og:image:width');
    updateMetaTag('og:image:height', '630', 'og:image:height');
    updateMetaTag('og:image:alt', finalTitle, 'og:image:alt');
    updateMetaTag('og:url', finalCanonicalUrl, 'og:url');
    updateMetaTag('og:site_name', SEO_CONFIG.siteName, 'og:site_name');
    updateMetaTag('og:locale', SEO_CONFIG.locale, 'og:locale');
    
    if (author) {
      updateMetaTag('article:author', author, 'article:author');
    }
    
    if (publishedDate) {
      updateMetaTag('article:published_time', publishedDate, 'article:published_time');
      updateMetaTag('article:modified_time', new Date().toISOString(), 'article:modified_time');
    }
    
    // Twitter Card tags with enhanced attributes
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', finalTitle);
    updateMetaTag('twitter:description', finalDescription);
    updateMetaTag('twitter:image', featuredImage || ogImage);
    updateMetaTag('twitter:image:alt', finalTitle);
    updateMetaTag('twitter:site', SEO_CONFIG.twitterHandle);
    updateMetaTag('twitter:creator', SEO_CONFIG.twitterHandle);
    updateMetaTag('twitter:domain', 'quanforge.ai');
    
    // Technical and SEO meta tags
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
    updateMetaTag('referrer', 'no-referrer-when-downgrade');
    updateMetaTag('format-detection', 'telephone=no');
    updateMetaTag('mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');
    updateMetaTag('apple-mobile-web-app-title', SEO_CONFIG.siteName);
    updateMetaTag('application-name', SEO_CONFIG.siteName);
    
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
    
    // Add DNS prefetch and preconnect for performance
    const performanceLinks = [
      { rel: 'dns-prefetch', href: '//fonts.googleapis.com' },
      { rel: 'dns-prefetch', href: '//fonts.gstatic.com' },
      { rel: 'dns-prefetch', href: '//cdn.tailwindcss.com' },
      { rel: 'dns-prefetch', href: '//cdnjs.cloudflare.com' },
      { rel: 'dns-prefetch', href: '//www.googletagmanager.com' },
      { rel: 'dns-prefetch', href: '//www.google-analytics.com' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' }
    ];
    
    performanceLinks.forEach(({ rel, href, crossorigin }) => {
      let link: HTMLLinkElement | null = document.querySelector(`link[rel="${rel}"][href="${href}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', rel);
        link.setAttribute('href', href);
        if (crossorigin) link.setAttribute('crossorigin', crossorigin);
        document.head.appendChild(link);
      }
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
    readingTime,
    wordCount,
    tags,
    type,
    featuredImage,
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
        ogImage={featuredImage || ogImage}
        ogUrl={finalCanonicalUrl}
        canonicalUrl={finalCanonicalUrl}
        type={type}
        structuredData={enhancedStructuredData}
        alternateUrls={alternateLanguageLinks.map(link => ({
          hrefLang: link.hrefLang,
          url: link.href
        }))}
      />
    </>
  );
};

// Hook for accessing page SEO data
export const useAdvancedSEO = () => {
  const [pageData, setPageData] = useState<PageSEOData | null>(null);
  
  useEffect(() => {
    setPageData({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content')?.split(', ') || [],
      structuredData: [],
      breadcrumbs: []
    });
  }, []);
  
  return pageData;
};

// Helper function to generate SEO-friendly URLs
export const generateAdvancedSEOFriendlyUrl = (title: string, basePath: string = ''): string => {
  const urlFriendly = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return basePath ? `${basePath}/${urlFriendly}` : urlFriendly;
};

// Helper function to calculate reading time
export const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
};

// Helper function to calculate word count
export const calculateWordCount = (content: string): number => {
  return content.trim().split(/\s+/).length;
};

// Helper function to extract table of contents
export const extractTableOfContents = (content: string): Array<{ title: string; anchor: string; level: number }> => {
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
  const headings: Array<{ title: string; anchor: string; level: number }> = [];
  let match;
  
  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1] || '1');
    const title = match[2]?.replace(/<[^>]*>/g, '').trim() || '';
    const anchor = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    if (title) {
      headings.push({ title, anchor: anchor || `heading-${headings.length}`, level });
    }
  }
  
  return headings;
};

// Enhanced structured data generator for financial products
export const generateFinancialProductSchema = (
  name: string,
  description: string,
  features: string[] = []
) => ({
  "@context": "https://schema.org",
  "@type": "FinancialProduct",
  "name": name,
  "description": description,
  "provider": {
    "@type": "Organization",
    "name": SEO_CONFIG.organization.name,
    "url": SEO_CONFIG.organization.url,
    "logo": SEO_CONFIG.organization.logo
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Organization",
      "name": SEO_CONFIG.organization.name
    }
  },
  "category": "Trading Software",
  "audience": {
    "@type": "Audience",
    "audienceType": "Traders, Developers, Investors"
  },
  "featureList": features.length > 0 ? features : [
    "AI-Powered Code Generation",
    "Visual Strategy Configuration",
    "Real-time Market Simulation",
    "Risk Analysis Tools",
    "MT5 Integration"
  ]
});

// Enhanced structured data generator for educational content
export const generateEducationalContentSchema = (
  title: string,
  description: string,
  educationalLevel: string = 'Beginner to Advanced',
  learningResourceType: string = 'Tutorial'
) => ({
  "@context": "https://schema.org",
  "@type": "LearningResource",
  "name": title,
  "description": description,
  "educationalLevel": educationalLevel,
  "learningResourceType": learningResourceType,
  "teaches": [
    "MQL5 Programming",
    "Trading Strategy Development",
    "Risk Management",
    "Algorithmic Trading",
    "MetaTrader 5 Integration"
  ],
  "provider": {
    "@type": "Organization",
    "name": SEO_CONFIG.organization.name,
    "url": SEO_CONFIG.organization.url
  },
  "audience": {
    "@type": "EducationalAudience",
    "educationalRole": "student"
  },
  "timeRequired": "PT30M",
  "inLanguage": "en-US",
  "isAccessibleForFree": true
});

// Enhanced structured data generator for video content
export const generateVideoSchema = (
  name: string,
  description: string,
  thumbnailUrl: string,
  contentUrl: string,
  duration: number
) => ({
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": name,
  "description": description,
  "thumbnailUrl": thumbnailUrl,
  "uploadDate": new Date().toISOString(),
  "duration": `PT${duration}S`,
  "contentUrl": contentUrl,
  "embedUrl": contentUrl,
  "publisher": {
    "@type": "Organization",
    "name": SEO_CONFIG.organization.name,
    "logo": {
      "@type": "ImageObject",
      "url": SEO_CONFIG.organization.logo,
      "width": 512,
      "height": 512
    }
  },
  "author": {
    "@type": "Organization",
    "name": SEO_CONFIG.organization.name
  },
  "inLanguage": "en-US",
  "isAccessibleForFree": true,
  "isFamilyFriendly": true
});

export default AdvancedSEO;