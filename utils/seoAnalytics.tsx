import React, { useEffect, useState } from 'react';

interface SEOAnalyticsProps {
  pageUrl: string;
  pageTitle: string;
}

export const SEOAnalytics: React.FC<SEOAnalyticsProps> = ({ pageUrl, pageTitle }) => {
  const [scrollDepth, setScrollDepth] = useState(0);
  const [timeOnPage, setTimeOnPage] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollPercentage = Math.round((scrollTop / (documentHeight - windowHeight)) * 100);
      setScrollDepth(Math.max(scrollDepth, scrollPercentage));
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollDepth]);

  // Track time on page
  useEffect(() => {
    const timer = setInterval(() => {
      if (isVisible) {
        setTimeOnPage(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible]);

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Send analytics data on page unload
  useEffect(() => {
    const handlePageUnload = () => {
      // Send data to analytics service
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'page_engagement', {
          page_title: pageTitle,
          page_location: pageUrl,
          scroll_depth: scrollDepth,
          time_on_page: timeOnPage,
          custom_parameter_1: 'quantforge_ai'
        });
      }
    };

    window.addEventListener('beforeunload', handlePageUnload);
    return () => window.removeEventListener('beforeunload', handlePageUnload);
  }, [pageUrl, pageTitle, scrollDepth, timeOnPage]);

  return null; // This component doesn't render anything
};

// Schema.org JSON-LD generator for dynamic content
export const generateStructuredData = (type: string, data: Record<string, any>) => {
  const baseSchema = {
    "@context": "https://schema.org",
    "@type": type,
    ...data
  };

  return JSON.stringify(baseSchema);
};

// Core Web Vitals monitoring
export const reportWebVitals = (metric: any) => {
  // Send to analytics service
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', metric.name, {
      event_category: 'Web Vitals',
      event_label: metric.id,
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      non_interaction: true,
      custom_parameter_1: 'quantforge_ai'
    });
  }
};

// Lazy loading for images
export const LazyImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}> = ({ src, alt, className, width, height }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={className}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}
    </div>
  );
};

// Preload critical resources
export const preloadCriticalResources = () => {
  const resources = [
    { href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
    { href: '/fonts/jetbrains-mono.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
    { href: '/og-image.png', as: 'image' }
  ];

  resources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource.href;
    link.as = resource.as;
    if (resource.type) link.type = resource.type;
    if (resource.crossOrigin) link.crossOrigin = resource.crossOrigin;
    document.head.appendChild(link);
  });
};

// Generate alternate language links
export const generateAlternateLinks = (currentUrl: string, languages: string[] = ['en', 'id']) => {
  return languages.map(lang => ({
    rel: 'alternate',
    hrefLang: lang,
    href: lang === 'en' ? currentUrl : `${currentUrl}?lang=${lang}`
  }));
};

// Optimize images for SEO
export const optimizeImageSrc = (src: string, width?: number, height?: number, quality: number = 80) => {
  // If using a CDN like Cloudinary or similar, you can optimize images here
  if (src.includes('cloudinary') || src.includes('imgix')) {
    const params = new URLSearchParams();
    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    params.append('q', quality.toString());
    params.append('auto', 'format');
    
    return `${src}?${params.toString()}`;
  }
  
  return src;
};

// Generate SEO-friendly URLs
export const generateSeoUrl = (title: string, id?: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  return id ? `${slug}-${id}` : slug;
};

// Meta description generator
export const generateMetaDescription = (content: string, maxLength: number = 160): string => {
  const cleaned = content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  return cleaned.substring(0, maxLength - 3).trim() + '...';
};

// Keyword density analyzer
export const analyzeKeywordDensity = (text: string, keywords: string[]): Record<string, number> => {
  const words = text.toLowerCase().split(/\s+/);
  const totalWords = words.length;
  const density: Record<string, number> = {};
  
  keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    const count = words.filter(word => word.includes(keywordLower)).length;
    density[keyword] = totalWords > 0 ? (count / totalWords) * 100 : 0;
  });
  
  return density;
};

// Generate table of contents for long content
export const generateTableOfContents = (content: string): Array<{ id: string; title: string; level: number }> => {
  const headings = content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi) || [];
  
  return headings.map((heading, index) => {
    const level = parseInt(heading.match(/h([1-6])/i)?.[1] || '1');
    const title = heading.replace(/<[^>]*>/g, '');
    const id = `heading-${index}`;
    
    return { id, title, level };
  });
};

// Schema.org BreadcrumbList generator
export const generateBreadcrumbSchema = (breadcrumbs: Array<{ name: string; url: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": breadcrumbs.map((crumb, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": crumb.name,
    "item": crumb.url
  }))
});

// Open Graph image optimizer
export const optimizeOgImage = (_title: string, _description: string, _brand: string = 'QuantForge AI'): string => {
  // This would typically point to an image generation service
  // For now, return the default OG image
  return '/og-image.png';
};

// Twitter Card optimizer
export const generateTwitterCard = (title: string, description: string, image: string) => ({
  'twitter:card': 'summary_large_image',
  'twitter:title': title,
  'twitter:description': description,
  'twitter:image': image,
  'twitter:site': '@quanforge',
  'twitter:creator': '@quanforge'
});

// Robots meta tag generator
export const generateRobotsMeta = (index: boolean = true, follow: boolean = true, noArchive: boolean = false): string => {
  const directives = [];
  
  if (!index) directives.push('noindex');
  if (!follow) directives.push('nofollow');
  if (noArchive) directives.push('noarchive');
  
  return directives.length > 0 ? directives.join(', ') : 'index, follow';
};