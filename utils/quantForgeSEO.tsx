import React, { useEffect, useMemo, useState } from 'react';
import { SEOHead, structuredDataTemplates } from './seoEnhanced';

interface QuantForgeSEOProps {
  pageType: 'home' | 'generator' | 'wiki' | 'faq' | 'blog' | 'features' | 'about' | 'tools' | 'strategies';
  title?: string;
  description?: string;
  keywords?: string;
  content?: string;
  customSchema?: Record<string, any>[];
  noIndex?: boolean;
  canonicalUrl?: string;
  ogImage?: string;
}

// Enhanced keyword strategy for QuantForge AI
const KEYWORD_STRATEGY = {
  primary: [
    "MQL5 generator", "AI trading platform", "automated trading", 
    "MetaTrader 5 robot", "Expert Advisor generator"
  ],
  secondary: [
    "forex robot creator", "algorithmic trading software", 
    "AI trading bot", "MT5 EA builder", "quantitative trading"
  ],
  longTail: [
    "how to create MQL5 trading robot", "AI-powered trading strategy generator",
    "automated forex trading software", "best MQL5 generator 2025"
  ],
  local: [
    "MQL5 generator USA", "trading automation UK", 
    "AI trading platform Europe", "forex robot Asia"
  ]
};

// Page-specific SEO configurations
const PAGE_SEO_CONFIG = {
  home: {
    title: "QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5",
    description: "Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5 with visual strategy configuration and real-time market simulation.",
    keywords: [...KEYWORD_STRATEGY.primary, ...KEYWORD_STRATEGY.secondary].join(', '),
    priority: 1.0
  },
  generator: {
    title: "MQL5 Trading Robot Generator - Create AI-Powered Expert Advisors",
    description: "Create professional MQL5 trading robots with AI-powered code generation. Visual strategy configuration, real-time simulation, and instant deployment to MetaTrader 5.",
    keywords: "MQL5 generator, trading robot creator, Expert Advisor builder, AI trading bot, MetaTrader 5 automation, algorithmic trading software, forex robot generator",
    priority: 0.9
  },
  wiki: {
    title: "MQL5 Trading Robot Documentation - Complete Development Guide",
    description: "Comprehensive guides and documentation for MQL5 trading robot development. Learn algorithmic trading, risk management, and AI-powered strategy creation.",
    keywords: "MQL5 documentation, trading robot tutorial, MetaTrader 5 guide, algorithmic trading course, Expert Advisor development, forex trading education",
    priority: 0.8
  },
  faq: {
    title: "Frequently Asked Questions - QuantForge AI Trading Robot Generator",
    description: "Find answers to common questions about QuantForge AI, MQL5 trading robots, automated trading, and AI-powered strategy generation.",
    keywords: "QuantForge AI FAQ, MQL5 questions, trading robot help, automated trading support, AI trading platform questions, MetaTrader 5 assistance",
    priority: 0.8
  },
  blog: {
    title: "Algorithmic Trading Blog - MQL5 Strategies & AI Trading Insights",
    description: "Expert insights on algorithmic trading, MQL5 development, AI trading strategies, and forex market analysis. Stay updated with the latest trading technology trends.",
    keywords: "algorithmic trading blog, MQL5 strategies, AI trading insights, forex market analysis, trading robot tutorials, MetaTrader 5 tips",
    priority: 0.7
  },
  features: {
    title: "QuantForge AI Features - Advanced Trading Robot Generation Tools",
    description: "Explore powerful features of QuantForge AI: AI-powered code generation, visual strategy configuration, real-time simulation, risk analysis, and comprehensive backtesting tools.",
    keywords: "QuantForge AI features, trading robot tools, AI code generation, strategy configuration, risk analysis tools, backtesting software, MetaTrader 5 features",
    priority: 0.9
  },
  about: {
    title: "About QuantForge AI - Leading MQL5 Trading Robot Generator",
    description: "Learn about QuantForge AI, the leading platform for AI-powered MQL5 trading robot generation. Our mission is to democratize algorithmic trading with cutting-edge AI technology.",
    keywords: "QuantForge AI company, MQL5 generator about us, trading robot platform, AI trading company, algorithmic trading solutions, MetaTrader 5 automation",
    priority: 0.7
  },
  tools: {
    title: "Trading Tools & Calculators - Risk Management & Performance Analysis",
    description: "Professional trading tools including risk calculator, position size calculator, performance analyzer, and strategy backtester for optimal trading decisions.",
    keywords: "trading tools, risk calculator, position size calculator, performance analyzer, trading backtester, forex tools, MetaTrader 5 utilities",
    priority: 0.8
  },
  strategies: {
    title: "Trading Strategies - Scalping, Trend Following & Breakout Systems",
    description: "Explore proven trading strategies including scalping, trend following, breakout systems, and AI-powered strategies for MetaTrader 5 automated trading.",
    keywords: "trading strategies, scalping systems, trend following, breakout trading, forex strategies, algorithmic trading systems, MQL5 strategies",
    priority: 0.8
  }
};

export const QuantForgeSEO: React.FC<QuantForgeSEOProps> = ({
  pageType,
  title,
  description,
  keywords,
  content,
  customSchema = [],
  noIndex = false,
  canonicalUrl,
  ogImage
}) => {
  const [enhancedSchema, setEnhancedSchema] = useState<Record<string, any>[]>([]);

  const pageConfig = PAGE_SEO_CONFIG[pageType];
  const baseUrl = 'https://quanforge.ai';
  
  // Generate enhanced structured data based on page type and content
  useEffect(() => {
    const schema = generateEnhancedSchema(pageType, content, customSchema);
    setEnhancedSchema(schema);
  }, [pageType, content, customSchema]);

  // Generate canonical URL
  const generateCanonicalUrl = (): string => {
    if (canonicalUrl) return canonicalUrl;
    
    const urlMap: Record<string, string> = {
      home: baseUrl,
      generator: `${baseUrl}/generator`,
      wiki: `${baseUrl}/wiki`,
      faq: `${baseUrl}/faq`,
      blog: `${baseUrl}/blog`,
      features: `${baseUrl}/features`,
      about: `${baseUrl}/about`,
      tools: `${baseUrl}/tools`,
      strategies: `${baseUrl}/strategies`
    };
    
    return urlMap[pageType] || baseUrl;
  };

  // Generate Open Graph image
  const generateOGImage = (): string => {
    if (ogImage) return ogImage;
    
    const imageMap: Record<string, string> = {
      home: '/og-image.png',
      generator: '/generator-preview.png',
      wiki: '/wiki-preview.png',
      faq: '/faq-preview.png',
      blog: '/blog-preview.png',
      features: '/features-preview.png',
      about: '/about-preview.png',
      tools: '/tools-preview.png',
      strategies: '/strategies-preview.png'
    };
    
    return imageMap[pageType] || '/og-image.png';
  };

  // Generate enhanced meta tags
  const enhancedMetaTags = useMemo(() => ({
    title: title || pageConfig.title,
    description: description || pageConfig.description,
    keywords: keywords || pageConfig.keywords,
    canonicalUrl: generateCanonicalUrl(),
    ogImage: generateOGImage(),
    ogUrl: generateCanonicalUrl(),
    type: (pageType === 'blog' ? 'article' : 'website') as 'article' | 'website' | 'software',
    noIndex,
    structuredData: enhancedSchema
  }), [title, description, keywords, pageConfig, canonicalUrl, ogImage, pageType, noIndex, enhancedSchema]);

  return (
    <>
      <SEOHead {...enhancedMetaTags} />
      <SEOMonitoring pageType={pageType} priority={pageConfig.priority} />
      <PerformanceTracker />
    </>
  );
};

// Generate enhanced structured data
const generateEnhancedSchema = (
  pageType: string, 
  _content?: string, 
  customSchema: Record<string, any>[] = []
): Record<string, any>[] => {
  const baseSchemas = [
    structuredDataTemplates.softwareApplication,
    structuredDataTemplates.organization,
    structuredDataTemplates.website(
      'QuantForge AI - Advanced MQL5 Trading Robot Generator',
      'Generate professional MQL5 trading robots using AI technology',
      'https://quanforge.ai'
    )
  ];

  const pageSpecificSchemas: Record<string, Record<string, any>[]> = {
    home: [
      structuredDataTemplates.webPage(
        'QuantForge AI - Advanced MQL5 Trading Robot Generator',
        'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5.',
        'https://quanforge.ai'
      )
    ],
    generator: [
      structuredDataTemplates.webPage(
        'MQL5 Trading Robot Generator',
        'Create professional trading robots with AI-powered code generation',
        'https://quanforge.ai/generator'
      ),
      structuredDataTemplates.softwareApplication
    ],
    wiki: [
      structuredDataTemplates.educationalCourse,
      structuredDataTemplates.webPage(
        'Trading Robot Documentation',
        'Comprehensive guides for MQL5 trading robot development',
        'https://quanforge.ai/wiki'
      )
    ],
    faq: [
      structuredDataTemplates.faq([
        {
          question: "What is QuantForge AI?",
          answer: "QuantForge AI is an advanced platform that uses artificial intelligence to generate MQL5 trading robots and Expert Advisors for MetaTrader 5."
        },
        {
          question: "How does the AI trading robot generation work?",
          answer: "Our AI analyzes your trading strategy requirements and generates optimized MQL5 code using Google's Gemini AI models."
        },
        {
          question: "Is QuantForge AI suitable for beginners?",
          answer: "Yes, QuantForge AI is designed for both beginners and experienced traders, with visual configuration tools and comprehensive documentation."
        }
      ])
    ],
    blog: [
      structuredDataTemplates.webPage(
        'Algorithmic Trading Blog',
        'Expert insights on algorithmic trading, MQL5 development, and AI trading strategies',
        'https://quanforge.ai/blog'
      )
    ],
    features: [
      structuredDataTemplates.webPage(
        'QuantForge AI Features',
        'Advanced trading robot generation tools and features',
        'https://quanforge.ai/features'
      )
    ],
    about: [
      structuredDataTemplates.webPage(
        'About QuantForge AI',
        'Leading MQL5 trading robot generator platform',
        'https://quanforge.ai/about'
      ),
      structuredDataTemplates.organization
    ],
    tools: [
      structuredDataTemplates.webPage(
        'Trading Tools & Calculators',
        'Professional trading tools for risk management and performance analysis',
        'https://quanforge.ai/tools'
      )
    ],
    strategies: [
      structuredDataTemplates.webPage(
        'Trading Strategies',
        'Proven trading strategies for automated trading',
        'https://quanforge.ai/strategies'
      )
    ]
  };

  return [
    ...baseSchemas,
    ...(pageSpecificSchemas[pageType] || []),
    ...customSchema
  ];
};

// SEO Monitoring Component
const SEOMonitoring: React.FC<{ pageType: string; priority: number }> = ({ pageType, priority }) => {
  useEffect(() => {
    // Track page view for SEO analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
        page_title: pageType,
        page_location: window.location.href,
        custom_parameter_1: 'quantforge_ai',
        custom_parameter_2: pageType,
        custom_parameter_3: priority.toString()
      });
    }
  }, [pageType, priority]);

  return null;
};

// Performance Tracker Component
const PerformanceTracker: React.FC = () => {
  useEffect(() => {
    // Track Core Web Vitals
    const trackWebVitals = () => {
      if ('PerformanceObserver' in window) {
        try {
          // Track Largest Contentful Paint
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry && typeof window !== 'undefined' && (window as any).gtag) {
              (window as any).gtag('event', 'LCP', {
                value: Math.round(lastEntry.startTime),
                event_category: 'Web Vitals'
              });
            }
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

          // Track Cumulative Layout Shift
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry: any) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            });
            if (typeof window !== 'undefined' && (window as any).gtag) {
              (window as any).gtag('event', 'CLS', {
                value: Math.round(clsValue * 1000),
                event_category: 'Web Vitals'
              });
            }
          });
          clsObserver.observe({ entryTypes: ['layout-shift'] });
        } catch (error) {
          console.warn('Web Vitals tracking not supported:', error);
        }
      }
    };

    if (document.readyState === 'complete') {
      trackWebVitals();
    } else {
      window.addEventListener('load', trackWebVitals);
      return () => window.removeEventListener('load', trackWebVitals);
    }
    return undefined;
  }, []);

  return null;
};

export default QuantForgeSEO;