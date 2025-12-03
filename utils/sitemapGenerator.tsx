import React, { useEffect, useState } from 'react';

interface SitemapEntry {
  url: string;
  lastmod: string | undefined;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
  alternates?: Array<{ lang: string; url: string }>;
  images?: Array<{
    loc: string;
    title: string;
    caption: string;
  }>;
  news?: {
    title: string;
    publication_date: string | undefined;
    publication: {
      name: string;
      language: string;
    };
  };
}

interface DynamicSitemapProps {
  entries?: SitemapEntry[];
  baseUrl?: string;
}

export const DynamicSitemapGenerator: React.FC<DynamicSitemapProps> = ({
  entries = [],
  baseUrl = 'https://quanforge.ai'
}) => {
  const [sitemapEntries, setSitemapEntries] = useState<SitemapEntry[]>(entries);

  useEffect(() => {
    // Generate dynamic sitemap entries based on current content
    const generateDynamicEntries = (): SitemapEntry[] => {
      const currentDate = new Date().toISOString().split('T')[0];
      
      const staticEntries: SitemapEntry[] = [
        {
          url: `${baseUrl}/`,
          lastmod: currentDate,
          changefreq: 'daily',
          priority: 1.0,
          alternates: [
            { lang: 'en', url: `${baseUrl}/` },
            { lang: 'x-default', url: `${baseUrl}/` },
            { lang: 'id', url: `${baseUrl}/?lang=id` }
          ],
          images: [
            {
              loc: `${baseUrl}/og-image.png`,
              title: 'QuantForge AI - MQL5 Trading Robot Generator',
              caption: 'Generate professional MQL5 trading robots with AI'
            },
            {
              loc: `${baseUrl}/logo.png`,
              title: 'QuantForge AI Logo',
              caption: 'QuantForge AI - Advanced Trading Robot Generator'
            }
          ]
        },
        {
          url: `${baseUrl}/generator`,
          lastmod: currentDate,
          changefreq: 'daily',
          priority: 0.9,
          alternates: [
            { lang: 'en', url: `${baseUrl}/generator` },
            { lang: 'x-default', url: `${baseUrl}/generator` },
            { lang: 'id', url: `${baseUrl}/generator?lang=id` }
          ],
          images: [
            {
              loc: `${baseUrl}/generator-preview.png`,
              title: 'Trading Robot Generator Interface',
              caption: 'Create MQL5 trading robots with AI-powered code generation'
            }
          ]
        },
        {
          url: `${baseUrl}/wiki`,
          lastmod: currentDate,
          changefreq: 'weekly',
          priority: 0.7,
          images: [
            {
              loc: `${baseUrl}/wiki-preview.png`,
              title: 'Documentation and Wiki',
              caption: 'Comprehensive guides for MQL5 trading robot development'
            }
          ]
        },
        {
          url: `${baseUrl}/login`,
          lastmod: currentDate,
          changefreq: 'yearly',
          priority: 0.3
        },
        {
          url: `${baseUrl}/faq`,
          lastmod: currentDate,
          changefreq: 'weekly',
          priority: 0.8,
          alternates: [
            { lang: 'en', url: `${baseUrl}/faq` },
            { lang: 'x-default', url: `${baseUrl}/faq` },
            { lang: 'id', url: `${baseUrl}/faq?lang=id` }
          ]
        },
        {
          url: `${baseUrl}/features`,
          lastmod: currentDate,
          changefreq: 'weekly',
          priority: 0.9,
          alternates: [
            { lang: 'en', url: `${baseUrl}/features` },
            { lang: 'x-default', url: `${baseUrl}/features` },
            { lang: 'id', url: `${baseUrl}/features?lang=id` }
          ]
        },
        {
          url: `${baseUrl}/pricing`,
          lastmod: currentDate,
          changefreq: 'monthly',
          priority: 0.7
        },
        {
          url: `${baseUrl}/documentation`,
          lastmod: currentDate,
          changefreq: 'weekly',
          priority: 0.8,
          images: [
            {
              loc: `${baseUrl}/documentation-preview.png`,
              title: 'Trading Robot Documentation',
              caption: 'Comprehensive guides for MQL5 trading robot development and optimization'
            }
          ]
        },
        {
          url: `${baseUrl}/tutorials`,
          lastmod: currentDate,
          changefreq: 'weekly',
          priority: 0.8,
          images: [
            {
              loc: `${baseUrl}/tutorials-preview.png`,
              title: 'Trading Robot Tutorials',
              caption: 'Step-by-step tutorials for creating and optimizing trading robots'
            }
          ]
        },
        {
          url: `${baseUrl}/blog`,
          lastmod: currentDate,
          changefreq: 'daily',
          priority: 0.6
        },
        {
          url: `${baseUrl}/about`,
          lastmod: currentDate,
          changefreq: 'monthly',
          priority: 0.7,
          alternates: [
            { lang: 'en', url: `${baseUrl}/about` },
            { lang: 'x-default', url: `${baseUrl}/about` },
            { lang: 'id', url: `${baseUrl}/about?lang=id` }
          ]
        },
        {
          url: `${baseUrl}/contact`,
          lastmod: currentDate,
          changefreq: 'yearly',
          priority: 0.4
        },
        {
          url: `${baseUrl}/privacy`,
          lastmod: currentDate,
          changefreq: 'yearly',
          priority: 0.3
        },
        {
          url: `${baseUrl}/terms`,
          lastmod: currentDate,
          changefreq: 'yearly',
          priority: 0.3
        }
      ];

      // Blog entries with news sitemap compatibility
      const blogEntries: SitemapEntry[] = [
        {
          url: `${baseUrl}/blog/future-ai-trading`,
          lastmod: currentDate,
          changefreq: 'monthly',
          priority: 0.8,
          images: [
            {
              loc: `${baseUrl}/blog/ai-trading-future.jpg`,
              title: 'The Future of AI-Powered Trading',
              caption: 'How Machine Learning is Revolutionizing Forex Markets'
            }
          ],
          news: {
            title: 'The Future of AI-Powered Trading',
            publication_date: currentDate,
            publication: {
              name: 'QuantForge AI Blog',
              language: 'en'
            }
          }
        },
        {
          url: `${baseUrl}/blog/top-mql5-strategies`,
          lastmod: currentDate,
          changefreq: 'monthly',
          priority: 0.8,
          images: [
            {
              loc: `${baseUrl}/blog/mql5-strategies.jpg`,
              title: 'Top 10 MQL5 Trading Strategies for 2025',
              caption: 'Most effective MQL5 trading strategies for consistent results'
            }
          ],
          news: {
            title: 'Top 10 MQL5 Trading Strategies for 2025',
            publication_date: currentDate,
            publication: {
              name: 'QuantForge AI Blog',
              language: 'en'
            }
          }
        },
        {
          url: `${baseUrl}/blog/risk-management-essentials`,
          lastmod: currentDate,
          changefreq: 'monthly',
          priority: 0.8,
          images: [
            {
              loc: `${baseUrl}/blog/risk-management.jpg`,
              title: 'Risk Management Essentials',
              caption: 'Proper risk management for automated trading systems'
            }
          ],
          news: {
            title: 'Risk Management Essentials for Automated Trading',
            publication_date: currentDate,
            publication: {
              name: 'QuantForge AI Blog',
              language: 'en'
            }
          }
        },
        {
          url: `${baseUrl}/blog/backtesting-best-practices`,
          lastmod: currentDate,
          changefreq: 'monthly',
          priority: 0.8,
          images: [
            {
              loc: `${baseUrl}/blog/backtesting.jpg`,
              title: 'Backtesting Best Practices',
              caption: 'How to validate your trading strategies effectively'
            }
          ],
          news: {
            title: 'Backtesting Best Practices for Trading Strategies',
            publication_date: currentDate,
            publication: {
              name: 'QuantForge AI Blog',
              language: 'en'
            }
          }
        },
        {
          url: `${baseUrl}/blog/monte-carlo-simulation`,
          lastmod: currentDate,
          changefreq: 'monthly',
          priority: 0.8,
          images: [
            {
              loc: `${baseUrl}/blog/monte-carlo.jpg`,
              title: 'Monte Carlo Simulation in Trading',
              caption: 'Understanding Monte Carlo analysis for trading systems'
            }
          ],
          news: {
            title: 'Monte Carlo Simulation in Trading Systems',
            publication_date: currentDate,
            publication: {
              name: 'QuantForge AI Blog',
              language: 'en'
            }
          }
        },
        {
          url: `${baseUrl}/blog/market-correlation-analysis`,
          lastmod: currentDate,
          changefreq: 'monthly',
          priority: 0.8,
          images: [
            {
              loc: `${baseUrl}/blog/correlation-analysis.jpg`,
              title: 'Market Correlation Analysis',
              caption: 'Advanced correlation analysis for algorithmic traders'
            }
          ],
          news: {
            title: 'Advanced Market Correlation Analysis for Traders',
            publication_date: currentDate,
            publication: {
              name: 'QuantForge AI Blog',
              language: 'en'
            }
          }
        }
      ];

      return [...staticEntries, ...blogEntries];
    };

    setSitemapEntries(generateDynamicEntries());
  }, [baseUrl]);

  const generateSitemapXML = (): string => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" 
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" 
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`;

    sitemapEntries.forEach(entry => {
      xml += `
  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>`;

      // Add alternate language links
      if (entry.alternates && entry.alternates.length > 0) {
        entry.alternates.forEach(alt => {
          xml += `
    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${alt.url}" />`;
        });
      }

      // Add images
      if (entry.images && entry.images.length > 0) {
        entry.images.forEach(image => {
          xml += `
    <image:image>
      <image:loc>${image.loc}</image:loc>
      <image:title>${image.title}</image:title>
      <image:caption>${image.caption}</image:caption>
    </image:image>`;
        });
      }

      // Add news (only for blog entries)
      if (entry.news) {
        xml += `
    <news:news>
      <news:publication>
        <news:name>${entry.news.publication.name}</news:name>
        <news:language>${entry.news.publication.language}</news:language>
      </news:publication>
      <news:title>${entry.news.title}</news:title>
      <news:publication_date>${entry.news.publication_date}</news:publication_date>
    </news:news>`;
      }

      xml += `
  </url>`;
    });

    xml += `
</urlset>`;

    return xml;
  };

  // This component is primarily for development/testing
  // In production, you'd use this to generate the actual sitemap.xml file
  return (
    <div className="p-4 bg-dark-surface rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Sitemap Generator</h3>
      <div className="text-sm text-gray-400">
        <p>Total URLs: {sitemapEntries.length}</p>
        <p>Generated: {new Date().toLocaleString()}</p>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-brand-400 hover:text-brand-300">
          View Generated XML
        </summary>
        <pre className="mt-2 p-4 bg-dark-bg rounded text-xs text-gray-300 overflow-auto max-h-96">
          {generateSitemapXML()}
        </pre>
      </details>
    </div>
  );
};

// Utility function to generate sitemap for server-side usage
export const generateSitemapXML = (baseUrl: string = 'https://quanforge.ai'): string => {
  const currentDate = new Date().toISOString().split('T')[0];
  
  const entries: SitemapEntry[] = [
    {
      url: `${baseUrl}/`,
      lastmod: currentDate,
      changefreq: 'daily',
      priority: 1.0,
      alternates: [
        { lang: 'en', url: `${baseUrl}/` },
        { lang: 'x-default', url: `${baseUrl}/` },
        { lang: 'id', url: `${baseUrl}/?lang=id` }
      ],
      images: [
        {
          loc: `${baseUrl}/og-image.png`,
          title: 'QuantForge AI - MQL5 Trading Robot Generator',
          caption: 'Generate professional MQL5 trading robots with AI'
        }
      ]
    },
    // Add more entries as needed...
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" 
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`;

  entries.forEach(entry => {
    xml += `
  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>`;

    if (entry.alternates) {
      entry.alternates.forEach(alt => {
        xml += `
    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${alt.url}" />`;
      });
    }

    if (entry.images) {
      entry.images.forEach(image => {
        xml += `
    <image:image>
      <image:loc>${image.loc}</image:loc>
      <image:title>${image.title}</image:title>
      <image:caption>${image.caption}</image:caption>
    </image:image>`;
      });
    }

    xml += `
  </url>`;
  });

  xml += `
</urlset>`;

  return xml;
};

export default DynamicSitemapGenerator;