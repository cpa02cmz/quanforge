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
  })
};