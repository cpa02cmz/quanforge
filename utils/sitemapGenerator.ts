import { writeFileSync } from 'fs';

interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  alternates?: Array<{ hreflang: string; href: string }>;
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
}

interface SitemapOptions {
  baseUrl: string;
  outputPath?: string;
  includeImages?: boolean;
  includeVideos?: boolean;
  includeAlternates?: boolean;
  defaultChangefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  defaultPriority?: number;
}

class EnhancedSitemapGenerator {
  private baseUrl: string;
  private options: Required<SitemapOptions>;
  private entries: SitemapEntry[] = [];

  constructor(baseUrl: string, options: Partial<SitemapOptions> = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.options = {
      baseUrl: this.baseUrl,
      outputPath: options.outputPath || './public/sitemap.xml',
      includeImages: options.includeImages ?? true,
      includeVideos: options.includeVideos ?? true,
      includeAlternates: options.includeAlternates ?? true,
      defaultChangefreq: options.defaultChangefreq || 'weekly',
      defaultPriority: options.defaultPriority || 0.8
    };
  }

  // Add a single URL to sitemap
  addUrl(entry: SitemapEntry): void {
    // Ensure URL is absolute
    if (!entry.url.startsWith('http')) {
      entry.url = `${this.baseUrl}${entry.url.startsWith('/') ? '' : '/'}${entry.url}`;
    }

    // Set default values
    entry.changefreq = entry.changefreq || this.options.defaultChangefreq;
    entry.priority = entry.priority ?? this.options.defaultPriority;
    entry.lastmod = entry.lastmod || new Date().toISOString().split('T')[0];

    this.entries.push(entry);
  }

  // Add multiple URLs
  addUrls(entries: SitemapEntry[]): void {
    entries.forEach(entry => this.addUrl(entry));
  }

  // Add static pages with common SEO settings
  addStaticPages(): void {
    const staticPages: SitemapEntry[] = [
      {
        url: '/',
        changefreq: 'daily',
        priority: 1.0,
        alternates: this.generateLanguageAlternates(''),
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
        alternates: this.generateLanguageAlternates('/generator'),
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
        priority: 0.7,
        alternates: this.generateLanguageAlternates('/wiki'),
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
        priority: 0.8,
        alternates: this.generateLanguageAlternates('/faq')
      },
      {
        url: '/features',
        changefreq: 'weekly',
        priority: 0.9,
        alternates: this.generateLanguageAlternates('/features')
      },
      {
        url: '/about',
        changefreq: 'monthly',
        priority: 0.7,
        alternates: this.generateLanguageAlternates('/about')
      },
      {
        url: '/blog',
        changefreq: 'daily',
        priority: 0.6
      },
      {
        url: '/pricing',
        changefreq: 'monthly',
        priority: 0.7
      },
      {
        url: '/login',
        changefreq: 'yearly',
        priority: 0.3
      }
    ];

    this.addUrls(staticPages);
  }

  // Add blog posts with enhanced SEO
  addBlogPosts(posts: Array<{
    slug: string;
    title: string;
    publishDate: string;
    updateDate?: string;
    image?: string;
    category?: string;
    author?: string;
  }>): void {
    const blogEntries: SitemapEntry[] = posts.map(post => ({
      url: `/blog/${post.slug}`,
      lastmod: post.updateDate || post.publishDate,
      changefreq: 'monthly' as const,
      priority: 0.8,
      images: post.image ? [{
        loc: post.image,
        title: post.title,
        caption: `${post.category ? post.category + ' - ' : ''}${post.title}`
      }] : undefined
    }));

    this.addUrls(blogEntries);
  }

  // Add tutorials with structured data
  addTutorials(tutorials: Array<{
    slug: string;
    title: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    updateDate: string;
    image?: string;
  }>): void {
    const tutorialEntries: SitemapEntry[] = tutorials.map(tutorial => ({
      url: `/tutorials/${tutorial.slug}`,
      lastmod: tutorial.updateDate,
      changefreq: 'monthly' as const,
      priority: tutorial.difficulty === 'beginner' ? 0.9 : 0.8,
      images: tutorial.image ? [{
        loc: tutorial.image,
        title: tutorial.title,
        caption: `${tutorial.difficulty} tutorial: ${tutorial.title}`
      }] : undefined
    }));

    this.addUrls(tutorialEntries);
  }

  // Add tools and features
  addTools(tools: Array<{
    slug: string;
    name: string;
    description: string;
    updateDate: string;
    image?: string;
  }>): void {
    const toolEntries: SitemapEntry[] = tools.map(tool => ({
      url: `/tools/${tool.slug}`,
      lastmod: tool.updateDate,
      changefreq: 'weekly' as const,
      priority: 0.9,
      images: tool.image ? [{
        loc: tool.image,
        title: tool.name,
        caption: tool.description
      }] : undefined
    }));

    this.addUrls(toolEntries);
  }

  // Add strategies
  addStrategies(strategies: Array<{
    slug: string;
    name: string;
    description: string;
    updateDate: string;
    image?: string;
  }>): void {
    const strategyEntries: SitemapEntry[] = strategies.map(strategy => ({
      url: `/strategies/${strategy.slug}`,
      lastmod: strategy.updateDate,
      changefreq: 'weekly' as const,
      priority: 0.8,
      images: strategy.image ? [{
        loc: strategy.image,
        title: strategy.name,
        caption: strategy.description
      }] : undefined
    }));

    this.addUrls(strategyEntries);
  }

  // Generate language alternates
  private generateLanguageAlternates(path: string): Array<{ hreflang: string; href: string }> {
    const languages = [
      { code: 'en', name: 'English' },
      { code: 'en-US', name: 'English (US)' },
      { code: 'x-default', name: 'Default' },
      { code: 'id', name: 'Indonesian' },
      { code: 'zh-CN', name: 'Chinese (Simplified)' },
      { code: 'ja', name: 'Japanese' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'ko', name: 'Korean' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
      { code: 'it', name: 'Italian' },
      { code: 'nl', name: 'Dutch' },
      { code: 'tr', name: 'Turkish' }
    ];

    return languages.map(lang => ({
      hreflang: lang.code,
      href: lang.code === 'en' || lang.code === 'x-default' 
        ? `${this.baseUrl}${path}`
        : `${this.baseUrl}${path}?lang=${lang.code}`
    }));
  }

  // Generate XML sitemap
  generateSitemap(): string {
    const xmlEntries = this.entries.map(entry => this.generateUrlEntry(entry));
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" 
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" 
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0">
${xmlEntries.join('\n')}
</urlset>`;
  }

  // Generate individual URL entry
  private generateUrlEntry(entry: SitemapEntry): string {
    let xml = `  <url>
    <loc>${this.escapeXml(entry.url)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${(entry.priority || 0.8).toFixed(1)}</priority>`;

    // Add language alternates
    if (this.options.includeAlternates && entry.alternates) {
      entry.alternates.forEach(alt => {
        xml += `\n    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${this.escapeXml(alt.href)}" />`;
      });
    }

    // Add images
    if (this.options.includeImages && entry.images) {
      entry.images.forEach(image => {
        xml += `\n    <image:image>
      <image:loc>${this.escapeXml(image.loc)}</image:loc>`;
        if (image.title) {
          xml += `\n      <image:title>${this.escapeXml(image.title)}</image:title>`;
        }
        if (image.caption) {
          xml += `\n      <image:caption>${this.escapeXml(image.caption)}</image:caption>`;
        }
        xml += `\n    </image:image>`;
      });
    }

    // Add videos
    if (this.options.includeVideos && entry.videos) {
      entry.videos.forEach(video => {
        xml += `\n    <video:video>
      <video:thumbnail_loc>${this.escapeXml(video.thumbnail_loc)}</video:thumbnail_loc>
      <video:title>${this.escapeXml(video.title)}</video:title>
      <video:description>${this.escapeXml(video.description)}</video:description>`;
        if (video.content_loc) {
          xml += `\n      <video:content_loc>${this.escapeXml(video.content_loc)}</video:content_loc>`;
        }
        if (video.duration) {
          xml += `\n      <video:duration>${video.duration}</video:duration>`;
        }
        if (video.publication_date) {
          xml += `\n      <video:publication_date>${video.publication_date}</video:publication_date>`;
        }
        xml += `\n    </video:video>`;
      });
    }

    xml += '\n  </url>';
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
  saveToFile(): void {
    const sitemap = this.generateSitemap();
    
    try {
      writeFileSync(this.options.outputPath, sitemap, 'utf8');
      // Sitemap generated successfully
    } catch (error) {
      throw error;
    }
  }

  // Generate sitemap index for multiple sitemaps
  static generateSitemapIndex(sitemaps: Array<{
    url: string;
    lastmod: string;
  }>, baseUrl: string): string {
    const xmlEntries = sitemaps.map(sitemap => `  <sitemap>
    <loc>${baseUrl}/${sitemap.url}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`);

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries.join('\n')}
</sitemapindex>`;
  }

  // Get entries count
  getEntriesCount(): number {
    return this.entries.length;
  }

  // Clear all entries
  clear(): void {
    this.entries = [];
  }

  // Get all entries
  getEntries(): SitemapEntry[] {
    return [...this.entries];
  }

  // Validate entries before generation
  validateEntries(): Array<{ url: string; errors: string[] }> {
    const errors: Array<{ url: string; errors: string[] }> = [];

    this.entries.forEach(entry => {
      const entryErrors: string[] = [];

      // Check URL format
      if (!entry.url.startsWith('http')) {
        entryErrors.push('URL must be absolute');
      }

      // Check priority range
      if (entry.priority !== undefined && (entry.priority < 0 || entry.priority > 1)) {
        entryErrors.push('Priority must be between 0.0 and 1.0');
      }

      // Check date format
      if (entry.lastmod && !/^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod)) {
        entryErrors.push('Lastmod must be in YYYY-MM-DD format');
      }

      if (entryErrors.length > 0) {
        errors.push({ url: entry.url, errors: entryErrors });
      }
    });

    return errors;
  }
}

// Export convenience function for quick sitemap generation
export function generateSitemap(
  baseUrl: string, 
  options: Partial<SitemapOptions> = {}
): EnhancedSitemapGenerator {
  const generator = new EnhancedSitemapGenerator(baseUrl, options);
  
  // Add default static pages
  generator.addStaticPages();
  
  return generator;
}

export default EnhancedSitemapGenerator;