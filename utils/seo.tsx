import { Helmet } from 'react-helmet-async';

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

export const SEOHead: React.FC<MetaTagsProps> = ({
  title = 'QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5',
  description = 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5 with visual strategy configuration and real-time market simulation.',
  keywords = 'MQL5 generator, MetaTrader 5, trading robot, Expert Advisor, AI trading, automated trading, forex robot, algorithmic trading, Gemini AI, trading strategy generator, MT5 EA, quantitative trading, forex EA, MQL5 EA builder, automated forex trading, AI trading bot, MetaTrader expert advisor, trading algorithm generator',
  ogImage = '/og-image.png',
  ogUrl = 'https://quanforge.ai',
  canonicalUrl = 'https://quanforge.ai',
  type = 'website',
  structuredData = []
}) => {
  const siteTitle = 'QuantForge AI';
  const fullTitle = title.includes(siteTitle) ? title : `${title} | ${siteTitle}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="QuantForge AI" />
      <meta name="robots" content="index, follow" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={ogUrl} />
      <meta property="og:site_name" content={siteTitle} />
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Additional Meta Tags */}
      <meta name="theme-color" content="#22c55e" />
      <meta name="msapplication-TileColor" content="#0f172a" />
      <meta name="language" content="en" />
      <meta name="distribution" content="global" />
      <meta name="rating" content="general" />
      <meta name="revisit-after" content="7 days" />
      <meta name="geo.region" content="US" />
      <meta name="geo.placename" content="Global" />
      <meta name="category" content="finance, technology, trading, artificial intelligence" />
      
      {/* Structured Data */}
      {structuredData.map((data, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
};

// Predefined structured data templates
export const structuredDataTemplates = {
  softwareApplication: {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "QuantForge AI",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "description": "Advanced MQL5 Trading Robot Generator powered by AI",
    "url": "https://quanforge.ai",
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  },
  
  article: (title: string, description: string, url: string) => ({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "url": url,
    "dateModified": new Date().toISOString(),
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI"
    }
  }),
  
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
  
  creativeWork: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "name": name,
    "description": description,
    "dateCreated": new Date().toISOString(),
    "dateModified": new Date().toISOString(),
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "inLanguage": "en-US",
    "isAccessibleForFree": true,
    "genre": ["Technology", "Finance", "Trading", "Software Development"]
  }),

  howTo: (name: string, description: string, steps: Array<{ name: string; text: string }>) => ({
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": name,
    "description": description,
    "totalTime": "PT10M",
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": "USD",
      "value": "0"
    },
    "supply": [
      {
        "@type": "HowToSupply",
        "name": "MetaTrader 5 Platform"
      },
      {
        "@type": "HowToSupply", 
        "name": "Trading Account"
      }
    ],
    "tool": [
      {
        "@type": "HowToTool",
        "name": "QuantForge AI"
      }
    ],
    "step": steps.map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step.name,
      "text": step.text
    }))
  }),

  faq: (questions: Array<{ question: string; answer: string }>) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": questions.map(q => ({
      "@type": "Question",
      "name": q.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": q.answer
      }
    }))
  }),

  videoGame: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": name,
    "description": description,
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "150"
    },
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    }
  }),

  localBusiness: {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "QuantForge AI",
    "description": "Advanced MQL5 Trading Robot Generator powered by AI",
    "url": "https://quanforge.ai",
    "logo": "https://quanforge.ai/logo.png",
    "sameAs": [
      "https://twitter.com/quanforge",
      "https://github.com/quanforge"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "availableLanguage": ["English"]
    }
  },

  webPage: (name: string, description: string, url: string) => ({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": name,
    "description": description,
    "url": url,
    "dateModified": new Date().toISOString(),
    "isPartOf": {
      "@type": "WebSite",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "about": {
      "@type": "Thing",
      "name": "MQL5 Trading Robot Generation"
    }
  }),

  course: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "Course",
    "name": name,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "online",
      "instructor": {
        "@type": "Organization",
        "name": "QuantForge AI"
      }
    }
  }),

  review: (author: string, reviewBody: string, rating: number) => ({
    "@context": "https://schema.org",
    "@type": "Review",
    "author": {
      "@type": "Person",
      "name": author
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": rating.toString(),
      "bestRating": "5"
    },
    "reviewBody": reviewBody
  }),

  aggregateRating: (ratingValue: number, reviewCount: number) => ({
    "@context": "https://schema.org",
    "@type": "AggregateRating",
    "ratingValue": ratingValue.toString(),
    "reviewCount": reviewCount.toString(),
    "bestRating": "5",
    "worstRating": "1"
  }),

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
    }
  }),

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
      }
    }
  }),

  service: (name: string, description: string, provider: string = "QuantForge AI") => ({
    "@context": "https://schema.org",
    "@type": "Service",
    "name": name,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": provider
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
            "name": "MQL5 Robot Generation"
          }
        }
      ]
    }
  }),

  // New structured data templates for enhanced SEO
  techArticle: (headline: string, description: string, author: string = "QuantForge AI") => ({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": headline,
    "description": description,
    "author": {
      "@type": "Organization",
      "name": author
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "datePublished": new Date().toISOString(),
    "dateModified": new Date().toISOString(),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://quanforge.ai"
    },
    "about": [
      {
        "@type": "Thing",
        "name": "MQL5 Programming"
      },
      {
        "@type": "Thing", 
        "name": "Algorithmic Trading"
      },
      {
        "@type": "Thing",
        "name": "Artificial Intelligence"
      }
    ]
  }),

  collectionPage: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": name,
    "description": description,
    "url": "https://quanforge.ai",
    "dateModified": new Date().toISOString(),
    "isPartOf": {
      "@type": "WebSite",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "about": {
      "@type": "Thing",
      "name": "Trading Robot Collection"
    },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": 10,
      "itemListElement": [
        {
          "@type": "SoftwareApplication",
          "name": "MQL5 Trading Robot Generator",
          "description": "AI-powered trading robot generation tool"
        },
        {
          "@type": "SoftwareApplication", 
          "name": "Strategy Backtester",
          "description": "Advanced backtesting and simulation tools"
        },
        {
          "@type": "SoftwareApplication",
          "name": "Portfolio Manager",
          "description": "Comprehensive portfolio management dashboard"
        }
      ]
    }
  }),

  searchAction: () => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": "https://quanforge.ai/",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://quanforge.ai/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  }),

  organization: () => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "QuantForge AI",
    "alternateName": "QuantForge",
    "url": "https://quanforge.ai",
    "logo": "https://quanforge.ai/logo.png",
    "description": "Advanced MQL5 Trading Robot Generator powered by AI",
    "foundingDate": "2024",
    "areaServed": "Worldwide",
    "knowsAbout": [
      "MQL5 Programming",
      "MetaTrader 5",
      "Algorithmic Trading",
      "Artificial Intelligence",
      "Financial Technology",
      "Trading Robots",
      "Expert Advisors"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "availableLanguage": ["English"],
      "url": "https://quanforge.ai/contact"
    },
    "sameAs": [
      "https://twitter.com/quanforge",
      "https://github.com/quanforge"
    ]
  }),

  webApplication: () => ({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "QuantForge AI",
    "description": "Advanced MQL5 Trading Robot Generator powered by AI",
    "url": "https://quanforge.ai",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web Browser",
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "featureList": [
      "AI-Powered Code Generation",
      "Visual Strategy Configuration",
      "Real-time Market Simulation",
      "Risk Analysis Tools",
      "Portfolio Management",
      "Multi-Language Support",
      "Cloud Storage",
      "Advanced Analytics"
    ],
    "screenshot": "https://quanforge.ai/screenshot.png",
    "softwareVersion": "1.0.0",
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI"
    }
  }),

  dataset: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": name,
    "description": description,
    "url": "https://quanforge.ai",
    "datePublished": new Date().toISOString(),
    "dateModified": new Date().toISOString(),
    "creator": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "distribution": [
      {
        "@type": "DataDownload",
        "encodingFormat": "application/json",
        "contentUrl": "https://quanforge.ai/api/data"
      }
    ],
    "keywords": "trading data, market analysis, algorithmic trading, MQL5",
    "license": "https://quanforge.ai/terms"
  })
};