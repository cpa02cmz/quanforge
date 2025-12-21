import React from 'react';
import { SEOHead, structuredDataTemplates } from './seoUnified';

interface PageMetaProps {
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
  lastModified?: string;
  author?: string;
  publishedTime?: string;
  articleSection?: string;
  readingTime?: string;
}

// Enhanced page meta component with comprehensive SEO optimization
export const PageMeta: React.FC<PageMetaProps> = ({
  title,
  description,
  keywords,
  ogImage,
  ogUrl,
  canonicalUrl,
  type = 'website',
  structuredData = [],
  noIndex = false,
  alternateUrls = []
}) => {
  // Default alternate URLs for internationalization
  const defaultAlternateUrls = [
    { hrefLang: 'en', url: canonicalUrl || 'https://quanforge.ai' },
    { hrefLang: 'x-default', url: canonicalUrl || 'https://quanforge.ai' },
    { hrefLang: 'id', url: `${canonicalUrl || 'https://quanforge.ai'}?lang=id` }
  ];

  const allAlternateUrls = [...defaultAlternateUrls, ...alternateUrls];

  return (
    <SEOHead
      title={title}
      description={description}
      keywords={keywords}
      ogImage={ogImage}
      ogUrl={ogUrl}
      canonicalUrl={canonicalUrl}
      type={type}
      structuredData={structuredData}
      noIndex={noIndex}
      alternateUrls={allAlternateUrls}
    />
  );
};

// Enhanced structured data generator with more comprehensive schemas
export const enhancedStructuredData = {
  ...structuredDataTemplates,
  
  // Enhanced organization schema with more details
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
      "availableLanguage": ["English", "Indonesian"],
      "email": "support@quanforge.ai",
      "hoursAvailable": "24/7"
    },
    "sameAs": [
      "https://twitter.com/quanforge",
      "https://github.com/quanforge",
      "https://linkedin.com/company/quanforge",
      "https://facebook.com/quanforge",
      "https://instagram.com/quanforge"
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
      "Quantitative Finance",
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
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Strategy Analysis",
            "description": "Advanced trading strategy analysis and optimization"
          }
        }
      ]
    }
  },

  // Enhanced software application schema
  softwareApplication: {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "QuantForge AI",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "description": "Advanced MQL5 Trading Robot Generator powered by AI. Generate professional trading robots using natural language and AI technology.",
    "url": "https://quanforge.ai",
    "downloadUrl": "https://quanforge.ai/download",
    "softwareVersion": "1.0.0",
    "applicationSubCategory": [
      "Trading Software",
      "AI Tools",
      "Financial Technology",
      "Algorithmic Trading",
      "Code Generation",
      "Risk Management"
    ],
    "softwareHelp": {
      "@type": "CreativeWork",
      "url": "https://quanforge.ai/wiki",
      "name": "QuantForge AI Documentation"
    },
    "softwareRequirements": [
      "MetaTrader 5 Platform",
      "Internet Connection",
      "Modern Web Browser"
    ],
    "featureList": [
      "AI-Powered MQL5 Code Generation",
      "Visual Strategy Configuration",
      "Real-time Market Simulation",
      "Risk Analysis Tools",
      "Strategy Backtesting",
      "Expert Advisor Creation",
      "Multi-Language Support",
      "Cloud Storage",
      "Advanced Analytics",
      "Monte Carlo Simulation",
      "Performance Monitoring",
      "Portfolio Management"
    ],
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "QuantForge AI"
      },
      "priceValidUntil": "2025-12-31"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "150",
      "bestRating": "5",
      "worstRating": "1",
      "ratingExplanation": "Highly rated by traders and developers worldwide"
    },
    "screenshot": [
      {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/screenshots/generator.png",
        "caption": "MQL5 Trading Robot Generator Interface"
      },
      {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/screenshots/chat-interface.png",
        "caption": "AI Strategy Discussion Interface"
      },
      {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/screenshots/backtesting.png",
        "caption": "Strategy Backtesting and Analysis"
      },
      {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/screenshots/dashboard.png",
        "caption": "Trading Robot Management Dashboard"
      }
    ],
    "video": {
      "@type": "VideoObject",
      "name": "QuantForge AI Demo",
      "description": "See how to create MQL5 trading robots with AI in minutes",
      "thumbnailUrl": "https://quanforge.ai/videos/demo-thumb.jpg",
      "contentUrl": "https://quanforge.ai/videos/demo.mp4",
      "uploadDate": "2024-01-01"
    }
  },

  // Enhanced website schema
  website: (name: string, description: string, url: string) => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": name,
    "description": description,
    "url": url,
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png",
        "width": 512,
        "height": 512
      }
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${url}/search?q={search_term_string}`,
        "actionPlatform": [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform"
        ]
      },
      "query-input": "required name=search_term_string"
    },
    "about": {
      "@type": "Thing",
      "name": "MQL5 Trading Robot Generation",
      "description": "AI-powered platform for creating automated trading strategies"
    },
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "QuantForge AI",
      "applicationCategory": "FinanceApplication"
    }
  }),

  // Enhanced web page schema
  webPage: (name: string, description: string, url: string, lastReviewed?: string) => ({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": name,
    "description": description,
    "url": url,
    "dateModified": new Date().toISOString(),
    "datePublished": "2024-01-01T00:00:00+00:00",
    "lastReviewed": lastReviewed || new Date().toISOString(),
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png",
        "width": 512,
        "height": 512
      }
    },
    "isPartOf": {
      "@type": "WebSite",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai",
      "description": "Advanced MQL5 Trading Robot Generator powered by AI"
    },
    "about": {
      "@type": "Thing",
      "name": "MQL5 Trading Robot Generation",
      "description": "Creating automated trading strategies using AI"
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [{
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://quanforge.ai"
      }]
    },
    "potentialAction": {
      "@type": "CreateAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://quanforge.ai/generator",
        "actionPlatform": [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform"
        ]
      },
      "result": {
        "@type": "SoftwareSourceCode",
        "name": "MQL5 Trading Robot",
        "programmingLanguage": "MQL5"
      }
    },
    "mainContentOfPage": {
      "@type": "WebPageElement",
      "name": "Main Content",
      "cssSelector": "main"
    }
  }),

  // Enhanced article schema
  article: (headline: string, description: string, url: string, author: string = 'QuantForge AI', datePublished?: string, dateModified?: string) => ({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": headline,
    "description": description,
    "url": url,
    "dateModified": dateModified || new Date().toISOString(),
    "datePublished": datePublished || "2024-01-01T00:00:00+00:00",
    "author": {
      "@type": "Organization",
      "name": author,
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
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    },
    "articleSection": "Financial Technology",
    "wordCount": 1000,
    "keywords": ["MQL5", "Trading Robots", "AI", "Algorithmic Trading"],
    "about": {
      "@type": "Thing",
      "name": "Automated Trading",
      "description": "AI-powered trading robot generation"
    }
  }),

  // Enhanced FAQ schema
  faq: (questions: Array<{ question: string; answer: string }>) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": questions.map(q => ({
      "@type": "Question",
      "name": q.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": q.answer,
        "author": {
          "@type": "Organization",
          "name": "QuantForge AI"
        }
      }
    })),
    "about": {
      "@type": "Thing",
      "name": "QuantForge AI FAQ",
      "description": "Frequently asked questions about QuantForge AI"
    }
  }),

  // Enhanced breadcrumb schema
  breadcrumb: (breadcrumbs: Array<{ name: string; url: string }>) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.url
    }))
  }),

  // Enhanced how-to schema
  howTo: (name: string, description: string, steps: Array<{ name: string; text: string; image?: string }>) => ({
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": name,
    "description": description,
    "totalTime": "PT15M",
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": "USD",
      "value": "0"
    },
    "supply": [
      {
        "@type": "HowToSupply",
        "name": "MetaTrader 5 Platform",
        "estimatedCost": {
          "@type": "MonetaryAmount",
          "currency": "USD",
          "value": "0"
        }
      },
      {
        "@type": "HowToSupply", 
        "name": "Trading Account",
        "estimatedCost": {
          "@type": "MonetaryAmount",
          "currency": "USD",
          "value": "0"
        }
      }
    ],
    "tool": [
      {
        "@type": "HowToTool",
        "name": "QuantForge AI",
        "url": "https://quanforge.ai"
      }
    ],
    "step": steps.map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step.name,
      "text": step.text,
      "image": step.image ? {
        "@type": "ImageObject",
        "url": step.image,
        "caption": step.name
      } : {
        "@type": "ImageObject",
        "url": `https://quanforge.ai/howto/step-${index + 1}.png`,
        "caption": step.name
      }
    })),
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png",
        "width": 512,
        "height": 512
      }
    }
  }),

  // Course schema for educational content
  course: (name: string, description: string, provider: string = 'QuantForge AI') => ({
    "@context": "https://schema.org",
    "@type": "Course",
    "name": name,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": provider,
      "url": "https://quanforge.ai"
    },
    "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "online",
      "instructor": {
        "@type": "Organization",
        "name": "QuantForge AI"
      },
      "courseSchedule": {
        "@type": "Schedule",
        "repeatFrequency": "daily",
        "duration": "PT2H"
      }
    },
    "educationalLevel": "Beginner to Advanced",
    "about": "MQL5 Programming and Algorithmic Trading",
    "teaches": [
      "MQL5 Programming",
      "Trading Strategy Development",
      "Risk Management",
      "Backtesting",
      "AI Integration"
    ]
  }),

  // Video object schema
  videoObject: (name: string, description: string, thumbnailUrl: string, contentUrl?: string, duration?: string) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": name,
    "description": description,
    "thumbnailUrl": thumbnailUrl,
    "uploadDate": new Date().toISOString(),
    "contentUrl": contentUrl || "https://quanforge.ai/videos/",
    "duration": duration || "PT10M",
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
      "name": "MQL5 Trading Robot Generation",
      "description": "AI-powered trading robot creation"
    }
  }),

  // Product schema for commercial offerings
  product: (name: string, description: string, price: string, priceCurrency: string = "USD") => ({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": name,
    "description": description,
    "brand": {
      "@type": "Brand",
      "name": "QuantForge AI"
    },
    "offers": {
      "@type": "Offer",
      "price": price,
      "priceCurrency": priceCurrency,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "QuantForge AI"
      },
      "priceValidUntil": "2025-12-31",
      "itemCondition": "https://schema.org/NewCondition"
    },
    "category": "Software",
    "material": "Digital",
    "audience": {
      "@type": "Audience",
      "audienceType": "Traders, Developers, Investors"
    }
  }),

  // Service schema
  service: (name: string, description: string, provider: string = "QuantForge AI") => ({
    "@context": "https://schema.org",
    "@type": "Service",
    "name": name,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": provider,
      "url": "https://quanforge.ai"
    },
    "serviceType": "Financial Services",
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
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Strategy Analysis",
            "description": "Advanced trading strategy analysis and optimization"
          }
        }
      ]
    },
    "audience": {
      "@type": "Audience",
      "audienceType": "Traders, Developers, Financial Institutions"
    }
  }),

  // Review schema
  review: (author: string, reviewBody: string, rating: number, itemReviewed: string) => ({
    "@context": "https://schema.org",
    "@type": "Review",
    "author": {
      "@type": "Person",
      "name": author
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": rating.toString(),
      "bestRating": "5",
      "worstRating": "1"
    },
    "reviewBody": reviewBody,
    "itemReviewed": {
      "@type": "SoftwareApplication",
      "name": itemReviewed,
      "applicationCategory": "FinanceApplication"
    },
    "datePublished": new Date().toISOString()
  }),

  // Event schema
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
    },
    "about": {
      "@type": "Thing",
      "name": "Trading Technology",
      "description": "Algorithmic trading and AI technology"
    }
  })
};

export default PageMeta;