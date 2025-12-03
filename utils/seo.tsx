import React, { useEffect } from 'react';

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
  keywords = 'MQL5 generator, MetaTrader 5, trading robot, Expert Advisor, AI trading, automated trading, forex robot, algorithmic trading, Gemini AI, trading strategy generator, MT5 EA, quantitative trading, forex EA, MQL5 EA builder, automated forex trading, AI trading bot, MetaTrader expert advisor, trading algorithm generator, MQL5 development, forex algorithm, trading automation, AI trading system, quantitative finance, algorithmic trading platform, MT5 programming, Expert Advisor development, forex bot creator, automated trading software, MQL5 coder, trading strategy automation, AI-powered trading, forex robot development, MetaTrader automation',
  ogImage = '/og-image.png',
  ogUrl = 'https://quanforge.ai',
  canonicalUrl = 'https://quanforge.ai',
  type = 'website',
  structuredData = []
}) => {
  const siteTitle = 'QuantForge AI';
  const fullTitle = title.includes(siteTitle) ? title : `${title} | ${siteTitle}`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, property?: string) => {
      let meta: HTMLMetaElement | null = document.querySelector(
        property ? `meta[property="${property}"]` : `meta[name="${name}"]`
      );
      
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

    // Basic Meta Tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('author', 'QuantForge AI');
    updateMetaTag('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    
    // Canonical URL
    let canonical: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);
    
    // Open Graph Tags
    updateMetaTag('og:title', fullTitle, 'og:title');
    updateMetaTag('og:description', description, 'og:description');
    updateMetaTag('og:type', type, 'og:type');
    updateMetaTag('og:image', ogImage, 'og:image');
    updateMetaTag('og:url', ogUrl, 'og:url');
    updateMetaTag('og:site_name', siteTitle, 'og:site_name');
    updateMetaTag('og:locale', 'en_US', 'og:locale');
    
    // Enhanced Open Graph tags
    updateMetaTag('article:author', 'QuantForge AI', 'article:author');
    updateMetaTag('article:section', 'Financial Technology', 'article:section');
    updateMetaTag('article:tag', 'MQL5, Trading Robots, AI, Algorithmic Trading', 'article:tag');
    
    // Twitter Card Tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', ogImage);
    updateMetaTag('twitter:site', '@quanforge');
    updateMetaTag('twitter:creator', '@quanforge');
    updateMetaTag('twitter:domain', 'quanforge.ai');
    
    // Performance-oriented meta tags
    updateMetaTag('theme-color', '#22c55e');
    updateMetaTag('msapplication-TileColor', '#22c55e');
    updateMetaTag('msapplication-config', '/browserconfig.xml');
    
    // Language and localization
    updateMetaTag('language', 'en');
    updateMetaTag('distribution', 'global');
    updateMetaTag('rating', 'general');
    updateMetaTag('revisit-after', '7 days');
    updateMetaTag('geo.region', 'US');
    updateMetaTag('geo.placename', 'Global');
    updateMetaTag('category', 'finance, technology, trading, artificial intelligence');
    updateMetaTag('coverage', 'Worldwide');
    updateMetaTag('target', 'all');
    
    // Mobile optimization
    updateMetaTag('HandheldFriendly', 'True');
    updateMetaTag('MobileOptimized', '320');
    updateMetaTag('apple-mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');
    updateMetaTag('format-detection', 'telephone=no');
    updateMetaTag('mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-title', 'QuantForge AI');
    updateMetaTag('application-name', 'QuantForge AI');
    updateMetaTag('msapplication-TileImage', '/mstile-144x144.png');
    
    // Security and privacy
    updateMetaTag('referrer', 'no-referrer-when-downgrade');
    
    // Enhanced SEO tags
    updateMetaTag('copyright', 'QuantForge AI');
    updateMetaTag('classification', 'Software');
    updateMetaTag('revisit-after', '7 days');
    updateMetaTag('expires', 'never');
    updateMetaTag('pragma', 'no-cache');
    updateMetaTag('cache-control', 'no-cache');
    
    // Additional SEO meta tags
    updateMetaTag('google-site-verification', 'your-google-verification-code');
    updateMetaTag('msvalidate.01', 'your-bing-verification-code');
    
    // Schema.org meta tags (where applicable)
    updateMetaTag('application-name', 'QuantForge AI');
    updateMetaTag('msapplication-tooltip', 'QuantForge AI - MQL5 Trading Robot Generator');
    updateMetaTag('msapplication-starturl', 'https://quanforge.ai');
    
    // Clean up existing structured data
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => script.remove());
    
    // Add structured data
    structuredData.forEach((data) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });

    return () => {
      // Cleanup function if needed
    };
  }, [fullTitle, description, keywords, canonicalUrl, type, ogImage, ogUrl, siteTitle, structuredData]);

  // This component doesn't render anything visible
  return null;
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
    "downloadUrl": "https://quanforge.ai/download",
    "softwareVersion": "1.0.0",
    "applicationSubCategory": [
      "Trading Software",
      "AI Tools",
      "Financial Technology",
      "Algorithmic Trading"
    ],
    "softwareHelp": {
      "@type": "CreativeWork",
      "url": "https://quanforge.ai/wiki"
    },
    "softwareRequirements": [
      "MetaTrader 5 Platform",
      "Internet Connection"
    ],
    "featureList": [
      "AI-Powered MQL5 Code Generation",
      "Visual Strategy Configuration",
      "Real-time Market Simulation",
      "Risk Analysis",
      "Strategy Backtesting",
      "Expert Advisor Creation"
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
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "150",
      "bestRating": "5",
      "worstRating": "1"
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
      }
    ]
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
      "image": {
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
    "datePublished": new Date().toISOString(),
    "lastReviewed": new Date().toISOString(),
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

  // Additional structured data types for enhanced SEO
  financialService: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "FinancialService",
    "name": name,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "serviceType": "Investment Services",
    "areaServed": "Worldwide",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    }
  }),

  techArticle: (headline: string, description: string, author: string, datePublished: string) => ({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": headline,
    "description": description,
    "author": {
      "@type": "Person",
      "name": author
    },
    "datePublished": datePublished,
    "dateModified": new Date().toISOString(),
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
      "@id": "https://quanforge.ai"
    }
  }),

  searchAction: () => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": "https://quanforge.ai",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://quanforge.ai/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  }),

  website: (name: string, description: string, url: string) => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": name,
    "description": description,
    "url": url,
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${url}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  }),

  // Enhanced structured data for better SEO
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
      "availableLanguage": ["English", "Indonesian"]
    },
    "sameAs": [
      "https://twitter.com/quanforge",
      "https://github.com/quanforge",
      "https://linkedin.com/company/quanforge"
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
      "Financial Technology"
    ]
  },

  financialProduct: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "name": name,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "category": "Trading Software",
    "audience": {
      "@type": "Audience",
      "audienceType": "Traders, Developers, Investors"
    }
  }),

  educationalOrganization: {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "QuantForge AI Academy",
    "description": "Learn MQL5 programming and algorithmic trading with AI-powered tools",
    "url": "https://quanforge.ai/wiki",
    "provider": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Trading Education Courses",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Course",
            "name": "MQL5 Programming Basics",
            "description": "Learn the fundamentals of MQL5 programming"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Course",
            "name": "Algorithmic Trading Strategies",
            "description": "Master advanced trading strategies"
          }
        }
      ]
    }
  },

  videoObject: (name: string, description: string, thumbnailUrl: string) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": name,
    "description": description,
    "thumbnailUrl": thumbnailUrl,
    "uploadDate": new Date().toISOString(),
    "contentUrl": "https://quanforge.ai/videos/",
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png"
      }
    }
  }),

  quoraQuestion: (name: string, text: string, answerCount: number) => ({
    "@context": "https://schema.org",
    "@type": "Question",
    "name": name,
    "text": text,
    "answerCount": answerCount,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "QuantForge AI provides the best solution for generating MQL5 trading robots using advanced AI technology.",
      "author": {
        "@type": "Organization",
        "name": "QuantForge AI"
      }
    },
    "suggestedAnswer": [
      {
        "@type": "Answer",
        "text": "You can create professional trading robots by describing your strategy in natural language.",
        "author": {
          "@type": "Organization",
          "name": "QuantForge AI"
        }
      }
    ]
  }),

  dataset: (name: string, description: string) => ({
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": name,
    "description": description,
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "license": "https://creativecommons.org/licenses/by/4.0/",
    "distribution": [
      {
        "@type": "DataDownload",
        "encodingFormat": "application/json",
        "contentUrl": "https://quanforge.ai/api/data"
      }
    ]
  })
};