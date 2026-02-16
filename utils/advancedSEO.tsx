import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { SEOHead, structuredDataTemplates, useSEOAnalytics } from './seoUnified';
import { getUrlConfig, DEFAULT_URL_CONFIG } from './urls';
import { WindowWithGtag } from '../types/browser';

interface AdvancedSEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  type?: 'website' | 'article' | 'software' | 'product' | 'service';
  structuredData?: Record<string, any>[];
  noIndex?: boolean;
  alternateUrls?: Array<{ hrefLang: string; url: string }>;
  pageType?: 'homepage' | 'generator' | 'wiki' | 'blog' | 'faq' | 'about' | 'other';
  content?: string;
  author?: string;
  publishDate?: string;
  modifiedDate?: string;
  category?: string;
  tags?: string[];
  readingTime?: number;
  enableAnalytics?: boolean;
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface HowToStep {
  name: string;
  text: string;
  image?: string;
}

export const AdvancedSEO: React.FC<AdvancedSEOProps> = ({
  title = 'QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5',
  description = 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5 with visual strategy configuration and real-time market simulation.',
  keywords = 'MQL5 generator, MetaTrader 5, trading robot, Expert Advisor, AI trading, automated trading, forex robot, algorithmic trading, Gemini AI, trading strategy generator, MT5 EA, quantitative trading, forex EA, MQL5 EA builder, automated forex trading, AI trading bot, MetaTrader expert advisor, trading algorithm generator, MQL5 development, forex algorithm, trading automation, AI trading system, quantitative finance, algorithmic trading platform, MT5 programming, Expert Advisor development, forex bot creator, automated trading software, MQL5 coder, trading strategy automation, AI-powered trading, forex robot development, MetaTrader automation',
  ogImage = '/og-image.png',
  ogUrl = (() => { const config = getUrlConfig(); return config.APP_URL; })(),
  canonicalUrl = (() => { const config = getUrlConfig(); return config.APP_URL_CANONICAL; })(),
  type = 'website',
  structuredData = [],
  noIndex = false,
  alternateUrls = [],
  pageType = 'other',
  content = '',
  author = 'QuantForge AI',
  publishDate,
  modifiedDate,
  category,
  tags = [],
  readingTime,
  enableAnalytics = true
}) => {
  const [breadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [faqs] = useState<FAQItem[]>([]);
  const [howToSteps] = useState<HowToStep[]>([]);

  // Enhanced structured data generation based on page type
  const enhancedStructuredData = useMemo(() => {
    const baseData = [
      structuredDataTemplates.softwareApplication,
      structuredDataTemplates.organization
    ];

    switch (pageType) {
      case 'homepage':
        return [
          ...baseData,
          structuredDataTemplates.webPage(
            title,
            description,
            canonicalUrl
          ),
          structuredDataTemplates.website(
            'QuantForge AI',
            description,
            canonicalUrl
          ),
          structuredDataTemplates.searchAction()
        ];

      case 'generator':
        return [
          ...baseData,
          structuredDataTemplates.webPage(
            'MQL5 Trading Robot Generator',
            'Create professional trading robots with AI-powered code generation',
            `${canonicalUrl}/generator`
          ),
          structuredDataTemplates.financialService,
          structuredDataTemplates.howTo(
            'Create MQL5 Trading Robot',
            'Learn how to create professional MQL5 trading robots using AI in minutes',
            howToSteps.length > 0 ? howToSteps : [
              { name: 'Describe Strategy', text: 'Describe your trading strategy in natural language' },
              { name: 'Configure Parameters', text: 'Set risk management, stop loss, and take profit levels' },
              { name: 'Generate Code', text: 'AI generates optimized MQL5 code automatically' },
              { name: 'Test & Deploy', text: 'Backtest and deploy to MetaTrader 5' }
            ]
          )
        ];

      case 'wiki':
        return [
          ...baseData,
          structuredDataTemplates.webPage(
            'Trading Robot Documentation',
            'Comprehensive guides for MQL5 trading robot development',
            `${canonicalUrl}/wiki`
          ),
          structuredDataTemplates.educationalCourse,
          structuredDataTemplates.course(
            'MQL5 Trading Robot Development',
            'Complete course on developing MQL5 trading robots using AI technology'
          )
        ];

      case 'blog':
        return [
          ...baseData,
          structuredDataTemplates.article(
            title,
            description,
            canonicalUrl,
            author,
            publishDate
          ),
          structuredDataTemplates.webPage(
            title,
            description,
            canonicalUrl
          )
        ];

      case 'faq':
        return [
          ...baseData,
          structuredDataTemplates.faq(faqs.length > 0 ? faqs : [
            { question: 'What is QuantForge AI?', answer: 'QuantForge AI is an advanced platform that uses artificial intelligence to generate MQL5 trading robots for MetaTrader 5.' },
            { question: 'How does the AI generate trading robots?', answer: 'Our AI uses Google Gemini models to understand your trading strategy descriptions and generate optimized MQL5 code.' },
            { question: 'Is QuantForge AI suitable for beginners?', answer: 'Yes! QuantForge AI is designed for traders of all skill levels, from beginners to experienced quantitative analysts.' }
          ]),
          structuredDataTemplates.webPage(
            'Frequently Asked Questions',
            'Common questions about QuantForge AI and MQL5 trading robots',
            `${canonicalUrl}/faq`
          )
        ];

      case 'about':
        return [
          ...baseData,
          structuredDataTemplates.webPage(
            'About QuantForge AI',
            'Learn about our mission to democratize algorithmic trading',
            `${canonicalUrl}/about`
          ),
          structuredDataTemplates.organization
        ];

      default:
        return [
          ...baseData,
          structuredDataTemplates.webPage(
            title,
            description,
            canonicalUrl
          )
        ];
    }
  }, [pageType, title, description, canonicalUrl, author, publishDate, faqs, howToSteps]);

  // Enhanced meta tags with additional SEO optimizations
  const enhancedMetaTags = useMemo(() => {
    // Map type to compatible SEOHead type
    let mappedType: 'website' | 'article' | 'software' = 'website';
    if (type === 'article' || pageType === 'blog') mappedType = 'article';
    else if (type === 'software' || type === 'product' || type === 'service' || pageType === 'generator') mappedType = 'software';
    
    return {
      title,
      description,
      keywords: keywords + (tags.length > 0 ? `, ${tags.join(', ')}` : ''),
      ogImage,
      ogUrl,
      canonicalUrl,
      type: mappedType,
      structuredData: [...structuredData, ...enhancedStructuredData],
      noIndex,
      alternateUrls: [
        ...alternateUrls,
        { hrefLang: 'en', url: canonicalUrl },
        { hrefLang: 'x-default', url: canonicalUrl },
        { hrefLang: 'en-US', url: canonicalUrl }
      ]
    };
  }, [title, description, keywords, tags, ogImage, ogUrl, canonicalUrl, type, pageType, structuredData, enhancedStructuredData, noIndex, alternateUrls]);

  // SEO Analytics - map page types to compatible analytics types
  const analyticsProps = useMemo(() => {
    let analyticsPageType: 'article' | 'product' | 'homepage' | 'other' = 'other';
    if (pageType === 'homepage') analyticsPageType = 'homepage';
    else if (pageType === 'blog') analyticsPageType = 'article';
    else if (pageType === 'generator') analyticsPageType = 'product';
    
    return {
      pageUrl: canonicalUrl,
      pageTitle: title,
      pageType: analyticsPageType,
      enabled: enableAnalytics
    };
  }, [canonicalUrl, title, pageType, enableAnalytics]);

  useSEOAnalytics(analyticsProps);

  // Enhanced JSON-LD structured data with additional schemas
  const generateAdditionalStructuredData = useCallback(() => {
    const additionalData: Record<string, any>[] = [];

    // Add breadcrumbs if available
    if (breadcrumbs.length > 0) {
      additionalData.push(structuredDataTemplates.breadcrumb(breadcrumbs));
    }

    // Add review schema for product pages
    if (pageType === 'generator' || type === 'product') {
      additionalData.push(structuredDataTemplates.aggregateReview);
    }

    // Add video schema if content contains video references
    if (content && content.includes('video')) {
      additionalData.push((structuredDataTemplates as any).videoObject(
        title,
        description,
        ogImage
      ));
    }

    // Add course schema for educational content
    if (pageType === 'wiki' || category === 'education') {
      additionalData.push((structuredDataTemplates as any).educationalVideo(
        title,
        description,
        ogImage
      ));
    }

    return additionalData;
  }, [breadcrumbs, pageType, type, content, title, description, ogImage, category]);

  // Performance monitoring for SEO metrics
  useEffect(() => {
    // Track page load performance
    if (typeof window !== 'undefined' && 'performance' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            const loadTime = navEntry.loadEventEnd - navEntry.loadEventStart;
            
            // Send performance data to analytics
            if (enableAnalytics && typeof window !== 'undefined') {
              const win = window as WindowWithGtag;
              if (win.gtag) {
                win.gtag('event', 'page_load_time', {
                  value: Math.round(loadTime),
                  page_type: pageType,
                  custom_parameter_1: 'quantforge_ai_seo'
                });
              }
            }
          }
        });
      });
      
      observer.observe({ entryTypes: ['navigation'] });
      
      return () => observer.disconnect();
    }
    return undefined;
  }, [pageType, enableAnalytics]);

  // Enhanced schema.org markup for rich snippets
  useEffect(() => {
    // Add article schema if it's a blog post
    if (pageType === 'blog' && publishDate) {
      const articleSchema = structuredDataTemplates.article(
        title,
        description,
        canonicalUrl,
        author,
        publishDate
      );
      
      // Add reading time if available
      if (readingTime) {
        (articleSchema as any).timeRequired = `PT${readingTime}M`;
      }
      
      // Add category and tags
      if (category) {
        (articleSchema as any).about = {
          '@type': 'Thing',
          name: category
        };
      }
      
      if (tags.length > 0) {
        (articleSchema as any).keywords = tags.join(', ');
      }
    }

    // Add product schema for service pages
    if (pageType === 'generator') {
      const productSchema = (structuredDataTemplates as any).product(
        'MQL5 Trading Robot Generator',
        description,
        '0',
        'USD'
      );
      
      (productSchema as any).aggregateRating = structuredDataTemplates.aggregateReview;
    }
  }, [pageType, title, description, canonicalUrl, author, publishDate, readingTime, category, tags]);

  return (
    <>
      <SEOHead {...enhancedMetaTags} />
      
      {/* Additional structured data */}
      {generateAdditionalStructuredData().map((data, index) => (
        <script
          key={`additional-structured-data-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(data)
          }}
        />
      ))}

      {/* 
        SECURITY NOTE: The dangerouslySetInnerHTML usage above is safe because:
        1. JSON.stringify() properly escapes all HTML/JavaScript characters
        2. No user input is directly rendered - all data comes from trusted application code
        3. JSON-LD structured data requires type="application/ld+json" script tag
        4. This pattern follows standard React documentation for JSON-LD implementation
      */}
      
      {/* Preconnect to external domains for performance */}
      <link rel="preconnect" href={DEFAULT_URL_CONFIG.FONTS_GOOGLE} />
      <link rel="preconnect" href={DEFAULT_URL_CONFIG.FONTS_GSTATIC} crossOrigin="anonymous" />
      <link rel="preconnect" href={DEFAULT_URL_CONFIG.GTM} />
      <link rel="preconnect" href={DEFAULT_URL_CONFIG.GA} />
      <link rel="preconnect" href={DEFAULT_URL_CONFIG.SUPABASE_WILDCARD} crossOrigin="anonymous" />
      
      {/* DNS prefetch for non-critical resources */}
      <link rel="dns-prefetch" href="//cdnjs.cloudflare.com" />
      <link rel="dns-prefetch" href="//cdn.tailwindcss.com" />
      <link rel="dns-prefetch" href="//connect.facebook.net" />
      
      {/* Additional meta tags for enhanced SEO */}
      <meta name="distribution" content="global" />
      <meta name="rating" content="general" />
      <meta name="revisit-after" content="7 days" />
      <meta name="language" content="en" />
      <meta name="geo.region" content="US" />
      <meta name="geo.placename" content="Global" />
      <meta name="category" content="finance, technology, trading, artificial intelligence" />
      <meta name="coverage" content="Worldwide" />
      <meta name="target" content="all" />
      <meta name="HandheldFriendly" content="True" />
      <meta name="MobileOptimized" content="320" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="format-detection" content="telephone=no" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="QuantForge AI" />
      <meta name="application-name" content="QuantForge AI" />
      <meta name="referrer" content="no-referrer-when-downgrade" />
      <meta name="copyright" content="QuantForge AI" />
      <meta name="classification" content="Software" />
      <meta name="abstract" content="AI-powered MQL5 trading robot generator for MetaTrader 5" />
      <meta name="topic" content="Trading, Finance, Artificial Intelligence, Software Development" />
      <meta name="summary" content="Generate professional MQL5 trading robots using AI technology" />
      <meta name="url" content={canonicalUrl} />
      <meta name="identifier-URL" content={canonicalUrl} />
      <meta name="directory" content="submission" />
      <meta name="pagename" content="QuantForge AI" />
      <meta name="subtitle" content="Advanced MQL5 Trading Robot Generator" />
      <meta name="target_country" content="US" />
      <meta name="page-topic" content="Trading Software Development" />
      <meta name="syndication-source" content={canonicalUrl} />
      <meta name="original-source" content={canonicalUrl} />
      
      {/* Open Graph enhanced tags */}
      <meta property="og:locale" content="en_US" />
      <meta property="og:site_name" content="QuantForge AI" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />
      
      {/* Twitter enhanced tags */}
      <meta name="twitter:site" content="@quanforge" />
      <meta name="twitter:creator" content="@quanforge" />
      <meta name="twitter:domain" content="quanforge.ai" />
      <meta name="twitter:image:alt" content={title} />
      
      {/* Article specific tags */}
      {pageType === 'blog' && publishDate && (
        <>
          <meta property="article:published_time" content={publishDate} />
          <meta property="article:modified_time" content={modifiedDate || new Date().toISOString()} />
          <meta property="article:author" content={author} />
          <meta property="article:section" content={category || 'Trading Technology'} />
          {tags.map((tag, index) => (
            <meta key={`tag-${index}`} property="article:tag" content={tag} />
          ))}
        </>
      )}
      
      {/* Product specific tags */}
      {pageType === 'generator' && (
        <>
          <meta property="product:brand" content="QuantForge AI" />
          <meta property="product:availability" content="in stock" />
          <meta property="product:condition" content="new" />
          <meta property="product:price:amount" content="0" />
          <meta property="product:price:currency" content="USD" />
        </>
      )}
    </>
  );
};

export default AdvancedSEO;