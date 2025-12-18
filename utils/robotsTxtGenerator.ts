interface RobotsTxtOptions {
  baseUrl: string;
  sitemaps?: string[];
  allowPaths?: string[];
  disallowPaths?: string[];
  crawlDelay?: number;
  userAgentRules?: Array<{
    userAgent: string;
    allow?: string[];
    disallow?: string[];
    crawlDelay?: number;
  }>;
}

class EnhancedRobotsTxtGenerator {
  private options: Required<RobotsTxtOptions>;
  private defaultUserAgentRules = [
    {
      userAgent: '*',
      allow: ['/'],
      disallow: [
        '/api/',
        '/admin/',
        '/*.json$',
        '/_next/',
        '/src/',
        '/private/',
        '/internal/',
        '/*.env$',
        '/*.env.local$',
        '/*.env.production$',
        '/config/',
        '/api-keys/',
        '/admin-panel/',
        '/debug/',
        '/test/',
        '/node_modules/'
      ],
      crawlDelay: 1
    },
    {
      userAgent: 'Googlebot',
      allow: ['/generator', '/wiki', '/faq', '/features', '/blog', '/about'],
      disallow: ['/api/', '/admin/', '/private/'],
      crawlDelay: 1
    },
    {
      userAgent: 'Bingbot',
      allow: ['/generator', '/wiki', '/faq', '/features', '/blog', '/about'],
      disallow: ['/api/', '/admin/', '/private/'],
      crawlDelay: 1
    },
    {
      userAgent: 'Slurp',
      allow: ['/'],
      crawlDelay: 1
    },
    {
      userAgent: 'DuckDuckBot',
      allow: ['/'],
      crawlDelay: 1
    },
    {
      userAgent: 'Baiduspider',
      allow: ['/'],
      crawlDelay: 2
    },
    {
      userAgent: 'YandexBot',
      allow: ['/'],
      crawlDelay: 2
    },
    {
      userAgent: 'Yeti',
      allow: ['/'],
      crawlDelay: 2
    },
    {
      userAgent: 'SeznamBot',
      allow: ['/'],
      crawlDelay: 2
    },
    {
      userAgent: 'Googlebot-Image',
      allow: ['/images/'],
      crawlDelay: 1
    },
    {
      userAgent: 'YandexImages',
      allow: ['/images/'],
      crawlDelay: 2
    }
  ];

  private blockedBots = [
    'AhrefsBot',
    'MJ12bot',
    'SemrushBot',
    'BLEXBot',
    'BacklinkCrawler',
    'DotBot',
    'CCBot',
    'ChatGPT-User',
    'GPTBot',
    'Google-Extended',
    'anthropic-ai',
    'Claude-Web'
  ];

  constructor(options: RobotsTxtOptions) {
    this.options = {
      baseUrl: options.baseUrl.replace(/\/$/, ''),
      sitemaps: options.sitemaps || [`${options.baseUrl.replace(/\/$/, '')}/sitemap.xml`],
      allowPaths: options.allowPaths || ['/generator', '/wiki', '/faq', '/features', '/blog', '/about'],
      disallowPaths: options.disallowPaths || [
        '/api/',
        '/admin/',
        '/*.json$',
        '/_next/',
        '/src/',
        '/private/',
        '/internal/'
      ],
      crawlDelay: options.crawlDelay || 1,
      userAgentRules: options.userAgentRules || this.defaultUserAgentRules
    };
  }

  // Generate robots.txt content
  generate(): string {
    let content = '';

    // Add header comment
    content += '# Robots.txt for QuantForge AI\n';
    content += '# Generated automatically - Last updated: ' + new Date().toISOString() + '\n\n';

    // Add sitemaps
    if (this.options.sitemaps.length > 0) {
      content += '# Sitemaps\n';
      this.options.sitemaps.forEach(sitemap => {
        content += `Sitemap: ${sitemap}\n`;
      });
      content += '\n';
    }

    // Add blocked bots first
    content += '# Block aggressive crawlers\n';
    this.blockedBots.forEach(bot => {
      content += `User-agent: ${bot}\n`;
      content += 'Disallow: /\n\n';
    });

    // Add user agent specific rules
    content += '# User agent specific rules\n';
    this.options.userAgentRules.forEach(rule => {
      content += `User-agent: ${rule.userAgent}\n`;
      
      if (rule.allow && rule.allow.length > 0) {
        rule.allow.forEach(path => {
          content += `Allow: ${path}\n`;
        });
      }
      
      if (rule.disallow && rule.disallow.length > 0) {
        rule.disallow.forEach(path => {
          content += `Disallow: ${path}\n`;
        });
      }
      
      if (rule.crawlDelay) {
        content += `Crawl-delay: ${rule.crawlDelay}\n`;
      }
      
      content += '\n';
    });

    // Add global rules
    content += '# Global rules\n';
    content += 'User-agent: *\n';
    
    if (this.options.allowPaths.length > 0) {
      this.options.allowPaths.forEach(path => {
        content += `Allow: ${path}\n`;
      });
    }
    
    if (this.options.disallowPaths.length > 0) {
      this.options.disallowPaths.forEach(path => {
        content += `Disallow: ${path}\n`;
      });
    }
    
    if (this.options.crawlDelay) {
      content += `Crawl-delay: ${this.options.crawlDelay}\n`;
    }

    // Add enhanced directives
    content += '\n# Enhanced directives\n';
    content += `Host: ${this.options.baseUrl}\n`;
    content += '# Allow important static resources\n';
    content += 'Allow: /css/\n';
    content += 'Allow: /js/\n';
    content += 'Allow: /images/\n';
    content += 'Allow: /assets/\n';
    content += 'Allow: /fonts/\n';
    content += 'Allow: /favicon.ico\n';
    content += 'Allow: /manifest.json\n';
    content += 'Allow: /robots.txt\n';
    content += 'Allow: /sitemap.xml\n';

    // Add additional SEO-friendly directives
    content += '\n# SEO-friendly directives\n';
    content += '# Request rate for respectful crawling\n';
    content += 'User-agent: Googlebot\n';
    content += 'Request-rate: 1/1s\n\n';
    
    content += 'User-agent: Bingbot\n';
    content += 'Request-rate: 1/1s\n';

    return content;
  }

  // Save robots.txt to file
  saveToFile(outputPath: string = './public/robots.txt'): void {
    const content = this.generate();
    
    try {
      require('fs').writeFileSync(outputPath, content, 'utf8');
      console.log(`✅ Robots.txt generated successfully: ${outputPath}`);
    } catch (error) {
      console.error('❌ Error saving robots.txt:', error);
      throw error;
    }
  }

  // Add custom user agent rule
  addUserAgentRule(rule: {
    userAgent: string;
    allow?: string[];
    disallow?: string[];
    crawlDelay?: number;
  }): void {
    this.options.userAgentRules.push(rule);
  }

  // Add blocked bot
  addBlockedBot(userAgent: string): void {
    if (!this.blockedBots.includes(userAgent)) {
      this.blockedBots.push(userAgent);
    }
  }

  // Add sitemap
  addSitemap(sitemapUrl: string): void {
    if (!this.options.sitemaps.includes(sitemapUrl)) {
      this.options.sitemaps.push(sitemapUrl);
    }
  }

  // Add allow path
  addAllowPath(path: string): void {
    if (!this.options.allowPaths.includes(path)) {
      this.options.allowPaths.push(path);
    }
  }

  // Add disallow path
  addDisallowPath(path: string): void {
    if (!this.options.disallowPaths.includes(path)) {
      this.options.disallowPaths.push(path);
    }
  }

  // Validate robots.txt rules
  validate(): Array<{ type: 'error' | 'warning'; message: string }> {
    const issues: Array<{ type: 'error' | 'warning'; message: string }> = [];

    // Check for conflicting rules
    this.options.userAgentRules.forEach(rule => {
      if (rule.allow && rule.disallow) {
        const conflicts = rule.allow.filter(path => 
          rule.disallow!.some(disallow => 
            path === disallow || path.startsWith(disallow.replace('*', ''))
          )
        );
        
        if (conflicts.length > 0) {
          issues.push({
            type: 'warning',
            message: `Conflicting allow/disallow rules for ${rule.userAgent}: ${conflicts.join(', ')}`
          });
        }
      }
    });

    // Check crawl delay values
    this.options.userAgentRules.forEach(rule => {
      if (rule.crawlDelay && (rule.crawlDelay < 0 || rule.crawlDelay > 100)) {
        issues.push({
          type: 'error',
          message: `Invalid crawl delay for ${rule.userAgent}: ${rule.crawlDelay} (should be 0-100)`
        });
      }
    });

    // Check sitemap URLs
    this.options.sitemaps.forEach(sitemap => {
      if (!sitemap.startsWith('http')) {
        issues.push({
          type: 'error',
          message: `Invalid sitemap URL: ${sitemap} (must be absolute)`
        });
      }
    });

    return issues;
  }

  // Get current configuration
  getConfig(): Required<RobotsTxtOptions> {
    return { ...this.options };
  }

  // Reset to default configuration
  reset(): void {
    this.options.userAgentRules = [...this.defaultUserAgentRules];
    this.options.sitemaps = [`${this.options.baseUrl}/sitemap.xml`];
  }
}

// Convenience function for quick robots.txt generation
export function generateRobotsTxt(baseUrl: string, options: Partial<RobotsTxtOptions> = {}): EnhancedRobotsTxtGenerator {
  return new EnhancedRobotsTxtGenerator({ baseUrl, ...options });
}

export default EnhancedRobotsTxtGenerator;