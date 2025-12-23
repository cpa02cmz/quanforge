import { performanceMonitor } from './performance';

interface SEOHealthMetrics {
  score: number;
  issues: SEOIssue[];
  recommendations: string[];
  lastChecked: string;
}

interface SEOIssue {
  type: 'error' | 'warning' | 'info';
  category: 'meta' | 'content' | 'technical' | 'performance';
  message: string;
  element?: string;
  suggestion: string;
}

interface PageSEOData {
  title: string;
  description: string;
  keywords: string[];
  headings: HeadingStructure[];
  images: ImageData[];
  links: LinkData[];
  structuredData: StructuredDataItem[];
}

interface HeadingStructure {
  level: number;
  text: string;
  id?: string;
}

interface ImageData {
  src: string;
  alt: string;
  title?: string;
  hasAlt: boolean;
  isOptimized: boolean;
}

interface LinkData {
  href: string;
  text: string;
  isInternal: boolean;
  hasRel: boolean;
  relValue?: string;
}

interface StructuredDataItem {
  type: string;
  context: string;
  isValid: boolean;
  errors: string[];
}

class SEOMonitor {
  private metrics: SEOHealthMetrics | null = null;
  private observers: MutationObserver[] = [];

  constructor() {
    this.initializeMonitoring();
  }

  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Monitor DOM changes for SEO impact
    this.observeDOMChanges();
    
    // Monitor performance metrics
    this.monitorPerformanceMetrics();
    
    // Run initial SEO audit
    this.runSEOAudit();
  }

  private observeDOMChanges(): void {
    if (!window.MutationObserver) return;

    const observer = new MutationObserver((mutations) => {
      let shouldReaudit = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check for SEO-relevant changes
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (this.isSEORelevantElement(element)) {
                shouldReaudit = true;
              }
            }
          });
        }
      });

      if (shouldReaudit) {
        // Debounce re-audit
        setTimeout(() => this.runSEOAudit(), 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.push(observer);
  }

  private isSEORelevantElement(element: Element): boolean {
    const seoTags = ['title', 'meta', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'a', 'script'];
    return seoTags.includes(element.tagName.toLowerCase()) ||
           element.getAttribute('property')?.startsWith('og:') ||
           element.getAttribute('name')?.includes('description') ||
           element.getAttribute('type') === 'application/ld+json';
  }

  private monitorPerformanceMetrics(): void {
    // Monitor Core Web Vitals
    this.monitorFCP();
    this.monitorLCP();
    this.monitorFID();
    this.monitorCLS();
  }

  private monitorFCP(): void {
    if (!window.PerformanceObserver) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          performanceMonitor.recordMetric('seo_fcp', entry.startTime);
          
          // FCP should be under 1.8s for good SEO
          if (entry.startTime > 1800) {
            this.addIssue({
              type: 'warning',
              category: 'performance',
              message: `First Contentful Paint is slow (${Math.round(entry.startTime)}ms)`,
              suggestion: 'Optimize loading of critical resources and reduce server response time'
            });
          }
        }
      });
    });

    observer.observe({ type: 'paint', buffered: true });
  }

  private monitorLCP(): void {
    if (!window.PerformanceObserver) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        performanceMonitor.recordMetric('seo_lcp', entry.startTime);
        
        // LCP should be under 2.5s for good SEO
        if (entry.startTime > 2500) {
          this.addIssue({
            type: 'warning',
            category: 'performance',
            message: `Largest Contentful Paint is slow (${Math.round(entry.startTime)}ms)`,
            suggestion: 'Optimize images and reduce render-blocking resources'
          });
        }
      });
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  }

  private monitorFID(): void {
    if (!window.PerformanceObserver) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if ('processingStart' in entry) {
          const fid = (entry as any).processingStart - entry.startTime;
          performanceMonitor.recordMetric('seo_fid', fid);
          
          // FID should be under 100ms for good SEO
          if (fid > 100) {
            this.addIssue({
              type: 'warning',
              category: 'performance',
              message: `First Input Delay is high (${Math.round(fid)}ms)`,
              suggestion: 'Reduce JavaScript execution time and break up long tasks'
            });
          }
        }
      });
    });

    observer.observe({ type: 'first-input', buffered: true });
  }

  private monitorCLS(): void {
    if (!window.PerformanceObserver) return;

    let clsValue = 0;
    
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          performanceMonitor.recordMetric('seo_cls', clsValue);
          
          // CLS should be under 0.1 for good SEO
          if (clsValue > 0.1) {
            this.addIssue({
              type: 'warning',
              category: 'performance',
              message: `Cumulative Layout Shift is high (${clsValue.toFixed(3)})`,
              suggestion: 'Ensure images have dimensions and avoid inserting content above existing content'
            });
          }
        }
      });
    });

    observer.observe({ type: 'layout-shift', buffered: true });
  }

  private async runSEOAudit(): Promise<void> {
    const issues: SEOIssue[] = [];
    const pageData = this.analyzePage();
    
    // Audit title
    this.auditTitle(pageData.title, issues);
    
    // Audit meta description
    this.auditMetaDescription(pageData.description, issues);
    
    // Audit headings structure
    this.auditHeadings(pageData.headings, issues);
    
    // Audit images
    this.auditImages(pageData.images, issues);
    
    // Audit links
    this.auditLinks(pageData.links, issues);
    
    // Audit structured data
    this.auditStructuredData(pageData.structuredData, issues);
    
    // Audit content quality
    this.auditContentQuality(pageData, issues);
    
    // Calculate SEO score
    const score = this.calculateSEOScore(issues);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(issues);
    
    this.metrics = {
      score,
      issues,
      recommendations,
      lastChecked: new Date().toISOString()
    };

    // SEO audit results available in this.metrics
  }

  private analyzePage(): PageSEOData {
    const title = document.title || '';
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const description = descriptionMeta?.getAttribute('content') || '';
    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    const keywords = keywordsMeta?.getAttribute('content')?.split(',').map(k => k.trim()) || [];
    
    // Analyze headings
    const headings: HeadingStructure[] = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
      headings.push({
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent || '',
        id: heading.id
      });
    });
    
    // Analyze images
    const images: ImageData[] = [];
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('data-src') || '';
      const alt = img.alt || '';
      const title = img.title || '';
      
      images.push({
        src,
        alt,
        title,
        hasAlt: alt.length > 0,
        isOptimized: this.isImageOptimized(img)
      });
    });
    
    // Analyze links
    const links: LinkData[] = [];
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href') || '';
      const text = link.textContent || '';
      const isInternal = href.startsWith('/') || href.includes(window.location.hostname);
      const hasRel = link.hasAttribute('rel');
      const relValue = link.getAttribute('rel') || undefined;
      
      links.push({
        href,
        text,
        isInternal,
        hasRel,
        ...(relValue && { relValue })
      });
    });
    
    // Analyze structured data
    const structuredData: StructuredDataItem[] = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '');
        structuredData.push({
          type: data['@type'] || 'Unknown',
          context: data['@context'] || 'Unknown',
          isValid: this.validateStructuredData(data),
          errors: this.getStructuredDataErrors(data)
        });
      } catch (error) {
        structuredData.push({
          type: 'Invalid',
          context: 'Unknown',
          isValid: false,
          errors: ['Invalid JSON format']
        });
      }
    });
    
    return {
      title,
      description,
      keywords,
      headings,
      images,
      links,
      structuredData
    };
  }

  private auditTitle(title: string, issues: SEOIssue[]): void {
    if (!title) {
      issues.push({
        type: 'error',
        category: 'meta',
        message: 'Missing page title',
        suggestion: 'Add a descriptive title tag to every page'
      });
      return;
    }
    
    if (title.length < 30) {
      issues.push({
        type: 'warning',
        category: 'meta',
        message: 'Title is too short',
        suggestion: 'Use titles between 30-60 characters for better SEO'
      });
    }
    
    if (title.length > 60) {
      issues.push({
        type: 'warning',
        category: 'meta',
        message: 'Title is too long',
        suggestion: 'Keep titles under 60 characters to avoid truncation in search results'
      });
    }
    
    if (!title.toLowerCase().includes('quanforge')) {
      issues.push({
        type: 'info',
        category: 'meta',
        message: 'Title doesn\'t include brand name',
        suggestion: 'Consider including "QuantForge" in your title for brand recognition'
      });
    }
  }

  private auditMetaDescription(description: string, issues: SEOIssue[]): void {
    if (!description) {
      issues.push({
        type: 'error',
        category: 'meta',
        message: 'Missing meta description',
        suggestion: 'Add a compelling meta description to improve click-through rates'
      });
      return;
    }
    
    if (description.length < 120) {
      issues.push({
        type: 'warning',
        category: 'meta',
        message: 'Meta description is too short',
        suggestion: 'Use descriptions between 120-160 characters for optimal display'
      });
    }
    
    if (description.length > 160) {
      issues.push({
        type: 'warning',
        category: 'meta',
        message: 'Meta description is too long',
        suggestion: 'Keep descriptions under 160 characters to avoid truncation'
      });
    }
  }

  private auditHeadings(headings: HeadingStructure[], issues: SEOIssue[]): void {
    const h1Headings = headings.filter(h => h.level === 1);
    
    if (h1Headings.length === 0) {
      issues.push({
        type: 'error',
        category: 'content',
        message: 'Missing H1 heading',
        suggestion: 'Add one H1 heading per page for better SEO and accessibility'
      });
    } else if (h1Headings.length > 1) {
      issues.push({
        type: 'warning',
        category: 'content',
        message: 'Multiple H1 headings found',
        suggestion: 'Use only one H1 heading per page'
      });
    }
    
    // Check for proper heading hierarchy
    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];
      
      if (current && previous && current.level > previous.level + 1) {
        issues.push({
          type: 'warning',
          category: 'content',
          message: `Heading hierarchy skip: H${previous.level} to H${current.level}`,
          suggestion: 'Maintain proper heading hierarchy (don\'t skip levels)'
        });
      }
    }
  }

  private auditImages(images: ImageData[], issues: SEOIssue[]): void {
    images.forEach((image, index) => {
      if (!image.hasAlt) {
        issues.push({
          type: 'warning',
          category: 'content',
          message: `Image ${index + 1} missing alt text`,
          element: image.src,
          suggestion: 'Add descriptive alt text to all images for accessibility and SEO'
        });
      }
      
      if (!image.isOptimized) {
        issues.push({
          type: 'info',
          category: 'technical',
          message: `Image ${index + 1} could be optimized`,
          element: image.src,
          suggestion: 'Compress images and use next-gen formats like WebP'
        });
      }
    });
  }

  private auditLinks(links: LinkData[], issues: SEOIssue[]): void {
    const internalLinks = links.filter(l => l.isInternal);
    const externalLinks = links.filter(l => !l.isInternal);
    
    // Check for external links without rel="noopener"
    externalLinks.forEach(link => {
      if (!link.hasRel || !link.relValue?.includes('noopener')) {
        issues.push({
          type: 'warning',
          category: 'technical',
          message: 'External link missing rel="noopener"',
          element: link.href,
          suggestion: 'Add rel="noopener" to external links for security'
        });
      }
    });
    
    // Check for broken internal links
    internalLinks.forEach(link => {
      if (link.href === '#' || link.href === '') {
        issues.push({
          type: 'warning',
          category: 'technical',
          message: 'Empty or placeholder link found',
          element: link.href,
          suggestion: 'Update or remove empty links'
        });
      }
    });
  }

  private auditStructuredData(structuredData: StructuredDataItem[], issues: SEOIssue[]): void {
    if (structuredData.length === 0) {
      issues.push({
        type: 'info',
        category: 'technical',
        message: 'No structured data found',
        suggestion: 'Add structured data to help search engines understand your content'
      });
      return;
    }
    
    structuredData.forEach(item => {
      if (!item.isValid) {
        issues.push({
          type: 'error',
          category: 'technical',
          message: `Invalid structured data: ${item.type}`,
          suggestion: 'Fix structured data format and syntax errors'
        });
      }
      
      item.errors.forEach(error => {
        issues.push({
          type: 'warning',
          category: 'technical',
          message: `Structured data error: ${error}`,
          suggestion: 'Review and correct structured data implementation'
        });
      });
    });
  }

  private auditContentQuality(pageData: PageSEOData, issues: SEOIssue[]): void {
    const textContent = document.body.textContent || '';
    const wordCount = textContent.split(/\s+/).length;
    
    if (wordCount < 300) {
      issues.push({
        type: 'warning',
        category: 'content',
        message: 'Low word count',
        suggestion: 'Add more comprehensive content (aim for 300+ words)'
      });
    }
    
    // Check for keyword density in content
    const keywords = pageData.keywords.slice(0, 5); // Check top 5 keywords
    keywords.forEach(keyword => {
      const density = this.calculateKeywordDensity(textContent, keyword);
      if (density > 3) {
        issues.push({
          type: 'warning',
          category: 'content',
          message: `High keyword density for "${keyword}"`,
          suggestion: 'Reduce keyword stuffing and write more naturally'
        });
      }
    });
  }

  private calculateKeywordDensity(text: string, keyword: string): number {
    const words = text.toLowerCase().split(/\s+/);
    const keywordLower = keyword.toLowerCase();
    const matches = words.filter(word => word.includes(keywordLower)).length;
    return (matches / words.length) * 100;
  }

  private isImageOptimized(img: HTMLImageElement): boolean {
    // Basic optimization checks
    const src = img.src || img.getAttribute('data-src') || '';
    
    // Check for modern formats
    if (src.includes('.webp') || src.includes('.avif')) {
      return true;
    }
    
    // Check for responsive images
    if (img.srcset || img.sizes) {
      return true;
    }
    
    // Check for loading attribute
    if (img.loading === 'lazy') {
      return true;
    }
    
    return false;
  }

  private validateStructuredData(data: any): boolean {
    // Basic validation
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    if (!data['@context'] || !data['@type']) {
      return false;
    }
    
    // Could add more sophisticated validation based on type
    return true;
  }

  private getStructuredDataErrors(data: any): string[] {
    const errors: string[] = [];
    
    if (!data['@context']) {
      errors.push('Missing @context');
    }
    
    if (!data['@type']) {
      errors.push('Missing @type');
    }
    
    return errors;
  }

  private calculateSEOScore(issues: SEOIssue[]): number {
    let score = 100;
    
    issues.forEach(issue => {
      switch (issue.type) {
        case 'error':
          score -= 10;
          break;
        case 'warning':
          score -= 5;
          break;
        case 'info':
          score -= 2;
          break;
      }
    });
    
    return Math.max(0, score);
  }

  private generateRecommendations(issues: SEOIssue[]): string[] {
    const recommendations: string[] = [];
    
    // Group issues by category and generate recommendations
    const categories = ['meta', 'content', 'technical', 'performance'];
    
    categories.forEach(category => {
      const categoryIssues = issues.filter(i => i.category === category);
      if (categoryIssues.length > 0) {
        const priorityIssues = categoryIssues.filter(i => i.type === 'error');
        if (priorityIssues.length > 0) {
          recommendations.push(`Fix ${category} issues: ${priorityIssues.map(i => i.message).join(', ')}`);
        }
      }
    });
    
    // Add general recommendations
    if (recommendations.length === 0) {
      recommendations.push('Great job! Your page is well-optimized for SEO.');
    }
    
    return recommendations;
  }

  private addIssue(issue: SEOIssue): void {
    if (!this.metrics) {
      this.metrics = {
        score: 100,
        issues: [],
        recommendations: [],
        lastChecked: new Date().toISOString()
      };
    }
    
    this.metrics.issues.push(issue);
    this.metrics.score = this.calculateSEOScore(this.metrics.issues);
    this.metrics.recommendations = this.generateRecommendations(this.metrics.issues);
  }

  public getMetrics(): SEOHealthMetrics | null {
    return this.metrics;
  }

  public getIssuesByCategory(category: SEOIssue['category']): SEOIssue[] {
    return this.metrics?.issues.filter(issue => issue.category === category) || [];
  }

  public getIssuesByType(type: SEOIssue['type']): SEOIssue[] {
    return this.metrics?.issues.filter(issue => issue.type === type) || [];
  }

  public forceAudit(): void {
    this.runSEOAudit();
  }

  public destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

export const seoMonitor = new SEOMonitor();
export default SEOMonitor;