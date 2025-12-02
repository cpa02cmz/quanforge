import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../services/i18n';
import { PageMeta, enhancedStructuredData } from '../utils/pageMeta';

const FeaturesComponent: React.FC = () => {
  const { language } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('core');
  
  const content = {
    en: {
      title: "Features - QuantForge AI Trading Platform",
      description: "Discover the powerful features of QuantForge AI including AI-powered code generation, visual strategy configuration, real-time simulation, and advanced analytics for MQL5 trading robots.",
      categories: {
        core: {
          title: 'Core Features',
          icon: '🚀',
          features: [
            {
              title: 'AI-Powered Code Generation',
              description: 'Advanced AI Models powered by Google Gemini 3.0/2.5 for high-reasoning code generation with natural language processing.',
              benefits: ['Professional MQL5 Output', 'Code Optimization', 'Natural Language Processing'],
              image: '/features/ai-generation.jpg'
            },
            {
              title: 'Visual Strategy Configuration',
              description: 'Intuitive interface with no coding required for basic strategy setup and real-time preview of changes.',
              benefits: ['Risk Management Tools', 'Parameter Tuning', 'Real-time Preview'],
              image: '/features/visual-config.jpg'
            },
            {
              title: 'Real-time Market Simulation',
              description: 'Live market data feeds with Monte Carlo analysis and detailed performance metrics.',
              benefits: ['Live Market Data', 'Monte Carlo Analysis', 'Interactive Charts'],
              image: '/features/market-simulation.jpg'
            },
            {
              title: 'Robust Data Management',
              description: 'Secure cloud storage with automatic local backup and version control for your strategies.',
              benefits: ['Cloud Storage', 'Local Backup', 'Version Control'],
              image: '/features/data-management.jpg'
            }
          ]
        },
        advanced: {
          title: 'Advanced Features',
          icon: '⚡',
          features: [
            {
              title: 'Strategy Analysis',
              description: 'AI-powered risk assessment with profitability estimates and market correlation analysis.',
              benefits: ['Risk Assessment', 'Profitability Estimates', 'Market Correlation'],
              image: '/features/strategy-analysis.jpg'
            },
            {
              title: 'Multi-Language Support',
              description: 'International interface with localized content and currency adaptation.',
              benefits: ['English & Indonesian', 'Localized Content', 'Currency Adaptation'],
              image: '/features/multi-language.jpg'
            },
            {
              title: 'Security & Privacy',
              description: 'End-to-end encryption with API key protection and privacy mode options.',
              benefits: ['End-to-End Encryption', 'API Key Protection', 'Privacy Mode'],
              image: '/features/security.jpg'
            },
            {
              title: 'Performance Optimization',
              description: 'Lightning fast performance with scalable architecture and real-time updates.',
              benefits: ['Lightning Fast', 'Scalable Architecture', 'Real-time Updates'],
              image: '/features/performance.jpg'
            }
          ]
        },
        trading: {
          title: 'Trading Features',
          icon: '📊',
          features: [
            {
              title: 'Multi-Asset Support',
              description: 'Trade forex pairs, commodities, indices, and cryptocurrencies through MT5.',
              benefits: ['Forex Pairs', 'Commodities', 'Indices', 'Cryptocurrencies'],
              image: '/features/multi-asset.jpg'
            },
            {
              title: 'Multi-Timeframe Analysis',
              description: 'Strategies for scalping, day trading, swing trading, and position trading.',
              benefits: ['Scalping', 'Day Trading', 'Swing Trading', 'Position Trading'],
              image: '/features/timeframe.jpg'
            },
            {
              title: 'Strategy Types',
              description: 'Trend following, mean reversion, breakout, and range trading strategies.',
              benefits: ['Trend Following', 'Mean Reversion', 'Breakout', 'Range Trading'],
              image: '/features/strategy-types.jpg'
            }
          ]
        },
        integration: {
          title: 'Integration Features',
          icon: '🔗',
          features: [
            {
              title: 'Platform Integration',
              description: 'Seamless MetaTrader 5 integration with broker compatibility.',
              benefits: ['MetaTrader 5', 'Broker Compatibility', 'API Connectivity'],
              image: '/features/platform-integration.jpg'
            },
            {
              title: 'Analytics & Reporting',
              description: 'Comprehensive performance dashboard with detailed trade history.',
              benefits: ['Performance Dashboard', 'Trade History', 'Risk Metrics'],
              image: '/features/analytics.jpg'
            },
            {
              title: 'Collaboration Tools',
              description: 'Strategy sharing and portfolio management with team analytics.',
              benefits: ['Strategy Sharing', 'Portfolio Management', 'Team Analytics'],
              image: '/features/collaboration.jpg'
            }
          ]
        }
      }
    },
    id: {
      title: "Fitur - Platform Trading QuantForge AI",
      description: "Temukan fitur-fitur canggih QuantForge AI termasuk generasi kode bertenaga AI, konfigurasi strategi visual, simulasi real-time, dan analitik lanjutan untuk robot trading MQL5.",
      categories: {
        inti: {
          title: 'Fitur Inti',
          icon: '🚀',
          features: [
            {
              title: 'Generasi Kode Bertenaga AI',
              description: 'Model AI canggih bertenaga Google Gemini 3.0/2.5 untuk generasi kode penalaran tinggi dengan pemrosesan bahasa alami.',
              benefits: ['Output MQL5 Profesional', 'Optimasi Kode', 'Pemrosesan Bahasa Alami'],
              image: '/features/ai-generation.jpg'
            },
            {
              title: 'Konfigurasi Strategi Visual',
              description: 'Antarmuka intuitif tanpa coding diperlukan untuk setup strategi dasar dan pratinjau perubahan real-time.',
              benefits: ['Tools Manajemen Risiko', 'Penalaan Parameter', 'Pratinjau Real-time'],
              image: '/features/visual-config.jpg'
            }
          ]
        }
      }
    }
  };

  const currentContent = content[language] || content.en;
  const categories = Object.entries(currentContent.categories);

  const structuredData = [
    enhancedStructuredData.softwareApplication,
    enhancedStructuredData.webPage(
      currentContent.title,
      currentContent.description,
      'https://quanforge.ai/features'
    ),
    enhancedStructuredData.article(
      'QuantForge AI Features',
      currentContent.description,
      'https://quanforge.ai/features',
      'QuantForge AI',
      '2023-01-01',
      new Date().toISOString()
    )
  ];

  return (
    <>
      <PageMeta
        title={currentContent.title}
        description={currentContent.description}
        keywords="QuantForge AI features, MQL5 generator features, AI trading platform features, automated trading tools, MetaTrader 5 features, trading robot capabilities"
        canonicalUrl="https://quanforge.ai/features"
        structuredData={structuredData}
        type="article"
      />
      
      <div className="min-h-screen bg-dark-bg text-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              {language === 'id' ? 'Fitur Platform' : 'Platform Features'}
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              {language === 'id'
                ? 'Temukan alat canggih yang mengubah ide trading menjadi strategi otomatis yang menguntungkan'
                : 'Discover powerful tools that transform trading ideas into profitable automated strategies'
              }
            </p>
            <Link 
              to="/generator"
              className="bg-brand-600 hover:bg-brand-500 px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
            >
              {language === 'id' ? 'Coba Sekarang' : 'Try Now'}
            </Link>
          </div>
        </section>

        {/* Category Navigation */}
        <section className="sticky top-20 z-10 bg-dark-surface border-b border-dark-border py-4 px-4">
          <div className="max-w-7xl mx-auto">
            <nav className="flex flex-wrap items-center justify-center space-x-2 md:space-x-6">
              {categories.map(([key, category]) => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    activeCategory === key 
                      ? 'bg-brand-500 text-white' 
                      : 'text-gray-400 hover:bg-dark-bg hover:text-white'
                  }`}
                >
                  <span>{category.icon}</span>
                  <span className="font-medium">{category.title}</span>
                </button>
              ))}
            </nav>
          </div>
        </section>

        {/* Features Content */}
        <div className="max-w-7xl mx-auto px-4 py-12">
          {categories.map(([categoryKey, category]) => (
            <section 
              key={categoryKey}
              className={`mb-16 ${activeCategory !== categoryKey ? 'hidden' : ''}`}
            >
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center space-x-3">
                  <span>{category.icon}</span>
                  <span>{category.title}</span>
                </h2>
                <p className="text-gray-300 max-w-2xl mx-auto">
                  {language === 'id'
                    ? `Fitur ${category.title.toLowerCase()} yang dirancang untuk meningkatkan pengalaman trading Anda`
                    : `${category.title} designed to enhance your trading experience`
                  }
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {category.features.map((feature, index) => (
                  <div 
                    key={index}
                    className="bg-dark-surface border border-dark-border rounded-2xl p-8 hover:border-brand-500/50 transition-all duration-300 group"
                  >
                    <div className="mb-6">
                      <div className="aspect-video bg-gradient-to-br from-brand-500/20 to-brand-600/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-brand-500 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-400">
                            {language === 'id' ? 'Fitur Gambar' : 'Feature Image'}
                          </p>
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-bold text-white mb-3 group-hover:text-brand-400 transition-colors">
                        {feature.title}
                      </h3>
                      
                      <p className="text-gray-300 leading-relaxed mb-6">
                        {feature.description}
                      </p>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-brand-400 mb-3">
                          {language === 'id' ? 'Manfaat Utama:' : 'Key Benefits:'}
                        </h4>
                        {feature.benefits.map((benefit, benefitIndex) => (
                          <div key={benefitIndex} className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-gray-300">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* CTA Section */}
        <section className="bg-dark-surface border-t border-dark-border py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              {language === 'id'
                ? 'Siap untuk Meningkatkan Trading Anda?'
                : 'Ready to Level Up Your Trading?'
              }
            </h2>
            <p className="text-gray-300 mb-8">
              {language === 'id'
                ? 'Jelajahi semua fitur canggih kami dan mulai membuat strategi trading yang menguntungkan hari ini.'
                : 'Explore all our powerful features and start creating profitable trading strategies today.'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/generator"
                className="bg-brand-600 hover:bg-brand-500 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                {language === 'id' ? 'Mulai Gratis' : 'Start Free'}
              </Link>
              <Link 
                to="/wiki"
                className="border border-brand-500 text-brand-400 hover:bg-brand-500 hover:text-white px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                {language === 'id' ? 'Pelajari Lebih Lanjut' : 'Learn More'}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export { FeaturesComponent as Features };
export default FeaturesComponent;