import React, { useEffect, useCallback } from 'react';

interface ComprehensiveSEOProps {
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
  author?: string;
  publishDate?: string;
  modifiedDate?: string;
  category?: string;
  tags?: string[];
  enableAnalytics?: boolean;
  breadcrumbs?: Array<{ name: string; url: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  howToSteps?: Array<{ name: string; text: string; image?: string }>;
  videoData?: {
    name: string;
    description: string;
    thumbnailUrl: string;
    contentUrl?: string;
    duration?: number;
  };
  courseData?: {
    name: string;
    description: string;
    provider: string;
    educationalLevel?: string;
  };
  eventData?: {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
  };
  productData?: {
    name: string;
    description: string;
    price: string;
    currency?: string;
    availability?: string;
    brand?: string;
  };
  reviewData?: {
    itemReviewed: string;
    reviewBody: string;
    author: string;
    rating: number;
  };
  serviceData?: {
    name: string;
    description: string;
    provider: string;
    serviceType?: string;
    areaServed?: string;
  };
  organizationData?: {
    name: string;
    description: string;
    url: string;
    logo?: string;
    contactPoint?: {
      contactType: string;
      availableLanguage: string[];
    };
  };
  websiteData?: {
    name: string;
    url: string;
    description?: string;
  };
  searchActionData?: {
    target: string;
    queryInput: string;
  };
  localBusinessData?: {
    name: string;
    description: string;
    address: {
      streetAddress: string;
      addressLocality: string;
      addressRegion: string;
      postalCode: string;
      addressCountry: string;
    };
    geo?: {
      latitude: number;
      longitude: number;
    };
    openingHours?: string[];
    telephone?: string;
  };
  personData?: {
    name: string;
    jobTitle: string;
    description: string;
    url?: string;
    sameAs?: string[];
  };
  bookData?: {
    name: string;
    description: string;
    author: string;
    isbn?: string;
    numberOfPages?: number;
    genre?: string[];
    keywords?: string;
  };
  recipeData?: {
    name: string;
    description: string;
    ingredients: string[];
    instructions: string[];
    cookTime?: string;
    prepTime?: string;
    totalTime?: string;
    recipeCategory?: string;
    recipeCuisine?: string;
  };
  datasetData?: {
    name: string;
    description: string;
    license?: string;
    distribution?: Array<{
      encodingFormat: string;
      contentUrl: string;
    }>;
  };
  creativeWorkData?: {
    name: string;
    description: string;
    author?: string;
    dateCreated?: string;
    dateModified?: string;
    genre?: string;
    keywords?: string[];
    about?: Array<{
      '@type': string;
      name: string;
    }>;
    mentions?: Array<{
      '@type': string;
      name: string;
      url?: string;
    }>;
  };
  eventAttendanceMode?: 'online' | 'offline' | 'mixed';
  eventStatus?: 'scheduled' | 'cancelled' | 'movedOnline' | 'postponed' | 'rescheduled';
  audienceType?: string;
  offers?: Array<{
    price: string;
    priceCurrency: string;
    availability: string;
    validFrom?: string;
    seller?: string;
  }>;
  aggregateRating?: {
    ratingValue: string;
    reviewCount: string;
    bestRating?: string;
    worstRating?: string;
  };
  reviews?: Array<{
    author: string;
    datePublished: string;
    reviewBody: string;
    ratingValue: string;
  }>;
  inLanguage?: string[];
  isPartOf?: {
    name: string;
    url: string;
  };
  mainEntityOfPage?: {
    '@type': string;
    '@id': string;
  };
  about?: Array<{
    '@type': string;
    name: string;
  }>;
  mentions?: Array<{
    '@type': string;
    name: string;
    url?: string;
  }>;
  sameAs?: string[];
  url?: string;
  identifier?: string;
  additionalType?: string[];
  potentialAction?: Record<string, any>;
  subjectOf?: Record<string, any>;
  isBasedOn?: string | Record<string, any>;
  translationOfWork?: string | Record<string, any>;
  workTranslation?: string | Record<string, any>;
  exampleOfWork?: string | Record<string, any>;
  workExample?: string | Record<string, any>;
  genre?: string[];
  schemaKeywords?: string[];
  position?: string;
  awards?: string[];
  contentLocation?: Record<string, any>;
  contentReferenceTime?: string;
  spatialCoverage?: Record<string, any>;
  temporalCoverage?: string;
  audience?: Record<string, any>;
  educationalUse?: string;
  learningResourceType?: string;
  teaches?: string[];
  assessedBy?: Record<string, any>;
  competencyRequired?: string[];
  educationalLevel?: string;
  schemaAbout?: string[];
  interactivityType?: string;
  isFamilyFriendly?: boolean;
  typicalAgeRange?: string;
  gender?: string;
  accessibilityFeature?: string[];
  accessibilityHazard?: string[];
  accessibilityAPI?: string[];
  accessibilityControl?: string[];
  accessibilitySummary?: string;
  schemaOffers?: Record<string, any>;
  requiresSubscription?: boolean;
  isAccessibleForFree?: boolean;
  thumbnailUrl?: string;
  image?: string | Array<Record<string, any>>;
  provider?: Record<string, any>;
  publisher?: Record<string, any>;
  sourceOrganization?: Record<string, any>;
  sponsor?: Record<string, any>;
  funding?: Record<string, any>;
  endorsement?: Record<string, any>;
  funder?: Record<string, any>;
  award?: string;
  character?: Record<string, any>;
  actor?: Record<string, any>;
  director?: Record<string, any>;
  producer?: Record<string, any>;
  musicBy?: Record<string, any>;
  creator?: Record<string, any>;
  contributor?: Record<string, any>;
  editor?: Record<string, any>;
  illustrator?: Record<string, any>;
  colorist?: Record<string, any>;
  inker?: Record<string, any>;
  letterer?: Record<string, any>;
  penciler?: Record<string, any>;
  review?: Record<string, any>;
  schemaAggregateRating?: Record<string, any>;
  schemaOffers2?: Record<string, any>;
  size?: string;
  material?: string;
  weight?: string;
  color?: string;
  pattern?: string;
  condition?: string;
  model?: string;
  sku?: string;
  gtin?: string;
  brand?: Record<string, any>;
  manufacturer?: Record<string, any>;
  releaseDate?: string;
  productionDate?: string;
  purchaseDate?: string;
  warranty?: string;
  schemaCategory?: string;
  subCategory?: string;
  schemaTags?: string[];
  additionalProperty?: Array<Record<string, any>>;
  variesBy?: Array<Record<string, any>>;
  hasVariant?: Array<Record<string, any>>;
  isVariantOf?: Record<string, any>;
  prequel?: Record<string, any>;
  sequel?: Record<string, any>;
  followUp?: Record<string, any>;
  previousItem?: Record<string, any>;
  nextItem?: Record<string, any>;
  mainEntity?: Record<string, any>;
  schemaMentions?: Array<Record<string, any>>;
  comment?: Array<Record<string, any>>;
  commentCount?: number;
  interactionStatistic?: Array<Record<string, any>>;
  schemaIsPartOf?: Record<string, any>;
  hasPart?: Array<Record<string, any>>;
  schemaPosition?: number;
  itemListElement?: Array<Record<string, any>>;
  numberOfItems?: number;
}

const SEO_CONFIG = {
  siteName: 'QuantForge AI',
  siteUrl: 'https://quanforge.ai',
  defaultImage: '/og-image.png',
  twitterHandle: '@quanforge',
  author: 'QuantForge AI',
  themeColor: '#22c55e',
  language: 'en',
  locale: 'en_US'
};

export const ComprehensiveSEO: React.FC<ComprehensiveSEOProps> = ({
  title = 'QuantForge AI - Advanced MQL5 Trading Robot Generator | MetaTrader 5',
  description = 'Generate professional MQL5 trading robots and Expert Advisors using AI. Powered by Google Gemini 3.0/2.5. Create, test, and deploy automated trading strategies for MetaTrader 5 with visual strategy configuration and real-time market simulation.',
  keywords = 'MQL5 generator, MetaTrader 5, trading robot, Expert Advisor, AI trading, automated trading, forex robot, algorithmic trading, Gemini AI, trading strategy generator, MT5 EA, quantitative trading, forex EA, MQL5 EA builder, automated forex trading, AI trading bot, MetaTrader expert advisor, trading algorithm generator, MQL5 development, forex algorithm, trading automation, AI trading system, quantitative finance, algorithmic trading platform, MT5 programming, Expert Advisor development, forex bot creator, automated trading software, MQL5 coder, trading strategy automation, AI-powered trading, forex robot development, MetaTrader automation',
  ogImage = SEO_CONFIG.defaultImage,
  ogUrl = 'https://quanforge.ai',
  canonicalUrl = 'https://quanforge.ai',
  type = 'website',
  structuredData = [],
  noIndex = false,
  alternateUrls = [],
  pageType = 'other',
  author = 'QuantForge AI',
  publishDate,
  modifiedDate,
  category,
  tags = [],
  enableAnalytics = true,
  breadcrumbs = [],
  faqs = [],
  howToSteps = [],
  videoData,
  courseData,
  eventData,
  productData,
  reviewData,
  serviceData,
  organizationData,
  websiteData,
  searchActionData,
  localBusinessData,
  personData,
  bookData,
  recipeData,
  datasetData,
  creativeWorkData,
  eventAttendanceMode = 'online',
  eventStatus = 'scheduled',
  audienceType = 'Traders, Developers, Financial Institutions',
  offers = [],
  aggregateRating,
  reviews = [],
  inLanguage = ['en'],
  isPartOf,
  mainEntityOfPage,
  about = [],
  mentions = [],
  sameAs = [],
  url,
  identifier,
  additionalType = [],
  potentialAction,
  subjectOf,
  isBasedOn,
  translationOfWork,
  workTranslation,
  exampleOfWork,
  workExample,
  genre = [],
  keywords: schemaKeywords = [],
  position,
  awards = [],
  contentLocation,
  contentReferenceTime,
  spatialCoverage,
  temporalCoverage,
  audience,
  educationalUse,
  learningResourceType,
  teaches = [],
  assessedBy,
  competencyRequired = [],
  educationalLevel,
  about: schemaAbout = [],
  interactivityType,
  isFamilyFriendly = true,
  typicalAgeRange,
  gender,
  accessibilityFeature = [],
  accessibilityHazard = [],
  accessibilityAPI = [],
  accessibilityControl = [],
  accessibilitySummary,
  offers: schemaOffers,
  requiresSubscription = false,
  isAccessibleForFree = true,
  thumbnailUrl,
  image,
  provider,
  publisher,
  sourceOrganization,
  sponsor,
  funding,
  endorsement,
  funder,
  award,
  character,
  actor,
  director,
  producer,
  musicBy,
  creator,
  contributor,
  editor,
  illustrator,
  colorist,
  inker,
  letterer,
  penciler,
  review,
  aggregateRating: schemaAggregateRating,
  offers: schemaOffers2,
  size,
  material,
  weight,
  color,
  pattern,
  condition,
  model,
  sku,
  gtin,
  brand,
  manufacturer,
  releaseDate,
  productionDate,
  purchaseDate,
  warranty,
  category: schemaCategory,
  subCategory,
  tags: schemaTags = [],
  additionalProperty = [],
  variesBy = [],
  hasVariant = [],
  isVariantOf,
  prequel,
  sequel,
  followUp,
  previousItem,
  nextItem,
  mainEntity,
  mentions: schemaMentions = [],
  comment = [],
  commentCount,
  interactionStatistic = [],
  isPartOf: schemaIsPartOf,
  hasPart = [],
  position: schemaPosition,
  itemListElement = [],
  numberOfItems
}) => {
  // Generate comprehensive structured data
  const generateStructuredData = useCallback(() => {
    const schemas: Record<string, any>[] = [];

    // Base organization schema
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": organizationData?.name || "QuantForge AI",
      "description": organizationData?.description || "Advanced MQL5 Trading Robot Generator powered by AI",
      "url": organizationData?.url || "https://quanforge.ai",
      "logo": organizationData?.logo || {
        "@type": "ImageObject",
        "url": "https://quanforge.ai/logo.png",
        "width": 512,
        "height": 512
      },
      "contactPoint": organizationData?.contactPoint || {
        "@type": "ContactPoint",
        "contactType": "customer service",
        "availableLanguage": ["English", "Indonesian", "Chinese", "Japanese", "Spanish", "French", "German", "Korean", "Portuguese", "Russian"]
      },
      "sameAs": sameAs.length > 0 ? sameAs : [
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
    });

    // Software Application schema
    schemas.push({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "QuantForge AI",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web",
      "description": description,
      "url": canonicalUrl,
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
        "Expert Advisor Creation",
        "Multi-Language Support",
        "Cloud Storage",
        "Advanced Analytics",
        "Monte Carlo Simulation"
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
      "offers": offers.length > 0 ? offers : [{
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
        "seller": {
          "@type": "Organization",
          "name": "QuantForge AI"
        }
      }],
      "aggregateRating": aggregateRating || {
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
    });

    // WebPage schema
    schemas.push({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "description": description,
      "url": canonicalUrl,
      "dateModified": modifiedDate || new Date().toISOString(),
      "datePublished": publishDate || new Date().toISOString(),
      "lastReviewed": new Date().toISOString(),
      "author": {
        "@type": "Organization",
        "name": author
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
      "isPartOf": isPartOf || {
        "@type": "WebSite",
        "name": "QuantForge AI",
        "url": "https://quanforge.ai",
        "description": "Advanced MQL5 Trading Robot Generator powered by AI"
      },
      "about": about.length > 0 ? about : [{
        "@type": "Thing",
        "name": "MQL5 Trading Robot Generation",
        "description": "Creating automated trading strategies using AI"
      }],
      "breadcrumb": breadcrumbs.length > 0 ? {
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbs.map((crumb, breadcrumbIndex) => ({
          "@type": "ListItem",
          "position": breadcrumbIndex + 1,
          "name": crumb.name,
          "item": crumb.url
        }))
      } : {
        "@type": "BreadcrumbList",
        "itemListElement": [{
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://quanforge.ai"
        }]
      },
      "potentialAction": potentialAction || {
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
      "mainEntityOfPage": mainEntityOfPage,
      "mentions": mentions.length > 0 ? mentions : undefined,
      "inLanguage": inLanguage,
      "isAccessibleForFree": isAccessibleForFree,
      "keywords": schemaKeywords.length > 0 ? schemaKeywords : keywords,
      "genre": genre.length > 0 ? genre : undefined,
      "audience": audience || {
        "@type": "Audience",
        "audienceType": audienceType
      }
    });

    // Website schema with search action
    schemas.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": websiteData?.name || "QuantForge AI",
      "url": websiteData?.url || "https://quanforge.ai",
      "description": websiteData?.description || description,
      "publisher": {
        "@type": "Organization",
        "name": "QuantForge AI"
      },
      "potentialAction": searchActionData || {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://quanforge.ai/search?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    });

    // Video schema if video data is provided
    if (videoData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": videoData.name,
        "description": videoData.description,
        "thumbnailUrl": videoData.thumbnailUrl,
        "uploadDate": new Date().toISOString(),
        "duration": videoData.duration ? `PT${videoData.duration}S` : undefined,
        "contentUrl": videoData.contentUrl || "https://quanforge.ai/videos/",
        "embedUrl": "https://quanforge.ai/videos/embed/",
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
        "educationalUse": educationalUse || "instruction",
        "learningResourceType": learningResourceType || "video",
        "audience": {
          "@type": "EducationalAudience",
          "educationalRole": "student"
        },
        "inLanguage": inLanguage,
        "isAccessibleForFree": isAccessibleForFree,
        "isFamilyFriendly": isFamilyFriendly
      });
    }

    // Course schema if course data is provided
    if (courseData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Course",
        "name": courseData.name,
        "description": courseData.description,
        "provider": {
          "@type": "Organization",
          "name": courseData.provider
        },
        "educationalLevel": courseData.educationalLevel || "Beginner to Advanced",
        "inLanguage": inLanguage,
        "about": ["MQL5 Programming", "Algorithmic Trading", "AI Integration"],
        "teaches": teaches.length > 0 ? teaches : [
          "MQL5 Programming Fundamentals",
          "Trading Strategy Development",
          "AI-Powered Code Generation",
          "Risk Management",
          "Backtesting Techniques",
          "Performance Optimization"
        ],
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
        "totalTime": "PT40H",
        "coursePrerequisites": "Basic programming knowledge recommended",
        "educationalUse": educationalUse,
        "learningResourceType": learningResourceType || "course",
        "audience": {
          "@type": "EducationalAudience",
          "educationalRole": "student"
        },
        "isAccessibleForFree": isAccessibleForFree,
        "offers": offers.length > 0 ? offers : [{
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock"
        }]
      });
    }

    // Event schema if event data is provided
    if (eventData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Event",
        "name": eventData.name,
        "description": eventData.description,
        "startDate": eventData.startDate,
        "endDate": eventData.endDate,
        "eventAttendanceMode": `https://schema.org/${eventAttendanceMode}EventAttendanceMode`,
        "eventStatus": `https://schema.org/Event${eventStatus}`,
        "location": eventAttendanceMode === 'online' ? {
          "@type": "VirtualLocation",
          "url": "https://quanforge.ai"
        } : undefined,
        "organizer": {
          "@type": "Organization",
          "name": "QuantForge AI",
          "url": "https://quanforge.ai"
        },
        "offers": offers.length > 0 ? offers : [{
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock"
        }],
        "audience": {
          "@type": "Audience",
          "audienceType": audienceType
        },
        "inLanguage": inLanguage
      });
    }

    // Product schema if product data is provided
    if (productData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": productData.name,
        "description": productData.description,
        "brand": brand || {
          "@type": "Brand",
          "name": productData.brand || "QuantForge AI"
        },
        "offers": offers.length > 0 ? offers : [{
          "@type": "Offer",
          "price": productData.price,
          "priceCurrency": productData.currency || "USD",
          "availability": `https://schema.org/${productData.availability || "InStock"}`,
          "seller": {
            "@type": "Organization",
            "name": "QuantForge AI"
          }
        }],
        "aggregateRating": aggregateRating || schemaAggregateRating,
        "reviews": reviews.length > 0 ? reviews : undefined,
        "category": schemaCategory || category,
        "keywords": schemaTags.length > 0 ? schemaTags : tags,
        "manufacturer": manufacturer || {
          "@type": "Organization",
          "name": "QuantForge AI"
        },
        "releaseDate": releaseDate,
        "model": model,
        "sku": sku,
        "gtin": gtin
      });
    }

    // Service schema if service data is provided
    if (serviceData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Service",
        "name": serviceData.name,
        "description": serviceData.description,
        "provider": {
          "@type": "Organization",
          "name": serviceData.provider,
          "url": "https://quanforge.ai"
        },
        "serviceType": serviceData.serviceType || "Software Development",
        "areaServed": serviceData.areaServed || "Worldwide",
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
            }
          ]
        },
        "audience": {
          "@type": "Audience",
          "audienceType": audienceType
        }
      });
    }

    // Local Business schema if local business data is provided
    if (localBusinessData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": localBusinessData.name,
        "description": localBusinessData.description,
        "address": localBusinessData.address,
        "geo": localBusinessData.geo,
        "openingHours": localBusinessData.openingHours,
        "telephone": localBusinessData.telephone,
        "url": "https://quanforge.ai",
        "sameAs": sameAs
      });
    }

    // Person schema if person data is provided
    if (personData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Person",
        "name": personData.name,
        "jobTitle": personData.jobTitle,
        "description": personData.description,
        "url": personData.url,
        "worksFor": {
          "@type": "Organization",
          "name": "QuantForge AI"
        },
        "sameAs": personData.sameAs || [
          "https://linkedin.com/in/" + personData.name.toLowerCase().replace(/\s+/g, ''),
          "https://twitter.com/" + personData.name.toLowerCase().replace(/\s+/g, '')
        ]
      });
    }

    // Book schema if book data is provided
    if (bookData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Book",
        "name": bookData.name,
        "description": bookData.description,
        "author": {
          "@type": "Person",
          "name": bookData.author
        },
        "publisher": {
          "@type": "Organization",
          "name": "QuantForge AI Publishing"
        },
        "datePublished": publishDate || new Date().toISOString(),
        "inLanguage": inLanguage,
        "genre": bookData.genre || ["Technology", "Finance", "Programming"],
        "keywords": bookData.keywords || "MQL5, Trading, Algorithmic Trading, MetaTrader 5",
        "isbn": bookData.isbn,
        "numberOfPages": bookData.numberOfPages
      });
    }

    // Recipe schema if recipe data is provided
    if (recipeData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": recipeData.name,
        "description": recipeData.description,
        "recipeIngredient": recipeData.ingredients,
        "recipeInstructions": recipeData.instructions.map((instruction, instructionIndex) => ({
          "@type": "HowToStep",
          "position": instructionIndex + 1,
          "text": instruction
        })),
        "recipeCategory": recipeData.recipeCategory || "Technology",
        "recipeCuisine": recipeData.recipeCuisine || "Algorithmic Trading",
        "cookTime": recipeData.cookTime,
        "prepTime": recipeData.prepTime,
        "totalTime": recipeData.totalTime
      });
    }

    // Dataset schema if dataset data is provided
    if (datasetData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": datasetData.name,
        "description": datasetData.description,
        "publisher": {
          "@type": "Organization",
          "name": "QuantForge AI"
        },
        "license": datasetData.license || "https://creativecommons.org/licenses/by/4.0/",
        "distribution": datasetData.distribution || [
          {
            "@type": "DataDownload",
            "encodingFormat": "application/json",
            "contentUrl": "https://quanforge.ai/api/data"
          }
        ]
      });
    }

    // Creative Work schema if creative work data is provided
    if (creativeWorkData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": creativeWorkData.name,
        "description": creativeWorkData.description,
        "author": creativeWorkData.author ? {
          "@type": "Organization",
          "name": creativeWorkData.author
        } : {
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
        "dateModified": creativeWorkData.dateModified || new Date().toISOString(),
        "datePublished": creativeWorkData.dateCreated || new Date().toISOString(),
        "genre": creativeWorkData.genre,
        "keywords": creativeWorkData.keywords,
        "about": creativeWorkData.about,
        "mentions": creativeWorkData.mentions
      });
    }

    // FAQ schema if FAQs are provided
    if (faqs.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      });
    }

    // HowTo schema if steps are provided
    if (howToSteps.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": "Create MQL5 Trading Robot",
        "description": "Learn how to create professional MQL5 trading robots using AI",
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
        "step": howToSteps.map((step, stepIndex) => ({
          "@type": "HowToStep",
          "position": stepIndex + 1,
          "name": step.name,
          "text": step.text,
          "image": step.image ? {
            "@type": "ImageObject",
            "url": step.image
          } : undefined
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
      });
    }

    // Review schema if review data is provided
    if (reviewData) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Review",
        "itemReviewed": {
          "@type": "SoftwareApplication",
          "name": reviewData.itemReviewed,
          "applicationCategory": "FinanceApplication"
        },
        "reviewBody": reviewData.reviewBody,
        "author": {
          "@type": "Person",
          "name": reviewData.author
        },
        "datePublished": new Date().toISOString(),
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": reviewData.rating.toString(),
          "bestRating": "5",
          "worstRating": "1"
        }
      });
    }

    // Add custom structured data
    schemas.push(...structuredData);

    return schemas;
  }, [
    title, description, canonicalUrl, author, publishDate, modifiedDate, category, tags,
    breadcrumbs, faqs, howToSteps, videoData, courseData, eventData, productData,
    reviewData, serviceData, organizationData, websiteData, searchActionData,
    localBusinessData, personData, bookData, recipeData, datasetData,
    creativeWorkData, eventAttendanceMode, eventStatus, audienceType, offers,
    aggregateRating, reviews, inLanguage, isPartOf, mainEntityOfPage, about,
    mentions, sameAs, url, identifier, additionalType, potentialAction, subjectOf,
    isBasedOn, translationOfWork, workTranslation, exampleOfWork, workExample,
    genre, schemaKeywords, position, awards, contentLocation, contentReferenceTime,
    spatialCoverage, temporalCoverage, audience, educationalUse, learningResourceType,
    teaches, assessedBy, competencyRequired, educationalLevel, schemaAbout,
    interactivityType, isFamilyFriendly, typicalAgeRange, gender, accessibilityFeature,
    accessibilityHazard, accessibilityAPI, accessibilityControl, accessibilitySummary,
    schemaOffers, requiresSubscription, isAccessibleForFree, thumbnailUrl, image,
    provider, publisher, sourceOrganization, sponsor, funding, endorsement, funder,
    award, character, actor, director, producer, musicBy, creator, contributor,
    editor, illustrator, colorist, inker, letterer, penciler, review,
    schemaAggregateRating, schemaOffers2, size, material, weight, color, pattern,
    condition, model, sku, gtin, brand, manufacturer, releaseDate, productionDate,
    purchaseDate, warranty, schemaCategory, subCategory, schemaTags, additionalProperty,
    variesBy, hasVariant, isVariantOf, prequel, sequel, followUp, previousItem,
    nextItem, mainEntity, schemaMentions, comment, commentCount, interactionStatistic,
    schemaIsPartOf, hasPart, schemaPosition, itemListElement, numberOfItems,
    structuredData
  ]);

  // Enhanced meta tags generation
  const generateMetaTags = useCallback(() => {
    const metaTags: Array<{ name?: string; property?: string; content: string; [key: string]: any }> = [];

    // Basic meta tags
    metaTags.push({ name: 'description', content: description });
    metaTags.push({ name: 'keywords', content: keywords });
    metaTags.push({ name: 'author', content: author });
    metaTags.push({ name: 'robots', content: noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' });
    
    // Language and geo targeting
    metaTags.push({ name: 'language', content: SEO_CONFIG.language });
    metaTags.push({ name: 'geo.region', content: 'US' });
    metaTags.push({ name: 'geo.placename', content: 'Global' });
    metaTags.push({ name: 'distribution', content: 'global' });
    metaTags.push({ name: 'rating', content: 'general' });
    metaTags.push({ name: 'revisit-after', content: '7 days' });
    metaTags.push({ name: 'category', content: 'finance, technology, trading, artificial intelligence' });
    metaTags.push({ name: 'coverage', content: 'Worldwide' });
    metaTags.push({ name: 'target', content: 'all' });
    
    // Mobile optimization
    metaTags.push({ name: 'HandheldFriendly', content: 'True' });
    metaTags.push({ name: 'MobileOptimized', content: '320' });
    metaTags.push({ name: 'apple-mobile-web-app-capable', content: 'yes' });
    metaTags.push({ name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });
    metaTags.push({ name: 'format-detection', content: 'telephone=no' });
    metaTags.push({ name: 'mobile-web-app-capable', content: 'yes' });
    metaTags.push({ name: 'apple-mobile-web-app-title', content: 'QuantForge AI' });
    metaTags.push({ name: 'application-name', content: 'QuantForge AI' });
    
    // Theme and branding
    metaTags.push({ name: 'theme-color', content: SEO_CONFIG.themeColor });
    metaTags.push({ name: 'msapplication-TileColor', content: SEO_CONFIG.themeColor });
    metaTags.push({ name: 'msapplication-config', content: '/browserconfig.xml' });
    metaTags.push({ name: 'msapplication-TileImage', content: '/mstile-144x144.png' });
    
    // Security and privacy
    metaTags.push({ name: 'referrer', content: 'no-referrer-when-downgrade' });
    metaTags.push({ name: 'copyright', content: 'QuantForge AI' });
    metaTags.push({ name: 'classification', content: 'Software' });
    
    // Content classification
    metaTags.push({ name: 'content-language', content: SEO_CONFIG.language });
    metaTags.push({ name: 'content-type', content: 'text/html; charset=utf-8' });
    
    // Additional meta tags
    metaTags.push({ name: 'abstract', content: 'AI-powered MQL5 trading robot generator for MetaTrader 5' });
    metaTags.push({ name: 'topic', content: 'Trading, Finance, Artificial Intelligence, Software Development' });
    metaTags.push({ name: 'summary', content: 'Generate professional MQL5 trading robots using AI technology' });
    metaTags.push({ name: 'url', content: canonicalUrl });
    metaTags.push({ name: 'identifier-URL', content: canonicalUrl });
    metaTags.push({ name: 'directory', content: 'submission' });
    metaTags.push({ name: 'pagename', content: 'QuantForge AI' });
    metaTags.push({ name: 'subtitle', content: 'Advanced MQL5 Trading Robot Generator' });
    metaTags.push({ name: 'target_country', content: 'US' });
    metaTags.push({ name: 'page-topic', content: 'Trading Software Development' });
    metaTags.push({ name: 'syndication-source', content: canonicalUrl });
    metaTags.push({ name: 'original-source', content: canonicalUrl });
    
    // Date meta tags for articles
    if (publishDate) {
      metaTags.push({ name: 'article:published_time', content: publishDate });
    }
    if (modifiedDate) {
      metaTags.push({ name: 'article:modified_time', content: modifiedDate });
    }
    if (publishDate) {
      metaTags.push({ name: 'last-modified', content: modifiedDate || publishDate });
    }
    
    // Category and tags
    if (category) {
      metaTags.push({ name: 'article:section', content: category });
    }
    tags.forEach(tag => {
      metaTags.push({ name: 'article:tag', content: tag });
    });
    
    // Open Graph tags
    metaTags.push({ property: 'og:title', content: title });
    metaTags.push({ property: 'og:description', content: description });
    metaTags.push({ property: 'og:type', content: type });
    metaTags.push({ property: 'og:image', content: ogImage });
    metaTags.push({ property: 'og:image:width', content: '1200' });
    metaTags.push({ property: 'og:image:height', content: '630' });
    metaTags.push({ property: 'og:image:alt', content: title });
    metaTags.push({ property: 'og:url', content: ogUrl });
    metaTags.push({ property: 'og:site_name', content: SEO_CONFIG.siteName });
    metaTags.push({ property: 'og:locale', content: SEO_CONFIG.locale });
    
    // Article specific Open Graph tags
    if (type === 'article' || pageType === 'blog') {
      metaTags.push({ property: 'article:author', content: author });
      if (publishDate) {
        metaTags.push({ property: 'article:published_time', content: publishDate });
      }
      if (modifiedDate) {
        metaTags.push({ property: 'article:modified_time', content: modifiedDate });
      }
      if (category) {
        metaTags.push({ property: 'article:section', content: category });
      }
      tags.forEach(tag => {
        metaTags.push({ property: 'article:tag', content: tag });
      });
    }
    
    // Product specific Open Graph tags
    if (type === 'product' || pageType === 'generator') {
      metaTags.push({ property: 'product:brand', content: 'QuantForge AI' });
      metaTags.push({ property: 'product:availability', content: 'in stock' });
      metaTags.push({ property: 'product:condition', content: 'new' });
      metaTags.push({ property: 'product:price:amount', content: '0' });
      metaTags.push({ property: 'product:price:currency', content: 'USD' });
    }
    
    // Facebook specific
    metaTags.push({ property: 'fb:app_id', content: 'your-facebook-app-id' });
    
    // Twitter Card tags
    metaTags.push({ name: 'twitter:card', content: 'summary_large_image' });
    metaTags.push({ name: 'twitter:title', content: title });
    metaTags.push({ name: 'twitter:description', content: description });
    metaTags.push({ name: 'twitter:image', content: ogImage });
    metaTags.push({ name: 'twitter:image:alt', content: title });
    metaTags.push({ name: 'twitter:site', content: SEO_CONFIG.twitterHandle });
    metaTags.push({ name: 'twitter:creator', content: SEO_CONFIG.twitterHandle });
    metaTags.push({ name: 'twitter:domain', content: 'quanforge.ai' });
    
    // Verification meta tags (placeholders)
    metaTags.push({ name: 'google-site-verification', content: 'your-google-verification-code' });
    metaTags.push({ name: 'msvalidate.01', content: 'your-bing-verification-code' });
    metaTags.push({ name: 'yandex-verification', content: 'your-yandex-verification-code' });
    metaTags.push({ name: 'p:domain_verify', content: 'your-pinterest-verification-code' });

    return metaTags;
  }, [title, description, keywords, author, noIndex, type, pageType, category, tags, publishDate, modifiedDate, ogImage, ogUrl]);

  // Update document head with meta tags and structured data
  useEffect(() => {
    // Update document title
    document.title = title.includes(SEO_CONFIG.siteName) ? title : `${title} | ${SEO_CONFIG.siteName}`;
    
    // Clear existing meta tags and structured data
    const existingMetaTags = document.querySelectorAll('meta[data-seo="true"]');
    existingMetaTags.forEach(tag => tag.remove());
    
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => script.remove());
    
    // Add new meta tags
    const metaTags = generateMetaTags();
    metaTags.forEach(metaTag => {
      const meta = document.createElement('meta');
      meta.setAttribute('data-seo', 'true');
      
      if (metaTag.property) {
        meta.setAttribute('property', metaTag.property);
      } else if (metaTag.name) {
        meta.setAttribute('name', metaTag.name);
      }
      
      meta.setAttribute('content', metaTag.content);
      document.head.appendChild(meta);
    });
    
    // Add canonical URL
    let canonical: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);
    
    // Add alternate language links
    const existingAlternateLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existingAlternateLinks.forEach(link => link.remove());
    
    const defaultAlternateUrls = [
      { hrefLang: 'en', url: canonicalUrl },
      { hrefLang: 'x-default', url: canonicalUrl },
      { hrefLang: 'en-US', url: canonicalUrl },
      { hrefLang: 'id', url: `${canonicalUrl}?lang=id` },
      { hrefLang: 'zh-CN', url: `${canonicalUrl}?lang=zh` },
      { hrefLang: 'ja', url: `${canonicalUrl}?lang=ja` },
      { hrefLang: 'es', url: `${canonicalUrl}?lang=es` },
      { hrefLang: 'fr', url: `${canonicalUrl}?lang=fr` },
      { hrefLang: 'de', url: `${canonicalUrl}?lang=de` },
      { hrefLang: 'ko', url: `${canonicalUrl}?lang=ko` },
      { hrefLang: 'pt', url: `${canonicalUrl}?lang=pt` },
      { hrefLang: 'ru', url: `${canonicalUrl}?lang=ru` },
      { hrefLang: 'ar', url: `${canonicalUrl}?lang=ar` },
      { hrefLang: 'hi', url: `${canonicalUrl}?lang=hi` },
      { hrefLang: 'it', url: `${canonicalUrl}?lang=it` },
      { hrefLang: 'nl', url: `${canonicalUrl}?lang=nl` },
      { hrefLang: 'tr', url: `${canonicalUrl}?lang=tr` }
    ];
    
    const allAlternateUrls = [...defaultAlternateUrls, ...alternateUrls];
    allAlternateUrls.forEach(alt => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', alt.hrefLang);
      link.setAttribute('href', alt.url);
      document.head.appendChild(link);
    });
    
    // Add structured data
    const structuredData = generateStructuredData();
    structuredData.forEach((data) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-structured-data', 'true');
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });
    
    // Add DNS prefetch and preconnect for performance
    const dnsPrefetchDomains = [
      '//fonts.googleapis.com',
      '//fonts.gstatic.com',
      '//cdn.tailwindcss.com',
      '//cdnjs.cloudflare.com',
      '//www.googletagmanager.com',
      '//connect.facebook.net',
      '//www.google-analytics.com',
      '//*.supabase.co'
    ];
    
    dnsPrefetchDomains.forEach(domain => {
      let link: HTMLLinkElement | null = document.querySelector(`link[rel="dns-prefetch"][href="${domain}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'dns-prefetch');
        link.setAttribute('href', domain);
        document.head.appendChild(link);
      }
    });
    
    const preconnectDomains = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://*.supabase.co'
    ];
    
    preconnectDomains.forEach(domain => {
      let link: HTMLLinkElement | null = document.querySelector(`link[rel="preconnect"][href="${domain}"]`);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'preconnect');
        link.setAttribute('href', domain);
        if (domain.includes('gstatic') || domain.includes('supabase')) {
          link.setAttribute('crossorigin', 'anonymous');
        }
        document.head.appendChild(link);
      }
    });
    
    // Cleanup function
    return () => {
      const metaTags = document.querySelectorAll('meta[data-seo="true"]');
      metaTags.forEach(tag => tag.remove());
      
      const scripts = document.querySelectorAll('script[data-structured-data="true"]');
      scripts.forEach(script => script.remove());
    };
  }, [title, canonicalUrl, generateMetaTags, generateStructuredData, alternateUrls]);

  // SEO Analytics tracking
  useEffect(() => {
    if (!enableAnalytics) return;
    
    // Track page view
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', 'G-XXXXXXXXXX', {
        page_title: title,
        page_location: canonicalUrl,
        custom_parameter_1: 'quantforge_ai',
        custom_parameter_2: pageType
      });
    }
    
    // Track Core Web Vitals
    const trackWebVitals = () => {
      if ('PerformanceObserver' in window) {
        try {
          // Track Largest Contentful Paint (LCP)
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) {
              if (typeof window !== 'undefined' && (window as any).gtag) {
                (window as any).gtag('event', 'LCP', {
                  value: Math.round(lastEntry.startTime),
                  event_category: 'Web Vitals',
                  event_label: 'Largest Contentful Paint',
                  non_interaction: true,
                  custom_parameter_1: 'quantforge_ai',
                  custom_parameter_2: pageType
                });
              }
            }
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
          
          // Track First Input Delay (FID)
          const fidObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry: any) => {
              if (entry.processingStart && entry.startTime) {
                const fid = entry.processingStart - entry.startTime;
                if (typeof window !== 'undefined' && (window as any).gtag) {
                  (window as any).gtag('event', 'FID', {
                    value: Math.round(fid),
                    event_category: 'Web Vitals',
                    event_label: 'First Input Delay',
                    non_interaction: true,
                    custom_parameter_1: 'quantforge_ai',
                    custom_parameter_2: pageType
                  });
                }
              }
            });
          });
          fidObserver.observe({ entryTypes: ['first-input'] });
          
          // Track Cumulative Layout Shift (CLS)
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
                event_category: 'Web Vitals',
                event_label: 'Cumulative Layout Shift',
                non_interaction: true,
                custom_parameter_1: 'quantforge_ai',
                custom_parameter_2: pageType
              });
            }
          });
          clsObserver.observe({ entryTypes: ['layout-shift'] });
        } catch (error) {
          // Web Vitals not supported
        }
      }
    };
    
    trackWebVitals();
  }, [enableAnalytics, title, canonicalUrl, pageType]);

  return null;
};

export default ComprehensiveSEO;