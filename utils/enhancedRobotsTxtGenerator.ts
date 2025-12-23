import { writeFileSync } from 'fs';

interface RobotsTxtConfig {
  baseUrl: string;
  sitemaps: string[];
  allowPaths: string[];
  disallowPaths: string[];
  crawlDelay?: number;
  userAgentRules?: Array<{
    userAgent: string;
    allow?: string[];
    disallow?: string[];
    crawlDelay?: number;
  }>;
}

class EnhancedRobotsTxtGenerator {
  private config: RobotsTxtConfig;

  constructor(config: RobotsTxtConfig) {
    this.config = config;
  }

  generate(): string {
    let robots = '';

    // Add sitemaps
    this.config.sitemaps.forEach(sitemap => {
      robots += `Sitemap: ${sitemap}\n`;
    });
    robots += '\n';

    // Global user agent rules
    robots += '# Global rules\n';
    robots += 'User-agent: *\n';
    
    this.config.allowPaths.forEach(path => {
      robots += `Allow: ${path}\n`;
    });

    this.config.disallowPaths.forEach(path => {
      robots += `Disallow: ${path}\n`;
    });

    if (this.config.crawlDelay) {
      robots += `Crawl-delay: ${this.config.crawlDelay}\n`;
    }
    robots += '\n';

    // Specific user agent rules
    if (this.config.userAgentRules) {
      this.config.userAgentRules.forEach(rule => {
        robots += `# ${rule.userAgent} specific rules\n`;
        robots += `User-agent: ${rule.userAgent}\n`;
        
        if (rule.allow) {
          rule.allow.forEach(path => {
            robots += `Allow: ${path}\n`;
          });
        }
        
        if (rule.disallow) {
          rule.disallow.forEach(path => {
            robots += `Disallow: ${path}\n`;
          });
        }
        
        if (rule.crawlDelay) {
          robots += `Crawl-delay: ${rule.crawlDelay}\n`;
        }
        robots += '\n';
      });
    }

    // Additional directives
    robots += '# Additional directives\n';
    robots += `Host: ${this.config.baseUrl}\n`;
    robots += '# Allow indexing of important content\n';
    robots += '# Block aggressive crawlers\n';

    return robots;
  }

  save(outputPath: string = './public/robots.txt'): void {
    const robotsTxt = this.generate();
    writeFileSync(outputPath, robotsTxt);
    console.log(`Enhanced robots.txt generated at ${outputPath}`);
  }
}

// Create default configuration for QuantForge AI
function createQuantForgeRobotsConfig(): RobotsTxtConfig {
  return {
    baseUrl: 'https://quanforge.ai',
    sitemaps: [
      'https://quanforge.ai/sitemap.xml',
      'https://quanforge.ai/sitemap-index.xml',
      'https://quanforge.ai/sitemap-images.xml',
      'https://quanforge.ai/sitemap-videos.xml',
      'https://quanforge.ai/sitemap-news.xml'
    ],
    allowPaths: [
      '/',
      '/generator',
      '/wiki',
      '/faq',
      '/features',
      '/pricing',
      '/blog',
      '/about',
      '/academy',
      '/documentation',
      '/tutorials',
      '/tools/',
      '/strategies/',
      '/market-analysis/',
      '/videos/',
      '/assets/',
      '/images/',
      '/css/',
      '/js/',
      '/fonts/',
      '/favicon.ico',
      '/manifest.json',
      '/robots.txt',
      '/sitemap.xml'
    ],
    disallowPaths: [
      '/api/',
      '/admin/',
      '/private/',
      '/internal/',
      '/_next/',
      '/src/',
      '/node_modules/',
      '/*.env$',
      '/*.env.local$',
      '/*.env.production$',
      '/config/',
      '/api-keys/',
      '/admin-panel/',
      '/debug/',
      '/test/',
      '/*.json$',
      '/login',
      '/dashboard',
      '/profile',
      '/settings',
      '/account',
      '/billing',
      '/invoices',
      '/subscriptions',
      '/notifications',
      '/messages',
      '/support-tickets',
      '/affiliate-dashboard',
      '/enterprise-dashboard',
      '/api-docs',
      '/admin-tools',
      '/system-status',
      '/logs',
      '/reports',
      '/analytics',
      '/metrics',
      '/health-check',
      '/maintenance',
      '/error-pages',
      '/redirects',
      '/temp/',
      '/cache/',
      '/sessions/',
      '/uploads/',
      '/backups/',
      '/exports/',
      '/imports/',
      '/webhooks/',
      '/callbacks/',
      '/oauth/',
      '/auth/',
      '/token/',
      '/refresh/',
      '/revoke/',
      '/verify/',
      '/reset/',
      '/confirm/',
      '/unsubscribe/',
      '/preferences/',
      '/notifications/',
      '/alerts/',
      '/warnings/',
      '/errors/',
      '/debug/',
      '/testing/',
      '/staging/',
      '/development/',
      '/experimental/',
      '/beta/',
      '/alpha/',
      '/preview/',
      '/demo/',
      '/sandbox/',
      '/mock/',
      '/fake/',
      '/sample/',
      '/example/',
      '/placeholder/',
      '/draft/',
      '/archived/',
      '/deleted/',
      '/removed/',
      '/hidden/',
      '/private/',
      '/confidential/',
      '/secret/',
      '/sensitive/',
      '/secure/',
      '/protected/',
      '/restricted/',
      '/internal-only/',
      '/staff-only/',
      '/admin-only/',
      '/developer-only/',
      '/test-only/',
      '/debug-only/'
    ],
    crawlDelay: 1,
    userAgentRules: [
      // Googlebot
      {
        userAgent: 'Googlebot',
        allow: ['/', '/generator', '/wiki', '/faq', '/features', '/blog', '/about'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 1
      },
      // Bingbot
      {
        userAgent: 'Bingbot',
        allow: ['/', '/generator', '/wiki', '/faq', '/features', '/blog', '/about'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 1
      },
      // Slurp (Yahoo)
      {
        userAgent: 'Slurp',
        allow: ['/'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 1
      },
      // DuckDuckBot
      {
        userAgent: 'DuckDuckBot',
        allow: ['/'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 1
      },
      // Baiduspider
      {
        userAgent: 'Baiduspider',
        allow: ['/'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 2
      },
      // YandexBot
      {
        userAgent: 'YandexBot',
        allow: ['/'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 2
      },
      // YandexImages
      {
        userAgent: 'YandexImages',
        allow: ['/images/', '/assets/images/'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 2
      },
      // Googlebot-Image
      {
        userAgent: 'Googlebot-Image',
        allow: ['/images/', '/assets/images/'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 1
      },
      // Facebook external hit
      {
        userAgent: 'facebookexternalhit',
        allow: ['/', '/generator', '/wiki', '/faq', '/features', '/blog', '/about'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 1
      },
      // Twitter bot
      {
        userAgent: 'Twitterbot',
        allow: ['/', '/generator', '/wiki', '/faq', '/features', '/blog', '/about'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 1
      },
      // LinkedIn bot
      {
        userAgent: 'LinkedInBot',
        allow: ['/', '/generator', '/wiki', '/faq', '/features', '/blog', '/about'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 1
      },
      // WhatsApp bot
      {
        userAgent: 'WhatsApp',
        allow: ['/', '/generator', '/wiki', '/faq', '/features', '/blog', '/about'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 1
      },
      // Apple bot
      {
        userAgent: 'Applebot',
        allow: ['/', '/generator', '/wiki', '/faq', '/features', '/blog', '/about'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 1
      },
      // BLEXBot (block)
      {
        userAgent: 'BLEXBot',
        disallow: ['/']
      },
      // AhrefsBot (block)
      {
        userAgent: 'AhrefsBot',
        disallow: ['/']
      },
      // MJ12bot (block)
      {
        userAgent: 'MJ12bot',
        disallow: ['/']
      },
      // SemrushBot (block)
      {
        userAgent: 'SemrushBot',
        disallow: ['/']
      },
      // BacklinkCrawler (block)
      {
        userAgent: 'BacklinkCrawler',
        disallow: ['/']
      },
      // DotBot (block)
      {
        userAgent: 'DotBot',
        disallow: ['/']
      },
      // CCBot (block)
      {
        userAgent: 'CCBot',
        disallow: ['/']
      },
      // ChatGPT bots (block)
      {
        userAgent: 'ChatGPT-User',
        disallow: ['/']
      },
      {
        userAgent: 'GPTBot',
        disallow: ['/']
      },
      {
        userAgent: 'Google-Extended',
        disallow: ['/']
      },
      {
        userAgent: 'anthropic-ai',
        disallow: ['/']
      },
      {
        userAgent: 'Claude-Web',
        disallow: ['/']
      },
      // Other aggressive crawlers (block)
      {
        userAgent: 'SemrushBot-SA',
        disallow: ['/']
      },
      {
        userAgent: 'AhrefsSiteAudit',
        disallow: ['/']
      },
      {
        userAgent: 'MJ12bot',
        disallow: ['/']
      },
      {
        userAgent: 'DotBot',
        disallow: ['/']
      },
      {
        userAgent: 'AspiegelBot',
        disallow: ['/']
      },
      {
        userAgent: 'DataForSeoBot',
        disallow: ['/']
      },
      {
        userAgent: 'DomainCrawler',
        disallow: ['/']
      },
      {
        userAgent: 'GrapeshotCrawler',
        disallow: ['/']
      },
      {
        userAgent: 'HubSpot Crawler',
        disallow: ['/']
      },
      {
        userAgent: 'Leikibot',
        disallow: ['/']
      },
      {
        userAgent: 'Magpie-Crawler',
        disallow: ['/']
      },
      {
        userAgent: 'MegaIndex.ru',
        disallow: ['/']
      },
      {
        userAgent: 'MojeekBot',
        disallow: ['/']
      },
      {
        userAgent: 'Riddler',
        disallow: ['/']
      },
      {
        userAgent: 'Scrapy',
        disallow: ['/']
      },
      {
        userAgent: 'Seekport Crawler',
        disallow: ['/']
      },
      {
        userAgent: 'SeznamBot',
        allow: ['/'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 2
      },
      {
        userAgent: 'Yeti',
        allow: ['/'],
        disallow: ['/api/', '/admin/', '/private/', '/internal/'],
        crawlDelay: 2
      }
    ]
  };
}

// Generate robots.txt if run directly
if (require.main === module) {
  const config = createQuantForgeRobotsConfig();
  const generator = new EnhancedRobotsTxtGenerator(config);
  generator.save();
}

export default EnhancedRobotsTxtGenerator;
export { createQuantForgeRobotsConfig };