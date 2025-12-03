
import React, { useState, useEffect } from 'react';
import { WIKI_CONTENT } from '../constants';
import { useTranslation } from '../services/i18n';
import { AdvancedSEO } from '../utils/advancedSEO';

export const Wiki: React.FC = () => {
  const { language } = useTranslation();
  
  // Dynamic content based on language
  const content = WIKI_CONTENT[language] || WIKI_CONTENT['en'];

  const [activeSectionId, setActiveSectionId] = useState(content[0]?.id || 'getting-started');
  const [searchTerm, setSearchTerm] = useState('');

  // Reset active section if language changes
  useEffect(() => {
      setActiveSectionId(content[0]?.id || 'getting-started');
  }, [language, content]);

  // Helper to highlight text if searching
  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) {
      return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) ? <span key={i} className="bg-brand-500/30 text-white rounded px-0.5">{part}</span> : part
        )}
      </span>
    );
  };

  // Filter content based on search
  const filteredSections = content.map(section => {
    const matchingArticles = section.articles.filter(article => 
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Also include the section if the section title matches
    const titleMatch = section.title.toLowerCase().includes(searchTerm.toLowerCase());

    if (titleMatch || matchingArticles.length > 0) {
      return {
        ...section,
        articles: matchingArticles.length > 0 ? matchingArticles : section.articles
      };
    }
    return null;
  }).filter(Boolean);

  const activeSection = content.find(s => s.id === activeSectionId);

  // Render Markdown-ish content
  const renderContent = (content: string) => {
      return content.split('\n').map((line, idx) => {
          if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
              // Subheaders
              return <h4 key={idx} className="font-bold text-gray-200 mt-4 mb-2">{highlightText(line.replace(/\*\*/g, ''), searchTerm)}</h4>
          }
          if (line.trim().startsWith('- ')) {
              // List items
              return (
                  <li key={idx} className="ml-4 list-disc text-gray-400 mb-1">
                      {highlightText(line.replace('- ', ''), searchTerm)}
                  </li>
              );
          }
          if (line.trim().match(/^\d+\./)) {
               // Numbered list
               return (
                  <div key={idx} className="ml-4 text-gray-400 mb-1 flex gap-2">
                       <span>{line.split('.')[0]}.</span>
                       <span>{highlightText(line.substring(line.indexOf('.') + 1).trim(), searchTerm)}</span>
                  </div>
               );
          }
          if (line.trim() === '') return <div key={idx} className="h-2"></div>;
          
          // Bold inline
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return (
              <p key={idx} className="text-gray-300 leading-relaxed mb-1">
                  {parts.map((part, i) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={i} className="text-brand-400 font-bold">{highlightText(part.slice(2, -2), searchTerm)}</strong>;
                      }
                      return <span key={i}>{highlightText(part, searchTerm)}</span>;
                  })}
              </p>
          )
      });
  };

  const faqs = [
  {
    question: "What is QuantForge AI?",
    answer: "QuantForge AI is an advanced web-based platform that uses Google's Gemini AI models to generate, analyze, and manage trading robots for MetaTrader 5."
  },
  {
    question: "How do I create a trading robot?",
    answer: "Simply describe your trading strategy in natural language, and our AI will generate professional MQL5 code that you can deploy to MetaTrader 5."
  },
  {
    question: "Is QuantForge AI free to use?",
    answer: "Yes, QuantForge AI offers free access to generate and manage trading robots. You only need your own API keys for the AI service."
  },
  {
    question: "What programming languages are supported?",
    answer: "QuantForge AI specializes in MQL5 (MetaQuotes Language 5) for MetaTrader 5 Expert Advisors and custom indicators."
  },
  {
    question: "Can I use the generated robots with any broker?",
    answer: "Yes, the generated MQL5 robots work with any broker that supports MetaTrader 5 platform."
  },
  {
    question: "How accurate are the trading strategies?",
    answer: "The AI generates strategies based on your requirements and market analysis. However, all strategies should be thoroughly tested on demo accounts before live trading."
  },
  {
    question: "What types of trading strategies can I create?",
    answer: "You can create various strategies including trend following, mean reversion, breakout, scalping, and custom indicator-based strategies."
  },
  {
    question: "Is my data secure?",
    answer: "Yes, all data is encrypted and stored securely. You can also use local storage mode for complete privacy."
  }
];

  return (
    <>
      <AdvancedSEO 
        pageType="wiki"
        title="Documentation & Wiki - QuantForge AI"
        description="Complete documentation and guides for QuantForge AI. Learn how to create MQL5 trading robots, use AI features, and optimize your trading strategies."
        keywords="MQL5 documentation, trading robot guide, MetaTrader 5 tutorial, AI trading help, QuantForge wiki, forex trading guide, expert advisor tutorial, automated trading documentation"
        canonicalUrl="https://quanforge.ai/wiki"
        readingTime={30}
        wordCount={5000}
        faqs={faqs}
        breadcrumbs={[
          { name: 'Home', url: 'https://quanforge.ai/' },
          { name: 'Wiki', url: 'https://quanforge.ai/wiki' }
        ]}
        tags={['Documentation', 'MQL5', 'Trading', 'Tutorial', 'Guide']}
        category="Education"
      />
      <div className="flex flex-col md:flex-row h-full bg-dark-bg">
        {/* Sidebar / Navigation */}
        <aside className="w-full md:w-80 bg-dark-surface border-r border-dark-border flex flex-col h-1/3 md:h-full" role="navigation" aria-label="Documentation navigation">
          <div className="p-4 border-b border-dark-border">
              <h2 className="text-xl font-bold text-white mb-2">{language === 'id' ? 'Wiki & Panduan' : 'Wiki & Guide'}</h2>
              <div className="relative">
                  <svg className="w-4 h-4 absolute left-3 top-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input 
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={language === 'id' ? "Cari dokumentasi..." : "Search documentation..."}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none"
                />
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {filteredSections.map((section: any) => (
                <button
                    key={section.id}
                    onClick={() => {
                        setActiveSectionId(section.id);
                        setSearchTerm(''); // Optional: clear search on select, or keep it.
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg mb-1 flex items-center justify-between transition-colors ${
                        activeSectionId === section.id 
                        ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' 
                        : 'text-gray-400 hover:bg-dark-bg hover:text-white'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-lg">{section.icon}</span>
                        <span className="font-medium">{section.title}</span>
                    </div>
                    {activeSectionId === section.id && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    )}
                </button>
            ))}
            {filteredSections.length === 0 && (
                <div className="text-center p-4 text-gray-500 text-sm">
                    {language === 'id' ? 'Tidak ada topik yang cocok.' : 'No matching topics found.'}
                </div>
            )}
            </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar relative" role="main">
          {activeSection ? (
              <article className="max-w-3xl mx-auto animate-fade-in-up">
                  <header className="flex items-center gap-4 mb-8 border-b border-dark-border pb-6">
                      <span className="text-4xl bg-dark-surface w-16 h-16 rounded-2xl flex items-center justify-center border border-dark-border shadow-lg" aria-hidden="true">
                          {activeSection.icon}
                      </span>
                      <div>
                          <h1 className="text-3xl font-bold text-white">{activeSection.title}</h1>
                          <p className="text-gray-400 mt-1">{language === 'id' ? 'Dokumentasi & Tips' : 'Documentation & Tips'}</p>
                      </div>
                  </header>

                  <div className="space-y-10">
                      {activeSection.articles.map((article, idx) => (
                          <section key={idx} className="bg-dark-surface border border-dark-border rounded-xl p-6 shadow-sm">
                              <h3 className="text-xl font-bold text-brand-400 mb-4">{highlightText(article.title, searchTerm)}</h3>
                              <div className="text-gray-300 leading-relaxed text-sm md:text-base">
                                  {renderContent(article.content)}
                              </div>
                          </section>
                      ))}
                  </div>
              </article>
          ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                  {language === 'id' ? 'Pilih topik untuk melihat panduan.' : 'Select a topic to view guide.'}
              </div>
          )}
        </main>
      </div>
    </>
  );
};
