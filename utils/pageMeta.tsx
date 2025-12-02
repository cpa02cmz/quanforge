import React, { useEffect } from 'react';

interface PageMetaProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  type?: 'website' | 'article' | 'software';
  structuredData?: Record<string, any>[];
  noIndex?: boolean;
  lastModified?: string;
  author?: string;
  publishedTime?: string;
  articleSection?: string;
  readingTime?: string;
}

export const PageMeta: React.FC<PageMetaProps> = ({
  title,
  description,
  keywords,
  ogImage = '/og-image.png',
  ogUrl = 'https://quanforge.ai',
  canonicalUrl = 'https://quanforge.ai',
  type = 'website',
  structuredData = [],
  noIndex = false,
  lastModified: _lastModified,
  author = 'QuantForge AI',
  publishedTime: _publishedTime,
  articleSection: _articleSection,
  readingTime: _readingTime
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
    if (keywords) updateMetaTag('keywords', keywords);
    updateMetaTag('author', author);
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    
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
    
    // Twitter Card Tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', ogImage);
    updateMetaTag('twitter:site', '@quanforge');
    updateMetaTag('twitter:creator', '@quanforge');
    
    // Additional Meta Tags
    updateMetaTag('theme-color', '#22c55e');
    updateMetaTag('language', 'en');
    
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
  }, [fullTitle, description, keywords, author, noIndex, canonicalUrl, type, ogImage, ogUrl, siteTitle, structuredData]);

  // This component doesn't render anything visible
  return null;
};

// Enhanced structured data templates for better SEO
export const enhancedStructuredData = {
  // Organization schema with enhanced details
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
      "availableLanguage": ["English"],
      "email": "support@quanforge.ai"
    },
    "sameAs": [
      "https://twitter.com/quanforge",
      "https://github.com/quanforge",
      "https://linkedin.com/company/quanforge"
    ],
    "foundingDate": "2023",
    "founders": [
      {
        "@type": "Person",
        "name": "Dr. Sarah Chen",
        "jobTitle": "CEO & Co-Founder"
      },
      {
        "@type": "Person", 
        "name": "Michael Rodriguez",
        "jobTitle": "CTO & Co-Founder"
      }
    ],
    "areaServed": "Worldwide",
    "knowsLanguage": ["English", "Indonesian"],
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
    "description": "Advanced MQL5 Trading Robot Generator powered by AI",
    "url": "https://quanforge.ai",
    "downloadUrl": "https://quanforge.ai",
    "author": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "validFrom": "2023-01-01"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "150",
      "bestRating": "5",
      "worstRating": "1"
    },
    "featureList": [
      "AI-Powered Code Generation",
      "Visual Strategy Configuration", 
      "Real-time Market Simulation",
      "Risk Analysis Tools",
      "MT5 Integration",
      "Multi-Language Support",
      "Cloud Storage",
      "Advanced Analytics",
      "Monte Carlo Simulation",
      "Expert Advisor Builder"
    ],
    "screenshot": "https://quanforge.ai/screenshot.png",
    "softwareVersion": "1.0.0",
    "datePublished": "2023-01-01",
    "dateModified": new Date().toISOString(),
    "inLanguage": "en-US",
    "isAccessibleForFree": true,
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "installUrl": "https://quanforge.ai",
    "license": "https://quanforge.ai/terms"
  },

  // Enhanced WebPage schema
  webPage: (name: string, description: string, url: string, lastModified?: string) => ({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": name,
    "description": description,
    "url": url,
    "dateModified": lastModified || new Date().toISOString(),
    "isPartOf": {
      "@type": "WebSite",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "about": {
      "@type": "Thing",
      "name": "MQL5 Trading Robot Generation"
    },
    "primaryImageOfPage": {
      "@type": "ImageObject",
      "url": "https://quanforge.ai/og-image.png",
      "width": 1200,
      "height": 630
    },
    "inLanguage": "en-US",
    "potentialAction": {
      "@type": "ReadAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": url
      }
    }
  }),

  // Enhanced Article schema
  article: (title: string, description: string, url: string, author: string = "QuantForge AI", publishedTime?: string, lastModified?: string) => ({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "url": url,
    "datePublished": publishedTime || new Date().toISOString(),
    "dateModified": lastModified || new Date().toISOString(),
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
        "url": "https://quanforge.ai/logo.png",
        "width": 512,
        "height": 512
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    },
    "image": {
      "@type": "ImageObject",
      "url": "https://quanforge.ai/og-image.png",
      "width": 1200,
      "height": 630
    },
    "inLanguage": "en-US",
    "isAccessibleForFree": true,
    "genre": ["Technology", "Finance", "Trading", "Software Development"],
    "keywords": "MQL5, trading, AI, MetaTrader 5, automated trading"
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
        "text": q.answer
      }
    })),
    "description": "Frequently asked questions about QuantForge AI and MQL5 trading robot generation",
    "name": "QuantForge AI FAQ"
  }),

  // How-to schema for tutorials
  howTo: (name: string, description: string, steps: Array<{ name: string; text: string; image?: string }>) => ({
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
      "text": step.text,
      ...(step.image && {
        "image": {
          "@type": "ImageObject",
          "url": step.image
        }
      })
    }))
  }),

  // Breadcrumb schema
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

  // Video schema for video content
  video: (name: string, description: string, thumbnailUrl: string, contentUrl: string, duration?: string) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": name,
    "description": description,
    "thumbnailUrl": thumbnailUrl,
    "contentUrl": contentUrl,
    "uploadDate": new Date().toISOString(),
    ...(duration && { "duration": duration }),
    "publisher": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png"
      }
    }
  }),

  // Event schema for webinars/events
  event: (name: string, description: string, startDate: string, endDate: string, location?: string) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    "name": name,
    "description": description,
    "startDate": startDate,
    "endDate": endDate,
    "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
    "eventStatus": "https://schema.org/EventScheduled",
    "location": location ? {
      "@type": "Place",
      "name": location
    } : {
      "@type": "VirtualLocation",
      "url": "https://quanforge.ai"
    },
    "organizer": {
      "@type": "Organization",
      "name": "QuantForge AI",
      "url": "https://quanforge.ai"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    }
  })
};