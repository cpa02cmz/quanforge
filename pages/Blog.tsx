import React, { useState, useMemo } from 'react';
import { useTranslation } from '../services/i18n';
import { PageMeta, enhancedStructuredData } from '../utils/pageMeta';

const BlogComponent: React.FC = () => {
  const { language } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const content = {
    en: {
      title: "Blog - QuantForge AI Trading Insights",
      description: "Stay updated with the latest trading strategies, AI technology insights, and market analysis from QuantForge AI experts. Discover tips for MQL5 development and automated trading success.",
      categories: {
        all: 'All Articles',
        strategy: 'Strategy Development',
        risk: 'Risk Management',
        market: 'Market Analysis',
        technical: 'Technical Tutorials'
      },
      articles: [
        {
          id: 'future-ai-trading',
          title: 'The Future of AI-Powered Trading: How Machine Learning is Revolutionizing Forex Markets',
          excerpt: 'The integration of artificial intelligence in forex trading has transformed how traders approach market analysis and strategy development. This comprehensive guide explores the latest AI technologies shaping the future of automated trading...',
          content: 'Full article content here...',
          category: 'strategy',
          author: 'Dr. Sarah Chen',
          publishDate: '2025-12-01',
          readTime: '8 min read',
          image: '/blog/ai-trading-future.jpg',
          tags: ['AI', 'Machine Learning', 'Forex', 'Trading Technology']
        },
        {
          id: 'top-mql5-strategies',
          title: 'Top 10 MQL5 Trading Strategies for 2025',
          excerpt: 'Discover the most effective MQL5 trading strategies that are delivering consistent results in today\'s dynamic markets. From trend-following systems to advanced neural network approaches...',
          content: 'Full article content here...',
          category: 'strategy',
          author: 'Michael Rodriguez',
          publishDate: '2025-11-28',
          readTime: '12 min read',
          image: '/blog/mql5-strategies.jpg',
          tags: ['MQL5', 'Trading Strategies', 'MetaTrader 5', '2025 Trends']
        },
        {
          id: 'risk-management-essentials',
          title: 'Risk Management Essentials for Automated Trading Systems',
          excerpt: 'Proper risk management is the cornerstone of successful automated trading. Learn how to implement robust risk controls in your MQL5 Expert Advisors to protect your capital...',
          content: 'Full article content here...',
          category: 'risk',
          author: 'Emily Watson',
          publishDate: '2025-11-25',
          readTime: '10 min read',
          image: '/blog/risk-management.jpg',
          tags: ['Risk Management', 'Automated Trading', 'MQL5', 'Capital Protection']
        },
        {
          id: 'backtesting-best-practices',
          title: 'Backtesting Best Practices: How to Validate Your Trading Strategies',
          excerpt: 'Effective backtesting is crucial for strategy validation. This guide covers advanced backtesting techniques, common pitfalls to avoid, and how to interpret results accurately...',
          content: 'Full article content here...',
          category: 'technical',
          author: 'Dr. Sarah Chen',
          publishDate: '2025-11-22',
          readTime: '15 min read',
          image: '/blog/backtesting.jpg',
          tags: ['Backtesting', 'Strategy Validation', 'MQL5', 'Performance Analysis']
        },
        {
          id: 'monte-carlo-simulation',
          title: 'Understanding Monte Carlo Simulation in Trading Systems',
          excerpt: 'Monte Carlo simulation provides powerful insights into strategy performance under various market conditions. Learn how to implement and interpret Monte Carlo analysis for your trading robots...',
          content: 'Full article content here...',
          category: 'technical',
          author: 'Michael Rodriguez',
          publishDate: '2025-11-20',
          readTime: '11 min read',
          image: '/blog/monte-carlo.jpg',
          tags: ['Monte Carlo', 'Simulation', 'Risk Analysis', 'Trading Systems']
        },
        {
          id: 'market-correlation-analysis',
          title: 'Advanced Market Correlation Analysis for Algorithmic Traders',
          excerpt: 'Understanding market correlations is essential for diversified trading portfolios. This article explores advanced techniques for analyzing and utilizing market correlations in your trading strategies...',
          content: 'Full article content here...',
          category: 'market',
          author: 'Emily Watson',
          publishDate: '2025-11-18',
          readTime: '9 min read',
          image: '/blog/correlation-analysis.jpg',
          tags: ['Market Analysis', 'Correlation', 'Portfolio Management', 'Diversification']
        }
      ]
    },
    id: {
      title: "Blog - Wawasan Trading QuantForge AI",
      description: "Tetap update dengan strategi trading terbaru, wawasan teknologi AI, dan analisis pasar dari para ahli QuantForge AI. Temukan tips untuk pengembangan MQL5 dan kesuksesan trading otomatis.",
      categories: {
        all: 'Semua Artikel',
        strategy: 'Pengembangan Strategi',
        risk: 'Manajemen Risiko',
        market: 'Analisis Pasar',
        technical: 'Tutorial Teknis'
      },
      articles: [
        {
          id: 'masa-depan-ai-trading',
          title: 'Masa Depan Trading Bertenaga AI: Bagaimana Machine Learning Merevolusi Pasar Forex',
          excerpt: 'Integrasi kecerdasan buatan dalam trading forex telah mengubah cara trader mendekati analisis pasar dan pengembangan strategi. Panduan komprehensif ini mengeksplorasi teknologi AI terbaru yang membentuk masa depan trading otomatis...',
          content: 'Konten artikel lengkap di sini...',
          category: 'strategy',
          author: 'Dr. Sarah Chen',
          publishDate: '2025-12-01',
          readTime: '8 menit baca',
          image: '/blog/ai-trading-future.jpg',
          tags: ['AI', 'Machine Learning', 'Forex', 'Teknologi Trading']
        }
      ]
    }
  };

  const currentContent = content[language] || content.en;

  // Filter articles based on category and search term
  const filteredArticles = useMemo(() => {
    let articles = currentContent.articles;

    // Filter by category
    if (selectedCategory !== 'all') {
      articles = articles.filter(article => article.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      articles = articles.filter(article =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return articles;
  }, [currentContent.articles, selectedCategory, searchTerm]);

  const structuredData = [
    enhancedStructuredData.webPage(
      currentContent.title,
      currentContent.description,
      'https://quanforge.ai/blog'
    ),
    ...currentContent.articles.map(article => 
      enhancedStructuredData.article(
        article.title,
        article.excerpt,
        `https://quanforge.ai/blog/${article.id}`,
        article.author,
        article.publishDate,
        article.publishDate
      )
    )
  ];

  return (
    <>
      <PageMeta
        title={currentContent.title}
        description={currentContent.description}
        keywords="QuantForge AI blog, trading insights, MQL5 tutorials, automated trading strategies, AI trading technology, forex market analysis"
        canonicalUrl="https://quanforge.ai/blog"
        structuredData={structuredData}
        type="website"
      />
      
      <div className="min-h-screen bg-dark-bg text-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              {language === 'id' ? 'Blog Trading' : 'Trading Blog'}
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              {language === 'id'
                ? 'Wawasan terbaru tentang trading AI, strategi MQL5, dan analisis pasar dari para ahli kami'
                : 'Latest insights on AI trading, MQL5 strategies, and market analysis from our experts'
              }
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative mb-8">
              <svg 
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={language === 'id' ? 'Cari artikel...' : 'Search articles...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-lg pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap justify-center gap-2">
              {Object.entries(currentContent.categories).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedCategory === key
                      ? 'bg-brand-600 text-white'
                      : 'bg-dark-surface text-gray-400 hover:text-white border border-dark-border'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Articles Grid */}
        <div className="max-w-7xl mx-auto px-4 py-12">
          {filteredArticles.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-dark-surface rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {language === 'id' ? 'Tidak ada artikel ditemukan' : 'No articles found'}
              </h3>
              <p className="text-gray-400">
                {language === 'id'
                  ? 'Coba kata kunci atau kategori pencarian yang berbeda'
                  : 'Try different search keywords or categories'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredArticles.map((article) => (
                <article 
                  key={article.id}
                  className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden hover:border-brand-500/50 transition-all duration-300 group"
                >
                  {/* Article Image */}
                  <div className="aspect-video bg-gradient-to-br from-brand-500/20 to-brand-600/20 flex items-center justify-center relative overflow-hidden">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-brand-500 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-400">
                        {language === 'id' ? 'Gambar Artikel' : 'Article Image'}
                      </p>
                    </div>
                  </div>

                  {/* Article Content */}
                  <div className="p-6">
                    {/* Category and Date */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-brand-400 bg-brand-500/10 px-2 py-1 rounded">
                        {currentContent.categories[article.category as keyof typeof currentContent.categories]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(article.publishDate).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-white mb-3 line-clamp-2 group-hover:text-brand-400 transition-colors">
                      {article.title}
                    </h3>

                    {/* Excerpt */}
                    <p className="text-gray-300 text-sm leading-relaxed mb-4 line-clamp-3">
                      {article.excerpt}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {article.tags.slice(0, 3).map((tag, index) => (
                        <span 
                          key={index}
                          className="text-xs text-gray-400 bg-dark-bg px-2 py-1 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-dark-border">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                          <span className="text-xs text-white font-bold">
                            {article.author.charAt(0)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{article.author}</span>
                      </div>
                      <span className="text-xs text-gray-500">{article.readTime}</span>
                    </div>

                    {/* Read More Button */}
                    <button className="w-full mt-4 bg-dark-bg hover:bg-dark-bg/80 text-brand-400 hover:text-brand-300 py-2 rounded-lg transition-colors text-sm font-medium">
                      {language === 'id' ? 'Baca Selengkapnya' : 'Read More'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Newsletter Section */}
        <section className="bg-dark-surface border-t border-dark-border py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              {language === 'id'
                ? 'Berlangganan Newsletter Kami'
                : 'Subscribe to Our Newsletter'
              }
            </h2>
            <p className="text-gray-300 mb-8">
              {language === 'id'
                ? 'Dapatkan artikel terbaru, wawasan pasar, dan tips trading langsung di inbox Anda setiap minggu.'
                : 'Get the latest articles, market insights, and trading tips delivered to your inbox weekly.'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder={language === 'id' ? 'Email Anda' : 'Your email'}
                className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <button className="bg-brand-600 hover:bg-brand-500 px-6 py-3 rounded-lg font-semibold transition-colors">
                {language === 'id' ? 'Berlangganan' : 'Subscribe'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export { BlogComponent as Blog };
export default BlogComponent;