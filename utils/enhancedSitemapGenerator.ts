import { writeFileSync } from 'fs';
import { join } from 'path';

// Enhanced sitemap generator for QuantForge AI
export interface SitemapURL {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  images?: SitemapImage[];
  videos?: SitemapVideo[];
  alternates?: Array<{ hreflang: string; url: string }>;
}

export interface SitemapImage {
  loc: string;
  title?: string;
  caption?: string;
  geo_location?: string;
  license?: string;
}

export interface SitemapVideo {
  title: string;
  description: string;
  thumbnail_loc: string;
  content_loc?: string;
  duration?: number;
  publication_date?: string;
}

export interface SitemapConfig {
  baseUrl: string;
  outputDir: string;
  defaultChangefreq: SitemapURL['changefreq'];
  defaultPriority: number;
  includeImages: boolean;
  includeVideos: boolean;
  includeAlternates: boolean;
  supportedLanguages: Array<{ code: string; url: string }>;
}

const DEFAULT_CONFIG: SitemapConfig = {
  baseUrl: 'https://quanforge.ai',
  outputDir: './public',
  defaultChangefreq: 'weekly',
  defaultPriority: 0.8,
  includeImages: true,
  includeVideos: true,
  includeAlternates: true,
  supportedLanguages: [
    { code: 'en', url: '' },
    { code: 'en-US', url: '' },
    { code: 'x-default', url: '' },
    { code: 'id', url: '?lang=id' },
    { code: 'zh-CN', url: '?lang=zh' },
    { code: 'ja', url: '?lang=ja' },
    { code: 'es', url: '?lang=es' },
    { code: 'fr', url: '?lang=fr' },
    { code: 'de', url: '?lang=de' },
    { code: 'ko', url: '?lang=ko' },
    { code: 'pt', url: '?lang=pt' },
    { code: 'ru', url: '?lang=ru' }
  ]
};

export class EnhancedSitemapGenerator {
  private config: SitemapConfig;
  private urls: SitemapURL[] = [];

  constructor(config: Partial<SitemapConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Add URL to sitemap
  addURL(url: SitemapURL): void {
    const fullURL: SitemapURL = {
      url: url.url.startsWith('http') ? url.url : `${this.config.baseUrl}${url.url}`,
      lastmod: url.lastmod || new Date().toISOString().split('T')[0],
      changefreq: url.changefreq || this.config.defaultChangefreq,
      priority: url.priority || this.config.defaultPriority,
      images: url.images || [],
      videos: url.videos || [],
      alternates: url.alternates || []
    };

    // Add language alternates if enabled
    if (this.config.includeAlternates && (!fullURL.alternates || fullURL.alternates.length === 0)) {
      fullURL.alternates = this.generateAlternates(fullURL.url);
    }

    this.urls.push(fullURL);
  }

  // Add multiple URLs
  addURLs(urls: SitemapURL[]): void {
    urls.forEach(url => this.addURL(url));
  }

  // Generate language alternates
  private generateAlternates(url: string): Array<{ hreflang: string; url: string }> {
    return this.config.supportedLanguages.map(lang => ({
      hreflang: lang.code,
      url: `${url}${lang.url}`
    }));
  }

  // Generate XML sitemap
  generateSitemap(): string {
    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" 
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" 
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0">`;

    const xmlFooter = '</urlset>';

    const urlEntries = this.urls.map(url => this.formatURLEntry(url)).join('\n');

    return `${xmlHeader}\n${urlEntries}\n${xmlFooter}`;
  }

  // Format individual URL entry
  private formatURLEntry(url: SitemapURL): string {
    let entry = '  <url>\n';
    entry += `    <loc>${this.escapeXML(url.url)}</loc>\n`;
    
    if (url.lastmod) {
      entry += `    <lastmod>${url.lastmod}</lastmod>\n`;
    }
    
    if (url.changefreq) {
      entry += `    <changefreq>${url.changefreq}</changefreq>\n`;
    }
    
    if (url.priority !== undefined) {
      entry += `    <priority>${url.priority.toFixed(1)}</priority>\n`;
    }

    // Add images
    if (url.images && url.images.length > 0) {
      url.images.forEach(image => {
        entry += this.formatImageEntry(image);
      });
    }

    // Add videos
    if (url.videos && url.videos.length > 0) {
      url.videos.forEach(video => {
        entry += this.formatVideoEntry(video);
      });
    }

    // Add language alternates
    if (url.alternates && url.alternates.length > 0) {
      url.alternates.forEach(alternate => {
        entry += `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${this.escapeXML(alternate.url)}" />\n`;
      });
    }

    entry += '  </url>';
    return entry;
  }

  // Format image entry
  private formatImageEntry(image: SitemapImage): string {
    let entry = '    <image:image>\n';
    entry += `      <image:loc>${this.escapeXML(image.loc)}</image:loc>\n`;
    
    if (image.title) {
      entry += `      <image:title>${this.escapeXML(image.title)}</image:title>\n`;
    }
    
    if (image.caption) {
      entry += `      <image:caption>${this.escapeXML(image.caption)}</image:caption>\n`;
    }
    
    if (image.geo_location) {
      entry += `      <image:geo_location>${this.escapeXML(image.geo_location)}</image:geo_location>\n`;
    }
    
    if (image.license) {
      entry += `      <image:license>${this.escapeXML(image.license)}</image:license>\n`;
    }
    
    entry += '    </image:image>\n';
    return entry;
  }

  // Format video entry
  private formatVideoEntry(video: SitemapVideo): string {
    let entry = '    <video:video>\n';
    entry += `      <video:title>${this.escapeXML(video.title)}</video:title>\n`;
    entry += `      <video:description>${this.escapeXML(video.description)}</video:description>\n`;
    entry += `      <video:thumbnail_loc>${this.escapeXML(video.thumbnail_loc)}</video:thumbnail_loc>\n`;
    
    if (video.content_loc) {
      entry += `      <video:content_loc>${this.escapeXML(video.content_loc)}</video:content_loc>\n`;
    }
    
    if (video.duration) {
      entry += `      <video:duration>${video.duration}</video:duration>\n`;
    }
    
    if (video.publication_date) {
      entry += `      <video:publication_date>${video.publication_date}</video:publication_date>\n`;
    }
    
    entry += '    </video:video>\n';
    return entry;
  }

  // Escape XML special characters
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Save sitemap to file
  saveSitemap(filename: string = 'sitemap.xml'): void {
    const sitemap = this.generateSitemap();
    const filePath = join(this.config.outputDir, filename);
    writeFileSync(filePath, sitemap, 'utf8');
    console.log(`Enhanced sitemap saved to: ${filePath}`);
  }

  // Clear all URLs
  clear(): void {
    this.urls = [];
  }

  // Get URL count
  getURLCount(): number {
    return this.urls.length;
  }
}

// Generate QuantForge AI enhanced sitemap
export const generateQuantForgeEnhancedSitemap = (): EnhancedSitemapGenerator => {
  const generator = new EnhancedSitemapGenerator();

  // Main pages with enhanced SEO
  generator.addURLs([
    {
      url: '/',
      changefreq: 'daily',
      priority: 1.0,
      images: [
        {
          loc: '/og-image.png',
          title: 'QuantForge AI - MQL5 Trading Robot Generator',
          caption: 'Generate professional MQL5 trading robots with AI'
        },
        {
          loc: '/logo.png',
          title: 'QuantForge AI Logo',
          caption: 'QuantForge AI - Advanced Trading Robot Generator'
        }
      ]
    },
    {
      url: '/generator',
      changefreq: 'daily',
      priority: 0.9,
      images: [
        {
          loc: '/generator-preview.png',
          title: 'Trading Robot Generator Interface',
          caption: 'Create MQL5 trading robots with AI-powered code generation'
        }
      ]
    },
    {
      url: '/wiki',
      changefreq: 'monthly',
      priority: 0.8,
      images: [
        {
          loc: '/wiki-preview.png',
          title: 'Documentation and Wiki',
          caption: 'Comprehensive guides for MQL5 trading robot development'
        }
      ]
    },
    {
      url: '/faq',
      changefreq: 'weekly',
      priority: 0.8
    },
    {
      url: '/features',
      changefreq: 'weekly',
      priority: 0.9
    },
    {
      url: '/about',
      changefreq: 'monthly',
      priority: 0.7
    },
    {
      url: '/blog',
      changefreq: 'daily',
      priority: 0.6
    }
  ]);

  // Enhanced blog content
  const blogPosts = [
    {
      url: '/blog/future-ai-trading',
      changefreq: 'monthly' as const,
      priority: 0.8,
      images: [
        {
          loc: '/blog/ai-trading-future.jpg',
          title: 'The Future of AI-Powered Trading',
          caption: 'How Machine Learning is Revolutionizing Forex Markets'
        }
      ]
    },
    {
      url: '/blog/top-mql5-strategies',
      changefreq: 'monthly' as const,
      priority: 0.8,
      images: [
        {
          loc: '/blog/mql5-strategies.jpg',
          title: 'Top 10 MQL5 Trading Strategies for 2025',
          caption: 'Most effective MQL5 trading strategies for consistent results'
        }
      ]
    },
    {
      url: '/blog/risk-management-essentials',
      changefreq: 'monthly' as const,
      priority: 0.8,
      images: [
        {
          loc: '/blog/risk-management.jpg',
          title: 'Risk Management Essentials',
          caption: 'Proper risk management for automated trading systems'
        }
      ]
    }
  ];

  generator.addURLs(blogPosts);

  // Tools and calculators
  const toolsPages = [
    { url: '/tools/backtesting', changefreq: 'weekly' as const, priority: 0.9 },
    { url: '/tools/monte-carlo', changefreq: 'weekly' as const, priority: 0.9 },
    { url: '/tools/performance-analytics', changefreq: 'weekly' as const, priority: 0.9 },
    { url: '/tools/risk-calculator', changefreq: 'weekly' as const, priority: 0.8 },
    { url: '/tools/position-size', changefreq: 'weekly' as const, priority: 0.8 }
  ];

  generator.addURLs(toolsPages);

  // Strategy categories
  const strategyPages = [
    { url: '/strategies/scalping', changefreq: 'weekly' as const, priority: 0.8 },
    { url: '/strategies/trend-following', changefreq: 'weekly' as const, priority: 0.8 },
    { url: '/strategies/breakout', changefreq: 'weekly' as const, priority: 0.8 },
    { url: '/strategies/mean-reversion', changefreq: 'weekly' as const, priority: 0.8 },
    { url: '/strategies/ai-powered', changefreq: 'weekly' as const, priority: 0.9 }
  ];

  generator.addURLs(strategyPages);

  // Educational content
  const educationalPages = [
    { url: '/academy', changefreq: 'weekly' as const, priority: 0.9 },
    { url: '/tutorials/mql5-basics', changefreq: 'monthly' as const, priority: 0.8 },
    { url: '/tutorials/trading-strategies', changefreq: 'monthly' as const, priority: 0.8 },
    { url: '/tutorials/risk-management', changefreq: 'monthly' as const, priority: 0.8 }
  ];

  generator.addURLs(educationalPages);

  // Video content with enhanced metadata
  generator.addURL({
    url: '/videos/mql5-tutorial',
    changefreq: 'monthly',
    priority: 0.8,
    videos: [
      {
        title: 'Complete MQL5 Programming Tutorial',
        description: 'Learn MQL5 programming from scratch with this comprehensive tutorial',
        thumbnail_loc: '/videos/mql5-tutorial-thumb.jpg',
        content_loc: '/videos/mql5-tutorial.mp4',
        duration: 1800,
        publication_date: '2025-12-03T00:00:00+00:00'
      }
    ]
  });

  return generator;
};

export default EnhancedSitemapGenerator;