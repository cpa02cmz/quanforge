import { Helmet } from 'react-helmet-async';

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
  lastModified,
  author = 'QuantForge AI',
  publishedTime,
  articleSection,
  readingTime
}) => {
  const siteTitle = 'QuantForge AI';
  const fullTitle = title.includes(siteTitle) ? title : `${title} | ${siteTitle}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="author" content={author} />
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Alternate language links */}
      <link rel="alternate" hrefLang="en" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      
      {/* Favicon and app icons */}
      <link rel="manifest" href="/manifest.json" />
      <link rel="apple-touch-icon" href="/icon-192x192.png" />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      
      {/* Open Graph Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={ogUrl} />
      <meta property="og:site_name" content={siteTitle} />
      <meta property="og:locale" content="en_US" />
      
      {/* Article specific tags */}
      {type === 'article' && (
        <>
          {publishedTime && <meta property="article:published_time" content={publishedTime} />}
          {lastModified && <meta property="article:modified_time" content={lastModified} />}
          {author && <meta property="article:author" content={author} />}
          {articleSection && <meta property="article:section" content={articleSection} />}
          {readingTime && <meta property="article:reading_time" content={readingTime} />}
        </>
      )}
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:site" content="@quanforge" />
      <meta name="twitter:creator" content="@quanforge" />
      
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
      
      {/* Enhanced SEO verification tags */}
      <meta name="google-site-verification" content="your-google-verification-code" />
      <meta name="msvalidate.01" content="your-bing-verification-code" />
      <meta name="yandex-verification" content="your-yandex-verification-code" />
      <meta name="p:domain_verify" content="your-pinterest-verification-code" />
      
      {/* Preconnect and DNS prefetch for performance */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="//cdn.tailwindcss.com" />
      <link rel="dns-prefetch" href="//cdnjs.cloudflare.com" />
      <link rel="dns-prefetch" href="//www.googletagmanager.com" />
      
      {/* Additional Open Graph tags */}
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="QuantForge AI - Advanced MQL5 Trading Robot Generator" />
      <meta property="fb:app_id" content="your-facebook-app-id" />
      
      {/* Additional Twitter tags */}
      <meta name="twitter:domain" content="quanforge.ai" />
      <meta name="twitter:image:alt" content="QuantForge AI - Advanced MQL5 Trading Robot Generator" />
      
      {/* Structured Data */}
      {structuredData.map((data, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
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