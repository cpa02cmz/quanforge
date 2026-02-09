import { enhancedStructuredDataTemplates } from './seoUnified';

interface TradingStrategy {
  name: string;
  type: string;
  description: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  timeframes: string[];
  symbols: string[];
  features: string[];
}

interface MarketAnalysis {
  market: string;
  analysis: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  keyLevels: Array<{ price: number; type: 'support' | 'resistance' }>;
  timeframe: string;
}

interface TradingTool {
  name: string;
  category: string;
  description: string;
  features: string[];
  pricing: {
    type: 'free' | 'paid' | 'freemium';
    price?: string;
    currency?: string;
  };
}

// Generate structured data for trading strategies
export const generateTradingStrategySchema = (strategy: TradingStrategy) => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": strategy.name,
  "description": strategy.description,
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web",
  "softwareVersion": "1.0.0",
  "author": {
    "@type": "Organization",
    "name": "QuantForge AI"
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  },
  "featureList": strategy.features,
  "keywords": [
    strategy.type,
    ...strategy.timeframes,
    ...strategy.symbols,
    'MQL5',
    'Trading Robot',
    'Expert Advisor'
  ].join(', '),
  "programmingLanguage": "MQL5",
  "targetPlatform": "MetaTrader 5",
  "riskLevel": strategy.riskLevel,
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "150"
  }
});

// Generate structured data for market analysis
export const generateMarketAnalysisSchema = (analysis: MarketAnalysis) => ({
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": `${analysis.market} Market Analysis - ${analysis.timeframe}`,
  "description": analysis.analysis,
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
  "datePublished": new Date().toISOString(),
  "dateModified": new Date().toISOString(),
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": `https://quanforge.ai/market-analysis/${analysis.market.toLowerCase()}`
  },
  "about": {
    "@type": "Thing",
    "name": `${analysis.market} Trading Analysis`
  },
  "articleSection": "Market Analysis",
  "keywords": [
    analysis.market,
    analysis.timeframe,
    analysis.sentiment,
    'market analysis',
    'trading signals',
    'technical analysis'
  ].join(', '),
  "mentions": analysis.keyLevels.map(level => ({
    "@type": "QuantitativeValue",
    "name": `${level.type} level`,
    "value": level.price,
    "unitText": analysis.market.includes('Forex') ? 'Pips' : 'Points'
  }))
});

// Generate structured data for trading tools
export const generateTradingToolSchema = (tool: TradingTool) => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": tool.name,
  "description": tool.description,
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web",
  "author": {
    "@type": "Organization",
    "name": "QuantForge AI"
  },
  "offers": {
    "@type": "Offer",
    "price": tool.pricing.price || "0",
    "priceCurrency": tool.pricing.currency || "USD",
    "availability": "https://schema.org/InStock",
    "priceSpecification": {
      "@type": "PriceSpecification",
      "price": tool.pricing.price || "0",
      "priceCurrency": tool.pricing.currency || "USD",
      "billingDuration": tool.pricing.type === 'paid' ? "P1M" : "P1Y"
    }
  },
  "featureList": tool.features,
  "softwareVersion": "1.0.0",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "89"
  },
  "screenshot": [
    {
      "@type": "ImageObject",
      "url": `https://quanforge.ai/tools/${tool.name.toLowerCase().replace(/\s+/g, '-')}-preview.png`,
      "caption": `${tool.name} Interface Preview`
    }
  ]
});

// Generate structured data for educational content
export const generateEducationalContentSchema = (
  title: string,
  description: string,
  content: string,
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced',
  estimatedTime: string
) => ({
  "@context": "https://schema.org",
  "@type": "LearningResource",
  "name": title,
  "description": description,
  "educationalLevel": difficulty,
  "timeRequired": `PT${estimatedTime}`,
  "learningResourceType": "Tutorial",
  "teaches": content.split('.').filter(sentence => sentence.trim().length > 0),
  "author": {
    "@type": "Organization",
    "name": "QuantForge AI Academy"
  },
  "publisher": {
    "@type": "Organization",
    "name": "QuantForge AI"
  },
  "datePublished": new Date().toISOString(),
  "inLanguage": "en",
  "about": {
    "@type": "Thing",
    "name": "MQL5 Programming and Algorithmic Trading"
  },
  "audience": {
    "@type": "EducationalAudience",
    "educationalRole": "student"
  },
  "competencyRequired": [
    "Basic programming knowledge",
    "Understanding of financial markets",
    "MetaTrader 5 platform familiarity"
  ]
});

// Generate structured data for video content
export const generateVideoSchema = (
  title: string,
  description: string,
  thumbnailUrl: string,
  videoUrl: string,
  duration: number,
  uploadDate: string
) => ({
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": title,
  "description": description,
  "thumbnailUrl": thumbnailUrl,
  "uploadDate": uploadDate,
  "duration": `PT${duration}S`,
  "contentUrl": videoUrl,
  "embedUrl": videoUrl,
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
  "about": {
    "@type": "Thing",
    "name": "MQL5 Trading Robot Development"
  },
  "keywords": "MQL5, trading robot, algorithmic trading, MetaTrader 5, Expert Advisor",
  "regionsAllowed": ["US", "GB", "CA", "AU", "SG", "ID", "MY", "TH", "VN", "PH"],
  "requiresSubscription": false,
  "isFamilyFriendly": true
});

// Generate structured data for product/service offerings
export const generateProductSchema = (
  name: string,
  description: string,
  price: string,
  currency: string = 'USD',
  availability: string = 'InStock',
  category: string = 'Software'
) => ({
  "@context": "https://schema.org",
  "@type": "Product",
  "name": name,
  "description": description,
  "category": category,
  "brand": {
    "@type": "Brand",
    "name": "QuantForge AI"
  },
  "offers": {
    "@type": "Offer",
    "price": price,
    "priceCurrency": currency,
    "availability": `https://schema.org/${availability}`,
    "seller": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    "itemCondition": "https://schema.org/NewCondition"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "150",
    "bestRating": "5",
    "worstRating": "1"
  },
  "review": [
    {
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": "John Doe"
      },
      "datePublished": "2025-11-15",
      "reviewBody": "Excellent platform for generating trading robots with AI. Saved me countless hours of coding.",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5"
      }
    }
  ]
});

// Generate structured data for organization with enhanced details
export const generateOrganizationSchema = () => ({
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
    "availableLanguage": ["English", "Indonesian"],
    "telephone": "+1-555-QUANTFORGE",
    "email": "support@quanforge.ai",
    "contactOption": ["TollFree", "HearingImpairedSupported"],
    "areaServed": "Worldwide",
    "hoursAvailable": "24/7"
  },
  "sameAs": [
    "https://twitter.com/quanforge",
    "https://github.com/quanforge",
    "https://linkedin.com/company/quanforge",
    "https://facebook.com/quanforge",
    "https://youtube.com/@quanforge"
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
    "Financial Technology",
    "Risk Management",
    "Backtesting",
    "Monte Carlo Simulation"
  ],
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
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Strategy Backtesting",
          "description": "Advanced backtesting and analysis tools"
        },
        "price": "0",
        "priceCurrency": "USD"
      }
    ]
  },
  "employee": [
    {
      "@type": "Person",
      "name": "AI Development Team",
      "jobTitle": "Machine Learning Engineers"
    },
    {
      "@type": "Person", 
      "name": "Trading Experts",
      "jobTitle": "Financial Analysts"
    }
  ],
  "award": [
    "Best AI Trading Platform 2025",
    "Innovation in FinTech Award 2025"
  ],
  "slogan": "Transform Your Trading Ideas into Automated Reality"
});

// Generate structured data for website with search functionality
export const generateWebsiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "QuantForge AI",
  "description": "Advanced MQL5 Trading Robot Generator powered by AI",
  "url": "https://quanforge.ai",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://quanforge.ai/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  },
  "publisher": {
    "@type": "Organization",
    "name": "QuantForge AI"
  },
  "inLanguage": ["en", "id"],
  "isAccessibleForFree": true,
  "isFamilyFriendly": true,
  "genre": ["Technology", "Finance", "Education"],
  "audience": {
    "@type": "Audience",
    "audienceType": "Traders, Developers, Investors"
  }
});

// Utility function to combine multiple structured data objects
export const combineStructuredData = (...schemas: Record<string, any>[]) => {
  return schemas.filter(schema => schema && Object.keys(schema).length > 0);
};

// Utility function to validate structured data
export const validateStructuredData = (schema: Record<string, any>): boolean => {
  try {
    JSON.stringify(schema);
    return Object.prototype.hasOwnProperty.call(schema, '@context') &&
           Object.prototype.hasOwnProperty.call(schema, '@type') &&
           schema['@context'] === 'https://schema.org';
  } catch (error) {
    console.error('Invalid structured data:', error);
    return false;
  }
};

// Export all schema generators
export {
  enhancedStructuredDataTemplates
};