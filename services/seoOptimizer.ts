import { SEOMonitor } from '../utils/enhancedSEO';

interface SEOOptimizationConfig {
  enableLazyLoading: boolean;
  enableImageOptimization: boolean;
  enablePrefetching: boolean;
  enablePreloading: boolean;
  enableServiceWorker: boolean;
  enableCompression: boolean;
  enableCaching: boolean;
}

interface SEOAuditResult {
  score: number;
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    element?: string;
    recommendation: string;
  }>;
  metrics: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
}

class SEOOptimizer {
  private config: SEOOptimizationConfig;
  private auditResults: SEOAuditResult[] = [];

  constructor(config: Partial<SEOOptimizationConfig> = {}) {
    this.config = {
      enableLazyLoading: true,
      enableImageOptimization: true,
      enablePrefetching: true,
      enablePreloading: true,
      enableServiceWorker: true,
      enableCompression: true,
      enableCaching: true,
      ...config
    };
  }

  // Initialize SEO optimizations
  initialize(): void {
    if (typeof window === 'undefined') return;

    // Start monitoring
    SEOMonitor.trackCoreWebVitals();
    SEOMonitor.trackPagePerformance();
    SEOMonitor.trackSEOHealth();

    // Apply optimizations
    this.optimizeImages();
    this.optimizeLinks();
    this.optimizeMetaTags();
    this.setupServiceWorker();
    this.setupResourceHints();

    // Run initial audit
    this.runSEOAudit();
  }

  // Optimize images for better SEO and performance
  private optimizeImages(): void {
    if (!this.config.enableImageOptimization) return;

    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
      const imgElement = img as HTMLImageElement;

      // Add loading="lazy" to images below the fold
      if (this.config.enableLazyLoading && !imgElement.hasAttribute('loading')) {
        const rect = imgElement.getBoundingClientRect();
        if (rect.top > window.innerHeight) {
          imgElement.setAttribute('loading', 'lazy');
        }
      }

      // Ensure alt text for accessibility and SEO
      if (!imgElement.hasAttribute('alt')) {
        imgElement.setAttribute('alt', ''); // Empty alt for decorative images
        console.warn(`Image at index ${index} missing alt attribute`);
      }

      // Add error handling
      imgElement.addEventListener('error', () => {
        imgElement.style.display = 'none';
        console.warn(`Failed to load image: ${imgElement.src}`);
      });

      // Add responsive image attributes if missing
      if (!imgElement.hasAttribute('sizes') && imgElement.srcset) {
        imgElement.setAttribute('sizes', '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw');
      }
    });
  }

  // Optimize internal and external links
  private optimizeLinks(): void {
    const links = document.querySelectorAll('a');
    links.forEach(link => {
      const linkElement = link as HTMLAnchorElement;
      const href = linkElement.getAttribute('href');

      if (!href) return;

      // Add external link attributes
      if (href.startsWith('http') && !href.includes(window.location.hostname)) {
        if (!linkElement.hasAttribute('rel')) {
          linkElement.setAttribute('rel', 'noopener noreferrer');
        }
        if (!linkElement.hasAttribute('target')) {
          linkElement.setAttribute('target', '_blank');
        }
      }

      // Prefetch important pages
      if (this.config.enablePrefetching && href.startsWith('/') && this.isImportantPage(href)) {
        this.prefetchPage(href);
      }
    });
  }

  // Optimize meta tags dynamically
  private optimizeMetaTags(): void {
    // Ensure viewport meta tag
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0';
      document.head.appendChild(viewport);
    }

    // Ensure theme-color meta tag
    if (!document.querySelector('meta[name="theme-color"]')) {
      const themeColor = document.createElement('meta');
      themeColor.name = 'theme-color';
      themeColor.content = '#22c55e';
      document.head.appendChild(themeColor);
    }

    // Optimize title length
    const title = document.title;
    if (title.length > 60) {
      console.warn('Title too long for SEO (>60 characters):', title.length);
    } else if (title.length < 30) {
      console.warn('Title too short for SEO (<30 characters):', title.length);
    }

    // Optimize meta description
    const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (metaDescription) {
      const description = metaDescription.content;
      if (description.length > 160) {
        console.warn('Meta description too long for SEO (>160 characters):', description.length);
      } else if (description.length < 120) {
        console.warn('Meta description too short for SEO (<120 characters):', description.length);
      }
    }
  }

  // Setup service worker for caching
  private setupServiceWorker(): void {
    if (!this.config.enableServiceWorker || typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
        })
        .catch(error => {
          console.warn('Service Worker registration failed:', error);
        });
    }
  }

  // Setup resource hints for better performance
  private setupResourceHints(): void {
    if (!this.config.enablePreloading) return;

    // Preconnect to external domains
    const domains = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://cdn.tailwindcss.com'
    ];

    domains.forEach(domain => {
      if (!document.querySelector(`link[rel="preconnect"][href="${domain}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = domain;
        if (domain.includes('gstatic')) {
          link.crossOrigin = 'anonymous';
        }
        document.head.appendChild(link);
      }
    });

    // Preload critical resources
    const criticalResources = [
      { href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
      { href: '/css/main.css', as: 'style' }
    ];

    criticalResources.forEach(resource => {
      if (!document.querySelector(`link[rel="preload"][href="${resource.href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preload';
        Object.assign(link, resource);
        document.head.appendChild(link);
      }
    });
  }

  // Prefetch pages for faster navigation
  private prefetchPage(href: string): void {
    if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }

  // Check if page is important for prefetching
  private isImportantPage(href: string): boolean {
    const importantPages = ['/generator', '/wiki', '/faq', '/features'];
    return importantPages.some(page => href.includes(page));
  }

  // Run comprehensive SEO audit
  runSEOAudit(): SEOAuditResult {
    const issues: SEOAuditResult['issues'] = [];
    let score = 100;

    // Audit title
    const title = document.title;
    if (!title) {
      issues.push({
        type: 'error',
        message: 'Missing page title',
        recommendation: 'Add a descriptive title tag to every page'
      });
      score -= 20;
    } else if (title.length > 60) {
      issues.push({
        type: 'warning',
        message: 'Title too long for optimal SEO',
        recommendation: 'Keep titles under 60 characters for best search engine display'
      });
      score -= 5;
    }

    // Audit meta description
    const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (!metaDescription || !metaDescription.content) {
      issues.push({
        type: 'error',
        message: 'Missing meta description',
        recommendation: 'Add a compelling meta description (150-160 characters)'
      });
      score -= 15;
    }

    // Audit headings
    const h1Elements = document.querySelectorAll('h1');
    if (h1Elements.length === 0) {
      issues.push({
        type: 'error',
        message: 'Missing H1 tag',
        recommendation: 'Add one H1 tag per page for better SEO structure'
      });
      score -= 10;
    } else if (h1Elements.length > 1) {
      issues.push({
        type: 'warning',
        message: 'Multiple H1 tags found',
        recommendation: 'Use only one H1 tag per page, use H2-H6 for subheadings'
      });
      score -= 5;
    }

    // Audit images
    const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
    if (imagesWithoutAlt.length > 0) {
      issues.push({
        type: 'warning',
        message: `${imagesWithoutAlt.length} images missing alt attributes`,
        recommendation: 'Add descriptive alt text to all images for accessibility and SEO'
      });
      score -= Math.min(imagesWithoutAlt.length * 2, 10);
    }

    // Audit internal links
    const internalLinks = document.querySelectorAll('a[href^="/"], a[href^="' + window.location.origin + '"]');
    if (internalLinks.length < 3) {
      issues.push({
        type: 'info',
        message: 'Few internal links found',
        recommendation: 'Add more internal links to improve site navigation and SEO'
      });
      score -= 3;
    }

    // Audit page speed (simplified)
    const performanceMetrics = this.getPerformanceMetrics();
    if (performanceMetrics.loadTime > 3000) {
      issues.push({
        type: 'warning',
        message: 'Page load time is slow',
        recommendation: 'Optimize images, enable compression, and reduce server response time'
      });
      score -= 10;
    }

    const result: SEOAuditResult = {
      score: Math.max(0, score),
      issues,
      metrics: {
        performance: Math.max(0, 100 - (performanceMetrics.loadTime / 100)),
        accessibility: 100 - (imagesWithoutAlt.length * 5),
        bestPractices: 100 - (h1Elements.length > 1 ? 10 : 0),
        seo: Math.max(0, score)
      }
    };

    this.auditResults.push(result);
    console.log('SEO Audit Result:', result);
    return result;
  }

  // Get performance metrics
  private getPerformanceMetrics() {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return { loadTime: 0, domContentLoaded: 0 };
    }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
      domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0
    };
  }

  // Get latest audit results
  getAuditResults(): SEOAuditResult[] {
    return this.auditResults;
  }

  // Generate structured data for breadcrumbs
  generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>) {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": crumb.name,
        "item": crumb.url
      }))
    };
  }

  // Generate FAQ schema
  generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
    return {
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
    };
  }

  // Generate How-To schema
  generateHowToSchema(name: string, description: string, steps: Array<{ name: string; text: string; image?: string }>) {
    return {
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
          "name": "MetaTrader 5 Platform"
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
    };
  }

  // Add structured data to page
  addStructuredData(structuredData: Record<string, any>): void {
    // Remove existing structured data of the same type
    const existingScripts = document.querySelectorAll(`script[type="application/ld+json"]`);
    existingScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '{}');
        if (data['@type'] === structuredData['@type']) {
          script.remove();
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }

  // Optimize for Core Web Vitals
  optimizeForCoreWebVitals(): void {
    // Defer non-critical CSS
    const nonCriticalCSS = document.querySelectorAll('link[rel="stylesheet"]:not([data-critical])');
    nonCriticalCSS.forEach(link => {
      const linkElement = link as HTMLLinkElement;
      linkElement.media = 'print';
      linkElement.onload = function() {
        linkElement.media = 'all';
      };
    });

    // Minimize layout shifts
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      const imgElement = img as HTMLImageElement;
      if (!imgElement.hasAttribute('width') || !imgElement.hasAttribute('height')) {
        // Add aspect ratio to prevent layout shift
        imgElement.style.aspectRatio = '16/9';
      }
    });

    // Optimize font loading
    const fonts = document.querySelectorAll('link[rel="stylesheet"][href*="fonts"]');
    fonts.forEach(font => {
      const fontElement = font as HTMLLinkElement;
      fontElement.rel = 'preload';
      fontElement.as = 'style';
      fontElement.onload = function() {
        fontElement.rel = 'stylesheet';
      };
    });
  }
}

// Export singleton instance
export const seoOptimizer = new SEOOptimizer();

// Export types and utilities
export type { SEOOptimizationConfig, SEOAuditResult };
export { SEOOptimizer };