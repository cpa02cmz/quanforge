import React, { useState, useMemo } from 'react';
import { useTranslation } from '../services/i18n';
import { PageMeta, enhancedStructuredData } from '../utils/pageMeta';

interface FAQQuestion {
  q: string;
  a: string;
}

interface FAQCategory {
  title: string;
  icon: string;
  questions: FAQQuestion[];
}

interface FAQContent {
  title: string;
  description: string;
  categories: Record<string, FAQCategory>;
}

const FAQComponent: React.FC = () => {
  const { language } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState('general');
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const content = {
    en: {
      title: "Frequently Asked Questions - QuantForge AI",
      description: "Find answers to common questions about QuantForge AI, MQL5 trading robot generation, automated trading, and our AI-powered platform features.",
      categories: {
        general: {
          title: 'General Questions',
          icon: '🌟',
          questions: [
            {
              q: 'What is QuantForge AI?',
              a: 'QuantForge AI is an advanced web-based platform that uses Google\'s Gemini AI models to generate, analyze, and manage trading robots (Expert Advisors) for the MetaTrader 5 (MQL5) platform.'
            },
            {
              q: 'How does QuantForge AI work?',
              a: 'Simply describe your trading strategy in natural language, and our AI will generate professional MQL5 code. You can then configure parameters, run simulations, and deploy to MetaTrader 5.'
            },
            {
              q: 'Is QuantForge AI free to use?',
              a: 'Yes, QuantForge AI offers free access to generate and manage trading robots. You only need your own API keys for the AI service.'
            },
            {
              q: 'What programming languages are supported?',
              a: 'QuantForge AI specializes in MQL5 (MetaQuotes Language 5) for MetaTrader 5 Expert Advisors and custom indicators.'
            }
          ]
        },
        technical: {
          title: 'Technical Requirements',
          icon: '⚙️',
          questions: [
            {
              q: 'What do I need to use QuantForge AI?',
              a: 'You need a modern web browser (Chrome, Firefox, Safari, Edge), MetaTrader 5 platform for deploying generated robots, and optionally a Google Gemini API key for AI generation.'
            },
            {
              q: 'Which trading platforms are supported?',
              a: 'Currently, QuantForge AI specializes in MetaTrader 5 (MT5) MQL5 Expert Advisors.'
            },
            {
              q: 'Can I use the generated robots on any broker?',
              a: 'Yes, the generated MQL5 robots work with any broker that supports MetaTrader 5.'
            },
            {
              q: 'What are the system requirements?',
              a: 'A modern browser with JavaScript enabled and internet connection. No additional software installation required.'
            }
          ]
        },
        features: {
          title: 'Features & Capabilities',
          icon: '🚀',
          questions: [
            {
              q: 'What types of trading strategies can I create?',
              a: 'You can create trend following strategies, mean reversion strategies, breakout strategies, multi-timeframe strategies, custom indicator-based strategies, and much more.'
            },
            {
              q: 'Can I modify the generated code?',
              a: 'Yes, you have full access to edit and customize the generated MQL5 code in our built-in editor.'
            },
            {
              q: 'Does QuantForge AI provide backtesting?',
              a: 'Yes, we offer Monte Carlo simulation and risk analysis to help evaluate your strategies before deployment.'
            },
            {
              q: 'Can I integrate custom indicators?',
              a: 'Yes, you can request custom indicators in your strategy description, and the AI will incorporate them into the generated code.'
            }
          ]
        },
        security: {
          title: 'Security & Privacy',
          icon: '🔒',
          questions: [
            {
              q: 'Is my trading data secure?',
              a: 'Yes, all data is encrypted and stored securely. You can also use local storage mode for complete privacy.'
            },
            {
              q: 'Do you store my API keys?',
              a: 'API keys are encrypted and stored securely in your browser. We recommend using environment variables for production use.'
            },
            {
              q: 'Is my data shared with third parties?',
              a: 'No, we do not share your personal data or trading strategies with third parties without your explicit consent.'
            },
            {
              q: 'How is data transmitted securely?',
              a: 'All data transmission uses HTTPS encryption, and sensitive data is encrypted at rest using industry-standard encryption methods.'
            }
          ]
        },
        gettingStarted: {
          title: 'Getting Started',
          icon: '🎯',
          questions: [
            {
              q: 'How do I create my first trading robot?',
              a: '1. Sign up for a free account\n2. Go to the Generator page\n3. Describe your strategy in the chat\n4. Configure parameters in Settings\n5. Test and download your MQL5 file'
            },
            {
              q: 'What if I need help?',
              a: 'Check our comprehensive Wiki documentation or contact our support team for assistance.'
            },
            {
              q: 'Are there tutorials available?',
              a: 'Yes, we provide comprehensive documentation, video tutorials, and step-by-step guides in our Wiki section.'
            },
            {
              q: 'How long does it take to generate a robot?',
              a: 'Generation typically takes 30-60 seconds depending on the complexity of your strategy and AI model response time.'
            }
          ]
        },
        advanced: {
          title: 'Advanced Features',
          icon: '💡',
          questions: [
            {
              q: 'Does it support multiple timeframes?',
              a: 'Yes, you can create strategies that analyze multiple timeframes for better trading decisions and market analysis.'
            },
            {
              q: 'Can I create portfolio strategies?',
              a: 'Yes, you can generate multiple robots and manage them as a portfolio from your dashboard with advanced analytics.'
            },
            {
              q: 'What markets are supported?',
              a: 'QuantForge AI supports forex, commodities, indices, and cryptocurrency markets through MetaTrader 5 compatible brokers.'
            },
            {
              q: 'How do I optimize my strategies?',
              a: 'Use our built-in Monte Carlo simulation, risk analysis tools, and performance metrics to optimize and validate your strategies.'
            }
          ]
        },
        business: {
          title: 'Business & Licensing',
          icon: '💼',
          questions: [
            {
              q: 'Can I use generated robots commercially?',
              a: 'Yes, you own the generated code and can use it for personal or commercial trading.'
            },
            {
              q: 'Do you offer enterprise solutions?',
              a: 'Yes, we offer custom solutions for trading firms and financial institutions. Contact us for details.'
            },
            {
              q: 'Are there any limitations on robot generation?',
              a: 'Free plan users have generous limits, while paid plans offer unlimited generation and advanced features.'
            },
            {
              q: 'How often are the AI models updated?',
              a: 'We continuously update our AI models to incorporate the latest trading strategies and market analysis techniques.'
            }
          ]
        }
      }
    },
    id: {
      title: "Pertanyaan yang Sering Diajukan - QuantForge AI",
      description: "Temukan jawaban untuk pertanyaan umum tentang QuantForge AI, generasi robot trading MQL5, trading otomatis, dan fitur platform bertenaga AI kami.",
      categories: {
        umum: {
          title: 'Pertanyaan Umum',
          icon: '🌟',
          questions: [
            {
              q: 'Apa itu QuantForge AI?',
              a: 'QuantForge AI adalah platform web canggih yang menggunakan model AI Gemini Google untuk menghasilkan, menganalisis, dan mengelola robot trading (Expert Advisor) untuk platform MetaTrader 5 (MQL5).'
            },
            {
              q: 'Bagaimana cara kerja QuantForge AI?',
              a: 'Cukup jelaskan strategi trading Anda dalam bahasa alami, dan AI kami akan menghasilkan kode MQL5 profesional. Kemudian Anda dapat mengkonfigurasi parameter, menjalankan simulasi, dan mengdeploy ke MetaTrader 5.'
            },
            {
              q: 'Apakah QuantForge AI gratis digunakan?',
              a: 'Ya, QuantForge AI menawarkan akses gratis untuk menghasilkan dan mengelola robot trading. Anda hanya perlu API key sendiri untuk layanan AI.'
            }
          ]
        }
      }
    }
  };

  const currentContent = content[language] || content.en;

  // Filter questions based on search term
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return currentContent.categories;
    
    const filtered: Record<string, FAQCategory> = {};
    Object.entries(currentContent.categories).forEach(([key, category]) => {
      const matchingQuestions = category.questions.filter(
        (q: FAQQuestion) => 
          q.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.a.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (matchingQuestions.length > 0) {
        filtered[key] = { ...category, questions: matchingQuestions };
      }
    });
    
    return filtered;
  }, [currentContent.categories, searchTerm]);

  // Generate FAQ structured data
  const allQuestions = Object.values(filteredCategories).flatMap((category: FAQCategory) =>
    category.questions.map((q: FAQQuestion) => ({
      question: q.q,
      answer: q.a
    }))
  );
  
  const structuredData = [
    enhancedStructuredData.webPage(
      currentContent.title,
      currentContent.description,
      'https://quanforge.ai/faq'
    ),
    enhancedStructuredData.faq(allQuestions),
    enhancedStructuredData.breadcrumb([
      { name: 'Home', url: 'https://quanforge.ai/' },
      { name: 'FAQ', url: 'https://quanforge.ai/faq' }
    ])
  ];

  return (
    <>
      <PageMeta
        title={currentContent.title}
        description={currentContent.description}
        keywords="QuantForge AI FAQ, MQL5 questions, trading robot help, automated trading support, MetaTrader 5 assistance, AI trading platform FAQ"
        canonicalUrl="https://quanforge.ai/faq"
        structuredData={structuredData}
        type="website"
      />
      
      <div className="min-h-screen bg-dark-bg text-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              {language === 'id' ? 'Pertanyaan Umum' : 'Frequently Asked Questions'}
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              {language === 'id'
                ? 'Temukan jawaban untuk pertanyaan umum tentang platform trading AI kami'
                : 'Find answers to common questions about our AI trading platform'
              }
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative">
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
                placeholder={language === 'id' ? 'Cari pertanyaan...' : 'Search questions...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-lg pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>
        </section>

        {/* FAQ Content */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          {Object.entries(filteredCategories).length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-dark-surface rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {language === 'id' ? 'Tidak ada pertanyaan ditemukan' : 'No questions found'}
              </h3>
              <p className="text-gray-400">
                {language === 'id'
                  ? 'Coba kata kunci pencarian yang berbeda'
                  : 'Try different search keywords'
                }
              </p>
            </div>
          ) : (
            Object.entries(filteredCategories).map(([categoryKey, category]: [string, FAQCategory]) => (
              <section key={categoryKey} className="mb-8">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === categoryKey ? '' : categoryKey)}
                  className="w-full flex items-center justify-between p-4 bg-dark-surface border border-dark-border rounded-lg hover:border-brand-500/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{category.icon}</span>
                    <h2 className="text-xl font-semibold text-white">{category.title}</h2>
                    <span className="text-sm text-gray-400">({category.questions.length})</span>
                  </div>
                  <svg 
                    className={`w-5 h-5 text-gray-400 transform transition-transform ${
                      expandedCategory === categoryKey ? 'rotate-180' : ''
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedCategory === categoryKey && (
                  <div className="mt-4 space-y-4">
                    {category.questions.map((question: FAQQuestion, index: number) => (
                      <div 
                        key={index}
                        className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedQuestion(
                            expandedQuestion === `${categoryKey}-${index}` 
                              ? null 
                              : `${categoryKey}-${index}`
                          )}
                          className="w-full p-4 text-left hover:bg-dark-bg transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <h3 className="font-medium text-white pr-4">{question.q}</h3>
                            <svg 
                              className={`w-5 h-5 text-brand-400 flex-shrink-0 transform transition-transform ${
                                expandedQuestion === `${categoryKey}-${index}` ? 'rotate-180' : ''
                              }`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        
                        {expandedQuestion === `${categoryKey}-${index}` && (
                          <div className="px-4 pb-4">
                            <div className="border-t border-dark-border pt-4">
                              <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                                {question.a}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>

        {/* CTA Section */}
        <section className="bg-dark-surface border-t border-dark-border py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              {language === 'id'
                ? 'Masih punya pertanyaan?'
                : 'Still have questions?'
              }
            </h2>
            <p className="text-gray-300 mb-8">
              {language === 'id'
                ? 'Tim dukungan kami siap membantu Anda memulai dengan QuantForge AI.'
                : 'Our support team is ready to help you get started with QuantForge AI.'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="mailto:support@quanforge.ai"
                className="bg-brand-600 hover:bg-brand-500 px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                {language === 'id' ? 'Hubungi Dukungan' : 'Contact Support'}
              </a>
              <a 
                href="/wiki"
                className="border border-brand-500 text-brand-400 hover:bg-brand-500 hover:text-white px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                {language === 'id' ? 'Kunjungi Wiki' : 'Visit Wiki'}
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export { FAQComponent as FAQ };
export default FAQComponent;