import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  images?: Array<{
    url: string;
    title?: string;
    caption?: string;
  }>;
  videos?: Array<{
    title: string;
    description: string;
    thumbnail_loc: string;
    content_loc?: string;
    duration?: number;
    publication_date?: string;
  }>;
  alternates?: Array<{
    hreflang: string;
    href: string;
  }>;
}

interface SitemapConfig {
  baseUrl: string;
  outputDir: string;
  defaultChangefreq: SitemapEntry['changefreq'];
  defaultPriority: number;
  includeImages: boolean;
  includeVideos: boolean;
  includeAlternates: boolean;
}

class SitemapGenerator {
  private config: SitemapConfig;
  private entries: SitemapEntry[] = [];

  constructor(config: Partial<SitemapConfig> = {}) {
    this.config = {
      baseUrl: 'https://quanforge.ai',
      outputDir: './public',
      defaultChangefreq: 'weekly',
      defaultPriority: 0.8,
      includeImages: true,
      includeVideos: true,
      includeAlternates: true,
      ...config
    };
  }

  // Add a single URL to the sitemap
  addUrl(entry: SitemapEntry): void {
    this.entries.push({
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: this.config.defaultChangefreq,
      priority: this.config.defaultPriority,
      ...entry
    });
  }

  // Add multiple URLs
  addUrls(entries: SitemapEntry[]): void {
    entries.forEach(entry => this.addUrl(entry));
  }

  // Generate static pages for the site
  generateStaticPages(): void {
    const staticPages: SitemapEntry[] = [
      {
        url: '/',
        changefreq: 'daily',
        priority: 1.0,
        images: [
          {
            url: '/og-image.png',
            title: 'QuantForge AI - MQL5 Trading Robot Generator',
            caption: 'Generate professional MQL5 trading robots with AI'
          },
          {
            url: '/logo.png',
            title: 'QuantForge AI Logo',
            caption: 'Advanced Trading Robot Generator'
          }
        ],
        alternates: [
          { hreflang: 'en', href: 'https://quanforge.ai/' },
          { hreflang: 'x-default', href: 'https://quanforge.ai/' },
          { hreflang: 'id', href: 'https://quanforge.ai/?lang=id' }
        ]
      },
      {
        url: '/generator',
        changefreq: 'daily',
        priority: 0.9,
        images: [
          {
            url: '/generator-preview.png',
            title: 'Trading Robot Generator Interface',
            caption: 'Create MQL5 trading robots with AI-powered code generation'
          }
        ],
        alternates: [
          { hreflang: 'en', href: 'https://quanforge.ai/generator' },
          { hreflang: 'x-default', href: 'https://quanforge.ai/generator' },
          { hreflang: 'id', href: 'https://quanforge.ai/generator?lang=id' }
        ]
      },
      {
        url: '/wiki',
        changefreq: 'monthly',
        priority: 0.7,
        images: [
          {
            url: '/wiki-preview.png',
            title: 'Documentation and Wiki',
            caption: 'Comprehensive guides for MQL5 trading robot development'
          }
        ]
      },
      {
        url: '/login',
        changefreq: 'yearly',
        priority: 0.3
      },
      {
        url: '/faq',
        changefreq: 'weekly',
        priority: 0.8,
        alternates: [
          { hreflang: 'en', href: 'https://quanforge.ai/faq' },
          { hreflang: 'x-default', href: 'https://quanforge.ai/faq' },
          { hreflang: 'id', href: 'https://quanforge.ai/faq?lang=id' }
        ]
      },
      {
        url: '/features',
        changefreq: 'weekly',
        priority: 0.9,
        alternates: [
          { hreflang: 'en', href: 'https://quanforge.ai/features' },
          { hreflang: 'x-default', href: 'https://quanforge.ai/features' },
          { hreflang: 'id', href: 'https://quanforge.ai/features?lang=id' }
        ]
      },
      {
        url: '/pricing',
        changefreq: 'monthly',
        priority: 0.7
      },
      {
        url: '/about',
        changefreq: 'monthly',
        priority: 0.7,
        alternates: [
          { hreflang: 'en', href: 'https://quanforge.ai/about' },
          { hreflang: 'x-default', href: 'https://quanforge.ai/about' },
          { hreflang: 'id', href: 'https://quanforge.ai/about?lang=id' }
        ]
      },
      {
        url: '/contact',
        changefreq: 'yearly',
        priority: 0.4
      },
      {
        url: '/privacy',
        changefreq: 'yearly',
        priority: 0.3
      },
      {
        url: '/terms',
        changefreq: 'yearly',
        priority: 0.3
      }
    ];

    this.addUrls(staticPages);
  }

  // Generate blog pages
  generateBlogPages(): void {
    const blogPosts: SitemapEntry[] = [
      {
        url: '/blog/future-ai-trading',
        changefreq: 'monthly',
        priority: 0.8,
        images: [
          {
            url: '/blog/ai-trading-future.jpg',
            title: 'The Future of AI-Powered Trading',
            caption: 'How Machine Learning is Revolutionizing Forex Markets'
          }
        ]
      },
      {
        url: '/blog/top-mql5-strategies',
        changefreq: 'monthly',
        priority: 0.8,
        images: [
          {
            url: '/blog/mql5-strategies.jpg',
            title: 'Top 10 MQL5 Trading Strategies for 2025',
            caption: 'Most effective MQL5 trading strategies for consistent results'
          }
        ]
      },
      {
        url: '/blog/risk-management-essentials',
        changefreq: 'monthly',
        priority: 0.8,
        images: [
          {
            url: '/blog/risk-management.jpg',
            title: 'Risk Management Essentials',
            caption: 'Proper risk management for automated trading systems'
          }
        ]
      },
      {
        url: '/blog/backtesting-best-practices',
        changefreq: 'monthly',
        priority: 0.8,
        images: [
          {
            url: '/blog/backtesting.jpg',
            title: 'Backtesting Best Practices',
            caption: 'How to validate your trading strategies effectively'
          }
        ]
      },
      {
        url: '/blog/monte-carlo-simulation',
        changefreq: 'monthly',
        priority: 0.8,
        images: [
          {
            url: '/blog/monte-carlo.jpg',
            title: 'Monte Carlo Simulation in Trading',
            caption: 'Understanding Monte Carlo analysis for trading systems'
          }
        ]
      },
      {
        url: '/blog/market-correlation-analysis',
        changefreq: 'monthly',
        priority: 0.8,
        images: [
          {
            url: '/blog/correlation-analysis.jpg',
            title: 'Market Correlation Analysis',
            caption: 'Advanced correlation analysis for algorithmic traders'
          }
        ]
      }
    ];

    this.addUrls(blogPosts);
  }

  // Generate tutorial pages
  generateTutorialPages(): void {
    const tutorials: SitemapEntry[] = [
      {
        url: '/tutorials/mql5-basics',
        changefreq: 'monthly',
        priority: 0.8,
        images: [
          {
            url: '/tutorials/mql5-basics-preview.png',
            title: 'MQL5 Programming Basics Tutorial',
            caption: 'Learn the fundamentals of MQL5 programming for MetaTrader 5'
          }
        ]
      },
      {
        url: '/tutorials/trading-strategies',
        changefreq: 'monthly',
        priority: 0.8,
        images: [
          {
            url: '/tutorials/trading-strategies-preview.png',
            title: 'Advanced Trading Strategies Guide',
            caption: 'Master advanced trading strategies for algorithmic trading'
          }
        ]
      },
      {
        url: '/tutorials/risk-management',
        changefreq: 'monthly',
        priority: 0.8,
        images: [
          {
            url: '/tutorials/risk-management-preview.png',
            title: 'Risk Management Best Practices',
            caption: 'Essential risk management techniques for automated trading'
          }
        ]
      }
    ];

    this.addUrls(tutorials);
  }

  // Generate tool pages
  generateToolPages(): void {
    const tools: SitemapEntry[] = [
      {
        url: '/tools/backtesting',
        changefreq: 'weekly',
        priority: 0.9,
        images: [
          {
            url: '/tools/backtesting-preview.png',
            title: 'Advanced Backtesting Tool',
            caption: 'Professional backtesting tools for trading strategy validation'
          }
        ]
      },
      {
        url: '/tools/monte-carlo',
        changefreq: 'weekly',
        priority: 0.9,
        images: [
          {
            url: '/tools/monte-carlo-preview.png',
            title: 'Monte Carlo Simulation Tool',
            caption: 'Monte Carlo simulation for robust trading strategy analysis'
          }
        ]
      },
      {
        url: '/tools/performance-analytics',
        changefreq: 'weekly',
        priority: 0.9,
        images: [
          {
            url: '/tools/performance-analytics-preview.png',
            title: 'Performance Analytics Dashboard',
            caption: 'Comprehensive performance analytics for trading strategies'
          }
        ]
      }
    ];

    this.addUrls(tools);
  }

  // Generate strategy pages
  generateStrategyPages(): void {
    const strategies: SitemapEntry[] = [
      {
        url: '/strategies/scalping',
        changefreq: 'weekly',
        priority: 0.8,
        images: [
          {
            url: '/strategies/scalping-preview.png',
            title: 'Scalping Strategies',
            caption: 'High-frequency scalping strategies for forex trading'
          }
        ]
      },
      {
        url: '/strategies/trend-following',
        changefreq: 'weekly',
        priority: 0.8,
        images: [
          {
            url: '/strategies/trend-following-preview.png',
            title: 'Trend Following Strategies',
            caption: 'Effective trend following strategies for sustained profits'
          }
        ]
      },
      {
        url: '/strategies/breakout',
        changefreq: 'weekly',
        priority: 0.8,
        images: [
          {
            url: '/strategies/breakout-preview.png',
            title: 'Breakout Trading Strategies',
            caption: 'Breakout strategies for capturing market momentum'
          }
        ]
      }
    ];

    this.addUrls(strategies);
  }

  // Generate market analysis pages
  generateMarketAnalysisPages(): void {
    const marketAnalysis: SitemapEntry[] = [
      {
        url: '/market-analysis/forex',
        changefreq: 'daily',
        priority: 0.7,
        images: [
          {
            url: '/market-analysis/forex-preview.png',
            title: 'Forex Market Analysis',
            caption: 'Real-time forex market analysis and insights'
          }
        ]
      },
      {
        url: '/market-analysis/commodities',
        changefreq: 'daily',
        priority: 0.7,
        images: [
          {
            url: '/market-analysis/commodities-preview.png',
            title: 'Commodities Market Analysis',
            caption: 'Comprehensive commodities market analysis and trends'
          }
        ]
      },
      {
        url: '/market-analysis/indices',
        changefreq: 'daily',
        priority: 0.7,
        images: [
          {
            url: '/market-analysis/indices-preview.png',
            title: 'Stock Indices Analysis',
            caption: 'Global stock indices analysis and trading opportunities'
          }
        ]
      }
    ];

    this.addUrls(marketAnalysis);
  }

  // Generate video pages
  generateVideoPages(): void {
    const videos: SitemapEntry[] = [
      {
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
            publication_date: new Date().toISOString()
          }
        ]
      },
      {
        url: '/videos/trading-robot-demo',
        changefreq: 'monthly',
        priority: 0.8,
        videos: [
          {
            title: 'Trading Robot Generation Demo',
            description: 'Watch how to create a trading robot in minutes using QuantForge AI',
            thumbnail_loc: '/videos/trading-robot-demo-thumb.jpg',
            content_loc: '/videos/trading-robot-demo.mp4',
            duration: 600,
            publication_date: new Date().toISOString()
          }
        ]
      }
    ];

    this.addUrls(videos);
  }

  // Generate the XML sitemap
  generateSitemap(): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n';
    xml += '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"\n';
    xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml"\n';
    xml += '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"\n';
    xml += '        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0">\n';

    this.entries.forEach(entry => {
      xml += '  <url>\n';
      xml += `    <loc>${this.config.baseUrl}${entry.url}</loc>\n`;
      
      if (entry.lastmod) {
        xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
      }
      
      if (entry.changefreq) {
        xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
      }
      
      if (entry.priority) {
        xml += `    <priority>${entry.priority}</priority>\n`;
      }

      // Add images
      if (this.config.includeImages && entry.images) {
        entry.images.forEach(image => {
          xml += '    <image:image>\n';
          xml += `      <image:loc>${this.config.baseUrl}${image.url}</image:loc>\n`;
          if (image.title) {
            xml += `      <image:title>${this.escapeXml(image.title)}</image:title>\n`;
          }
          if (image.caption) {
            xml += `      <image:caption>${this.escapeXml(image.caption)}</image:caption>\n`;
          }
          xml += '    </image:image>\n';
        });
      }

      // Add videos
      if (this.config.includeVideos && entry.videos) {
        entry.videos.forEach(video => {
          xml += '    <video:video>\n';
          xml += `      <video:thumbnail_loc>${this.config.baseUrl}${video.thumbnail_loc}</video:thumbnail_loc>\n`;
          xml += `      <video:title>${this.escapeXml(video.title)}</video:title>\n`;
          xml += `      <video:description>${this.escapeXml(video.description)}</video:description>\n`;
          if (video.content_loc) {
            xml += `      <video:content_loc>${this.config.baseUrl}${video.content_loc}</video:content_loc>\n`;
          }
          if (video.duration) {
            xml += `      <video:duration>${video.duration}</video:duration>\n`;
          }
          if (video.publication_date) {
            xml += `      <video:publication_date>${video.publication_date}</video:publication_date>\n`;
          }
          xml += '    </video:video>\n';
        });
      }

      // Add alternate language links
      if (this.config.includeAlternates && entry.alternates) {
        entry.alternates.forEach(alternate => {
          xml += `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}" />\n`;
        });
      }

      xml += '  </url>\n';
    });

    xml += '</urlset>';
    return xml;
  }

  // Generate sitemap index
  generateSitemapIndex(sitemaps: string[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    sitemaps.forEach(sitemap => {
      xml += '  <sitemap>\n';
      xml += `    <loc>${this.config.baseUrl}/${sitemap}</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      xml += '  </sitemap>\n';
    });

    xml += '</sitemapindex>';
    return xml;
  }

  // Escape XML special characters
  private escapeXml(text: string): string {
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
    const outputPath = join(this.config.outputDir, filename);

    // Ensure output directory exists
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }

    writeFileSync(outputPath, sitemap, 'utf8');
    console.log(`Sitemap saved to: ${outputPath}`);
  }

  // Save sitemap index
  saveSitemapIndex(sitemaps: string[], filename: string = 'sitemap-index.xml'): void {
    const sitemapIndex = this.generateSitemapIndex(sitemaps);
    const outputPath = join(this.config.outputDir, filename);

    writeFileSync(outputPath, sitemapIndex, 'utf8');
    console.log(`Sitemap index saved to: ${outputPath}`);
  }

  // Generate complete sitemap structure
  generateCompleteSitemap(): void {
    // Clear existing entries
    this.entries = [];

    // Generate all page types
    this.generateStaticPages();
    this.generateBlogPages();
    this.generateTutorialPages();
    this.generateToolPages();
    this.generateStrategyPages();
    this.generateMarketAnalysisPages();
    this.generateVideoPages();

    // Save main sitemap
    this.saveSitemap();

    // Generate and save sitemap index
    const sitemaps = ['sitemap.xml'];
    this.saveSitemapIndex(sitemaps);

    console.log(`Generated sitemap with ${this.entries.length} URLs`);
  }
}

// Export for use in build scripts
export { SitemapGenerator };
export type { SitemapEntry, SitemapConfig };

// Generate sitemap if run directly
if (require.main === module) {
  const generator = new SitemapGenerator();
  generator.generateCompleteSitemap();
}