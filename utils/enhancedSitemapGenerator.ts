import { writeFileSync } from 'fs';
import { join } from 'path';

interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  images?: Array<{
    loc: string;
    title?: string;
    caption?: string;
  }>;
  videos?: Array<{
    thumbnail_loc: string;
    title: string;
    description: string;
    content_loc?: string;
    duration?: number;
    publication_date?: string;
  }>;
  news?: {
    title: string;
    publication: {
      name: string;
      language: string;
    };
    publication_date: string;
    keywords?: string;
  };
  alternates?: Array<{
    hreflang: string;
    href: string;
  }>;
}

interface SitemapIndexEntry {
  loc: string;
  lastmod?: string;
}

class EnhancedSitemapGenerator {
  private baseUrl: string;
  private outputPath: string;

  constructor(baseUrl: string, outputPath: string = './public') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.outputPath = outputPath;
  }

  generateMainSitemap(): void {
    const entries: SitemapEntry[] = [
      // Homepage
      {
        url: `${this.baseUrl}/`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: 1.0,
        images: [
          {
            loc: `${this.baseUrl}/og-image.png`,
            title: 'QuantForge AI - MQL5 Trading Robot Generator',
            caption: 'Generate professional MQL5 trading robots with AI'
          },
          {
            loc: `${this.baseUrl}/logo.png`,
            title: 'QuantForge AI Logo',
            caption: 'QuantForge AI - Advanced Trading Robot Generator'
          }
        ],
        alternates: [
          { hreflang: 'en', href: `${this.baseUrl}/` },
          { hreflang: 'x-default', href: `${this.baseUrl}/` },
          { hreflang: 'en-US', href: `${this.baseUrl}/` },
          { hreflang: 'id', href: `${this.baseUrl}/?lang=id` },
          { hreflang: 'zh-CN', href: `${this.baseUrl}/?lang=zh` },
          { hreflang: 'ja', href: `${this.baseUrl}/?lang=ja` },
          { hreflang: 'es', href: `${this.baseUrl}/?lang=es` },
          { hreflang: 'fr', href: `${this.baseUrl}/?lang=fr` },
          { hreflang: 'de', href: `${this.baseUrl}/?lang=de` },
          { hreflang: 'ko', href: `${this.baseUrl}/?lang=ko` },
          { hreflang: 'pt', href: `${this.baseUrl}/?lang=pt` },
          { hreflang: 'ru', href: `${this.baseUrl}/?lang=ru` },
          { hreflang: 'ar', href: `${this.baseUrl}/?lang=ar` },
          { hreflang: 'hi', href: `${this.baseUrl}/?lang=hi` },
          { hreflang: 'it', href: `${this.baseUrl}/?lang=it` },
          { hreflang: 'nl', href: `${this.baseUrl}/?lang=nl` },
          { hreflang: 'tr', href: `${this.baseUrl}/?lang=tr` }
        ]
      },
      // Generator
      {
        url: `${this.baseUrl}/generator`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: 0.9,
        images: [
          {
            loc: `${this.baseUrl}/generator-preview.png`,
            title: 'Trading Robot Generator Interface',
            caption: 'Create MQL5 trading robots with AI-powered code generation'
          }
        ],
        alternates: [
          { hreflang: 'en', href: `${this.baseUrl}/generator` },
          { hreflang: 'x-default', href: `${this.baseUrl}/generator` },
          { hreflang: 'id', href: `${this.baseUrl}/generator?lang=id` }
        ]
      },
      // Wiki
      {
        url: `${this.baseUrl}/wiki`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.8,
        images: [
          {
            loc: `${this.baseUrl}/wiki-preview.png`,
            title: 'Documentation and Wiki',
            caption: 'Comprehensive guides for MQL5 trading robot development'
          }
        ]
      },
      // FAQ
      {
        url: `${this.baseUrl}/faq`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.8,
        alternates: [
          { hreflang: 'en', href: `${this.baseUrl}/faq` },
          { hreflang: 'x-default', href: `${this.baseUrl}/faq` },
          { hreflang: 'id', href: `${this.baseUrl}/faq?lang=id` }
        ]
      },
      // Features
      {
        url: `${this.baseUrl}/features`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.9,
        alternates: [
          { hreflang: 'en', href: `${this.baseUrl}/features` },
          { hreflang: 'x-default', href: `${this.baseUrl}/features` },
          { hreflang: 'id', href: `${this.baseUrl}/features?lang=id` }
        ]
      },
      // About
      {
        url: `${this.baseUrl}/about`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: 0.7,
        alternates: [
          { hreflang: 'en', href: `${this.baseUrl}/about` },
          { hreflang: 'x-default', href: `${this.baseUrl}/about` },
          { hreflang: 'id', href: `${this.baseUrl}/about?lang=id` }
        ]
      },
      // Academy
      {
        url: `${this.baseUrl}/academy`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.9,
        images: [
          {
            loc: `${this.baseUrl}/academy-preview.png`,
            title: 'QuantForge AI Academy',
            caption: 'Learn MQL5 programming and algorithmic trading with comprehensive courses'
          }
        ],
        alternates: [
          { hreflang: 'en', href: `${this.baseUrl}/academy` },
          { hreflang: 'x-default', href: `${this.baseUrl}/academy` },
          { hreflang: 'id', href: `${this.baseUrl}/academy?lang=id` }
        ]
      },
      // Blog
      {
        url: `${this.baseUrl}/blog`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: 0.6
      },
      // Pricing
      {
        url: `${this.baseUrl}/pricing`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: 0.7
      },
      // Documentation
      {
        url: `${this.baseUrl}/documentation`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.8,
        images: [
          {
            loc: `${this.baseUrl}/documentation-preview.png`,
            title: 'Trading Robot Documentation',
            caption: 'Comprehensive guides for MQL5 trading robot development and optimization'
          }
        ]
      },
      // Tutorials
      {
        url: `${this.baseUrl}/tutorials`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.8,
        images: [
          {
            loc: `${this.baseUrl}/tutorials-preview.png`,
            title: 'Trading Robot Tutorials',
            caption: 'Step-by-step tutorials for creating and optimizing trading robots'
          }
        ]
      },
      // Tools
      {
        url: `${this.baseUrl}/tools/backtesting`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.9,
        images: [
          {
            loc: `${this.baseUrl}/tools/backtesting-preview.png`,
            title: 'Advanced Backtesting Tool',
            caption: 'Professional backtesting tools for trading strategy validation'
          }
        ]
      },
      {
        url: `${this.baseUrl}/tools/monte-carlo`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.9,
        images: [
          {
            loc: `${this.baseUrl}/tools/monte-carlo-preview.png`,
            title: 'Monte Carlo Simulation Tool',
            caption: 'Monte Carlo simulation for robust trading strategy analysis'
          }
        ]
      },
      {
        url: `${this.baseUrl}/tools/performance-analytics`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.9,
        images: [
          {
            loc: `${this.baseUrl}/tools/performance-analytics-preview.png`,
            title: 'Performance Analytics Dashboard',
            caption: 'Comprehensive performance analytics for trading strategies'
          }
        ]
      },
      // Strategies
      {
        url: `${this.baseUrl}/strategies/scalping`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.8,
        images: [
          {
            loc: `${this.baseUrl}/strategies/scalping-preview.png`,
            title: 'Scalping Strategies',
            caption: 'High-frequency scalping strategies for forex trading'
          }
        ]
      },
      {
        url: `${this.baseUrl}/strategies/trend-following`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.8,
        images: [
          {
            loc: `${this.baseUrl}/strategies/trend-following-preview.png`,
            title: 'Trend Following Strategies',
            caption: 'Effective trend following strategies for sustained profits'
          }
        ]
      },
      {
        url: `${this.baseUrl}/strategies/breakout`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.8,
        images: [
          {
            loc: `${this.baseUrl}/strategies/breakout-preview.png`,
            title: 'Breakout Trading Strategies',
            caption: 'Breakout strategies for capturing market momentum'
          }
        ]
      },
      // Market Analysis
      {
        url: `${this.baseUrl}/market-analysis/forex`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: 0.7,
        images: [
          {
            loc: `${this.baseUrl}/market-analysis/forex-preview.png`,
            title: 'Forex Market Analysis',
            caption: 'Real-time forex market analysis and insights'
          }
        ]
      },
      {
        url: `${this.baseUrl}/market-analysis/commodities`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: 0.7,
        images: [
          {
            loc: `${this.baseUrl}/market-analysis/commodities-preview.png`,
            title: 'Commodities Market Analysis',
            caption: 'Comprehensive commodities market analysis and trends'
          }
        ]
      },
      {
        url: `${this.baseUrl}/market-analysis/indices`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'daily',
        priority: 0.7,
        images: [
          {
            loc: `${this.baseUrl}/market-analysis/indices-preview.png`,
            title: 'Stock Indices Analysis',
            caption: 'Global stock indices analysis and trading opportunities'
          }
        ]
      },
      // Videos
      {
        url: `${this.baseUrl}/videos/mql5-tutorial`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: 0.8,
        videos: [
          {
            thumbnail_loc: `${this.baseUrl}/videos/mql5-tutorial-thumb.jpg`,
            title: 'Complete MQL5 Programming Tutorial',
            description: 'Learn MQL5 programming from scratch with this comprehensive tutorial',
            content_loc: `${this.baseUrl}/videos/mql5-tutorial.mp4`,
            duration: 1800,
            publication_date: new Date().toISOString()
          }
        ]
      },
      {
        url: `${this.baseUrl}/videos/trading-robot-demo`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: 0.8,
        videos: [
          {
            thumbnail_loc: `${this.baseUrl}/videos/trading-robot-demo-thumb.jpg`,
            title: 'Trading Robot Generation Demo',
            description: 'Watch how to create a trading robot in minutes using QuantForge AI',
            content_loc: `${this.baseUrl}/videos/trading-robot-demo.mp4`,
            duration: 600,
            publication_date: new Date().toISOString()
          }
        ]
      },
      // Additional pages
      {
        url: `${this.baseUrl}/contact`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'yearly',
        priority: 0.4
      },
      {
        url: `${this.baseUrl}/privacy`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'yearly',
        priority: 0.3
      },
      {
        url: `${this.baseUrl}/terms`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'yearly',
        priority: 0.3
      },
      {
        url: `${this.baseUrl}/login`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'yearly',
        priority: 0.3
      }
    ];

    // Blog posts
    const blogPosts = [
      {
        slug: 'future-ai-trading',
        title: 'The Future of AI-Powered Trading',
        description: 'How Machine Learning is Revolutionizing Forex Markets',
        image: 'blog/ai-trading-future.jpg'
      },
      {
        slug: 'top-mql5-strategies',
        title: 'Top 10 MQL5 Trading Strategies for 2025',
        description: 'Most effective MQL5 trading strategies for consistent results',
        image: 'blog/mql5-strategies.jpg'
      },
      {
        slug: 'risk-management-essentials',
        title: 'Risk Management Essentials',
        description: 'Proper risk management for automated trading systems',
        image: 'blog/risk-management.jpg'
      },
      {
        slug: 'backtesting-best-practices',
        title: 'Backtesting Best Practices',
        description: 'How to validate your trading strategies effectively',
        image: 'blog/backtesting.jpg'
      },
      {
        slug: 'monte-carlo-simulation',
        title: 'Monte Carlo Simulation in Trading',
        description: 'Understanding Monte Carlo analysis for trading systems',
        image: 'blog/monte-carlo.jpg'
      },
      {
        slug: 'market-correlation-analysis',
        title: 'Market Correlation Analysis',
        description: 'Advanced correlation analysis for algorithmic traders',
        image: 'blog/correlation-analysis.jpg'
      }
    ];

    blogPosts.forEach(post => {
      entries.push({
        url: `${this.baseUrl}/blog/${post.slug}`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: 0.8,
        images: [
          {
            loc: `${this.baseUrl}/${post.image}`,
            title: post.title,
            caption: post.description
          }
        ]
      });
    });

    // Tutorials
    const tutorials = [
      {
        slug: 'mql5-basics',
        title: 'MQL5 Programming Basics Tutorial',
        description: 'Learn the fundamentals of MQL5 programming for MetaTrader 5',
        image: 'tutorials/mql5-basics-preview.png'
      },
      {
        slug: 'trading-strategies',
        title: 'Advanced Trading Strategies Guide',
        description: 'Master advanced trading strategies for algorithmic trading',
        image: 'tutorials/trading-strategies-preview.png'
      },
      {
        slug: 'risk-management',
        title: 'Risk Management Best Practices',
        description: 'Essential risk management techniques for automated trading',
        image: 'tutorials/risk-management-preview.png'
      }
    ];

    tutorials.forEach(tutorial => {
      entries.push({
        url: `${this.baseUrl}/tutorials/${tutorial.slug}`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: 0.8,
        images: [
          {
            loc: `${this.baseUrl}/${tutorial.image}`,
            title: tutorial.title,
            caption: tutorial.description
          }
        ]
      });
    });

    const sitemap = this.generateSitemapXML(entries);
    writeFileSync(join(this.outputPath, 'sitemap.xml'), sitemap);
  }

  generateSitemapIndex(): void {
    const sitemaps: SitemapIndexEntry[] = [
      {
        loc: `${this.baseUrl}/sitemap.xml`,
        lastmod: new Date().toISOString()
      },
      {
        loc: `${this.baseUrl}/sitemap-images.xml`,
        lastmod: new Date().toISOString()
      },
      {
        loc: `${this.baseUrl}/sitemap-videos.xml`,
        lastmod: new Date().toISOString()
      },
      {
        loc: `${this.baseUrl}/sitemap-news.xml`,
        lastmod: new Date().toISOString()
      }
    ];

    const sitemapIndex = this.generateSitemapIndexXML(sitemaps);
    writeFileSync(join(this.outputPath, 'sitemap-index.xml'), sitemapIndex);
  }

  generateImageSitemap(): void {
    const images = [
      {
        loc: `${this.baseUrl}/og-image.png`,
        title: 'QuantForge AI - MQL5 Trading Robot Generator',
        caption: 'Generate professional MQL5 trading robots with AI'
      },
      {
        loc: `${this.baseUrl}/logo.png`,
        title: 'QuantForge AI Logo',
        caption: 'QuantForge AI - Advanced Trading Robot Generator'
      },
      {
        loc: `${this.baseUrl}/generator-preview.png`,
        title: 'Trading Robot Generator Interface',
        caption: 'Create MQL5 trading robots with AI-powered code generation'
      },
      {
        loc: `${this.baseUrl}/wiki-preview.png`,
        title: 'Documentation and Wiki',
        caption: 'Comprehensive guides for MQL5 trading robot development'
      },
      {
        loc: `${this.baseUrl}/academy-preview.png`,
        title: 'QuantForge AI Academy',
        caption: 'Learn MQL5 programming and algorithmic trading with comprehensive courses'
      },
      {
        loc: `${this.baseUrl}/tools/backtesting-preview.png`,
        title: 'Advanced Backtesting Tool',
        caption: 'Professional backtesting tools for trading strategy validation'
      },
      {
        loc: `${this.baseUrl}/tools/monte-carlo-preview.png`,
        title: 'Monte Carlo Simulation Tool',
        caption: 'Monte Carlo simulation for robust trading strategy analysis'
      },
      {
        loc: `${this.baseUrl}/tools/performance-analytics-preview.png`,
        title: 'Performance Analytics Dashboard',
        caption: 'Comprehensive performance analytics for trading strategies'
      },
      {
        loc: `${this.baseUrl}/strategies/scalping-preview.png`,
        title: 'Scalping Strategies',
        caption: 'High-frequency scalping strategies for forex trading'
      },
      {
        loc: `${this.baseUrl}/strategies/trend-following-preview.png`,
        title: 'Trend Following Strategies',
        caption: 'Effective trend following strategies for sustained profits'
      },
      {
        loc: `${this.baseUrl}/strategies/breakout-preview.png`,
        title: 'Breakout Trading Strategies',
        caption: 'Breakout strategies for capturing market momentum'
      },
      {
        loc: `${this.baseUrl}/market-analysis/forex-preview.png`,
        title: 'Forex Market Analysis',
        caption: 'Real-time forex market analysis and insights'
      },
      {
        loc: `${this.baseUrl}/market-analysis/commodities-preview.png`,
        title: 'Commodities Market Analysis',
        caption: 'Comprehensive commodities market analysis and trends'
      },
      {
        loc: `${this.baseUrl}/market-analysis/indices-preview.png`,
        title: 'Stock Indices Analysis',
        caption: 'Global stock indices analysis and trading opportunities'
      },
      {
        loc: `${this.baseUrl}/videos/mql5-tutorial-thumb.jpg`,
        title: 'Complete MQL5 Programming Tutorial',
        caption: 'Learn MQL5 programming from scratch with this comprehensive tutorial'
      },
      {
        loc: `${this.baseUrl}/videos/trading-robot-demo-thumb.jpg`,
        title: 'Trading Robot Generation Demo',
        caption: 'Watch how to create a trading robot in minutes using QuantForge AI'
      }
    ];

    const sitemap = this.generateImageSitemapXML(images);
    writeFileSync(join(this.outputPath, 'sitemap-images.xml'), sitemap);
  }

  generateVideoSitemap(): void {
    const videos = [
      {
        thumbnail_loc: `${this.baseUrl}/videos/mql5-tutorial-thumb.jpg`,
        title: 'Complete MQL5 Programming Tutorial',
        description: 'Learn MQL5 programming from scratch with this comprehensive tutorial',
        content_loc: `${this.baseUrl}/videos/mql5-tutorial.mp4`,
        duration: 1800,
        publication_date: new Date().toISOString()
      },
      {
        thumbnail_loc: `${this.baseUrl}/videos/trading-robot-demo-thumb.jpg`,
        title: 'Trading Robot Generation Demo',
        description: 'Watch how to create a trading robot in minutes using QuantForge AI',
        content_loc: `${this.baseUrl}/videos/trading-robot-demo.mp4`,
        duration: 600,
        publication_date: new Date().toISOString()
      }
    ];

    const sitemap = this.generateVideoSitemapXML(videos);
    writeFileSync(join(this.outputPath, 'sitemap-videos.xml'), sitemap);
  }

  generateNewsSitemap(): void {
    const news = [
      {
        title: 'QuantForge AI Launches Advanced MQL5 Trading Robot Generator',
        publication: {
          name: 'QuantForge AI News',
          language: 'en'
        },
        publication_date: new Date().toISOString(),
        keywords: 'MQL5, Trading Robots, AI, MetaTrader 5'
      },
      {
        title: 'New AI-Powered Features Revolutionize Algorithmic Trading',
        publication: {
          name: 'QuantForge AI News',
          language: 'en'
        },
        publication_date: new Date().toISOString(),
        keywords: 'AI Trading, Algorithmic Trading, Machine Learning'
      }
    ];

    const sitemap = this.generateNewsSitemapXML(news);
    writeFileSync(join(this.outputPath, 'sitemap-news.xml'), sitemap);
  }

  private generateSitemapXML(entries: SitemapEntry[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
    xml += 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" ';
    xml += 'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" ';
    xml += 'xmlns:xhtml="http://www.w3.org/1999/xhtml" ';
    xml += 'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1" ';
    xml += 'xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0">\n';

    entries.forEach(entry => {
      xml += '  <url>\n';
      xml += `    <loc>${entry.url}</loc>\n`;
      
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
      if (entry.images && entry.images.length > 0) {
        entry.images.forEach(image => {
          xml += '    <image:image>\n';
          xml += `      <image:loc>${image.loc}</image:loc>\n`;
          if (image.title) {
            xml += `      <image:title>${this.escapeXML(image.title)}</image:title>\n`;
          }
          if (image.caption) {
            xml += `      <image:caption>${this.escapeXML(image.caption)}</image:caption>\n`;
          }
          xml += '    </image:image>\n';
        });
      }

      // Add videos
      if (entry.videos && entry.videos.length > 0) {
        entry.videos.forEach(video => {
          xml += '    <video:video>\n';
          xml += `      <video:thumbnail_loc>${video.thumbnail_loc}</video:thumbnail_loc>\n`;
          xml += `      <video:title>${this.escapeXML(video.title)}</video:title>\n`;
          xml += `      <video:description>${this.escapeXML(video.description)}</video:description>\n`;
          if (video.content_loc) {
            xml += `      <video:content_loc>${video.content_loc}</video:content_loc>\n`;
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

      // Add news
      if (entry.news) {
        xml += '    <news:news>\n';
        xml += '      <news:publication>\n';
        xml += `        <news:name>${this.escapeXML(entry.news.publication.name)}</news:name>\n`;
        xml += `        <news:language>${entry.news.publication.language}</news:language>\n`;
        xml += '      </news:publication>\n';
        xml += `      <news:title>${this.escapeXML(entry.news.title)}</news:title>\n`;
        xml += `      <news:publication_date>${entry.news.publication_date}</news:publication_date>\n`;
        if (entry.news.keywords) {
          xml += `      <news:keywords>${entry.news.keywords}</news:keywords>\n`;
        }
        xml += '    </news:news>\n';
      }

      // Add alternate language links
      if (entry.alternates && entry.alternates.length > 0) {
        entry.alternates.forEach(alternate => {
          xml += `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}" />\n`;
        });
      }

      xml += '  </url>\n';
    });

    xml += '</urlset>';
    return xml;
  }

  private generateSitemapIndexXML(sitemaps: SitemapIndexEntry[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    sitemaps.forEach(sitemap => {
      xml += '  <sitemap>\n';
      xml += `    <loc>${sitemap.loc}</loc>\n`;
      if (sitemap.lastmod) {
        xml += `    <lastmod>${sitemap.lastmod}</lastmod>\n`;
      }
      xml += '  </sitemap>\n';
    });

    xml += '</sitemapindex>';
    return xml;
  }

  private generateImageSitemapXML(images: Array<{
    loc: string;
    title: string;
    caption: string;
  }>): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
    xml += 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    images.forEach(image => {
      xml += '  <url>\n';
      xml += `    <loc>${this.baseUrl}/</loc>\n`;
      xml += '    <image:image>\n';
      xml += `      <image:loc>${image.loc}</image:loc>\n`;
      xml += `      <image:title>${this.escapeXML(image.title)}</image:title>\n`;
      xml += `      <image:caption>${this.escapeXML(image.caption)}</image:caption>\n`;
      xml += '    </image:image>\n';
      xml += '  </url>\n';
    });

    xml += '</urlset>';
    return xml;
  }

  private generateVideoSitemapXML(videos: Array<{
    thumbnail_loc: string;
    title: string;
    description: string;
    content_loc?: string;
    duration?: number;
    publication_date?: string;
  }>): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
    xml += 'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n';

    videos.forEach(video => {
      xml += '  <url>\n';
      xml += `    <loc>${this.baseUrl}/videos/</loc>\n`;
      xml += '    <video:video>\n';
      xml += `      <video:thumbnail_loc>${video.thumbnail_loc}</video:thumbnail_loc>\n`;
      xml += `      <video:title>${this.escapeXML(video.title)}</video:title>\n`;
      xml += `      <video:description>${this.escapeXML(video.description)}</video:description>\n`;
      if (video.content_loc) {
        xml += `      <video:content_loc>${video.content_loc}</video:content_loc>\n`;
      }
      if (video.duration) {
        xml += `      <video:duration>${video.duration}</video:duration>\n`;
      }
      if (video.publication_date) {
        xml += `      <video:publication_date>${video.publication_date}</video:publication_date>\n`;
      }
      xml += '    </video:video>\n';
      xml += '  </url>\n';
    });

    xml += '</urlset>';
    return xml;
  }

  private generateNewsSitemapXML(news: Array<{
    title: string;
    publication: {
      name: string;
      language: string;
    };
    publication_date: string;
    keywords?: string;
  }>): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
    xml += 'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';

    news.forEach(article => {
      xml += '  <url>\n';
      xml += `    <loc>${this.baseUrl}/blog/</loc>\n`;
      xml += '    <news:news>\n';
      xml += '      <news:publication>\n';
      xml += `        <news:name>${this.escapeXML(article.publication.name)}</news:name>\n`;
      xml += `        <news:language>${article.publication.language}</news:language>\n`;
      xml += '      </news:publication>\n';
      xml += `      <news:title>${this.escapeXML(article.title)}</news:title>\n`;
      xml += `      <news:publication_date>${article.publication_date}</news:publication_date>\n`;
      if (article.keywords) {
        xml += `      <news:keywords>${article.keywords}</news:keywords>\n`;
      }
      xml += '    </news:news>\n';
      xml += '  </url>\n';
    });

    xml += '</urlset>';
    return xml;
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  generateAll(): void {
    this.generateMainSitemap();
    this.generateSitemapIndex();
    this.generateImageSitemap();
    this.generateVideoSitemap();
    this.generateNewsSitemap();
    // Enhanced sitemaps generated
  }
}

// Generate sitemaps if run directly
if (require.main === module) {
  const generator = new EnhancedSitemapGenerator('https://quanforge.ai');
  generator.generateAll();
}

export default EnhancedSitemapGenerator;