import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from '../services/i18n';
import { AdvancedSEO } from '../utils/advancedSEO';
import { generateTableOfContents } from '../utils/seoEnhanced';

// Lazy load React Router Link to reduce initial bundle size
const Link = lazy(() => import('react-router-dom').then(module => ({ default: module.Link })));

const AboutComponent: React.FC = () => {
  const { language } = useTranslation();
  const [activeSection, setActiveSection] = useState('mission');
  
  const content = {
    en: {
      title: "About QuantForge AI - Revolutionizing Automated Trading",
      description: "Learn about QuantForge AI's mission to democratize algorithmic trading through cutting-edge AI technology. Meet our team of experts and discover our story.",
      sections: [
        {
          id: 'mission',
          title: 'Our Mission',
          content: `At QuantForge AI, we're revolutionizing the world of automated trading by making sophisticated algorithmic trading accessible to everyone. Our mission is to democratize quantitative trading by providing cutting-edge AI tools that transform trading ideas into powerful, automated strategies.`,
          image: '/images/mission.jpg'
        },
        {
          id: 'team',
          title: 'Who We Are',
          content: `QuantForge AI was founded by a team of experienced quantitative traders, AI researchers, and software developers who recognized the need for more accessible and intelligent trading tools. With decades of combined experience in financial markets, machine learning, and software development, we're uniquely positioned to bridge the gap between complex quantitative trading and practical implementation.`,
          image: '/images/team.jpg'
        },
        {
          id: 'story',
          title: 'Our Story',
          content: `The journey began in 2023 when our founders, frustrated with the complexity and cost of traditional algorithmic trading solutions, set out to create something different. We believed that powerful trading strategies shouldn't be limited to hedge funds and financial institutions with massive resources.`,
          image: '/images/story.jpg'
        },
        {
          id: 'technology',
          title: 'Our Technology',
          content: `Our platform leverages cutting-edge technologies including Natural Language Processing, Machine Learning, Risk Management Algorithms, Real-time Market Integration, and Advanced Analytics to provide the most sophisticated trading tools available.`,
          image: '/images/technology.jpg'
        },
        {
          id: 'leadership',
          title: 'Leadership Team',
          content: `Meet our leadership team: Dr. Sarah Chen (CEO & Co-Founder) with 15+ years in quantitative trading, Michael Rodriguez (CTO & Co-Founder) expert in AI and machine learning, and Emily Watson (Head of Product) with 10+ years in trading platform product management.`,
          image: '/images/leadership.jpg'
        },
        {
          id: 'values',
          title: 'Our Values',
          content: `We're driven by Innovation, Accessibility, Transparency, Education, and Security. These core values guide everything we do, from product development to customer support.`,
          image: '/images/values.jpg'
        },
        {
          id: 'impact',
          title: 'Our Impact',
          content: `Since our launch, QuantForge AI has helped over 50,000 traders create automated strategies, generated more than 1 million trading robots, and processed over $10 billion in simulated trades.`,
          image: '/images/impact.jpg'
        },
        {
          id: 'recognition',
          title: 'Recognition',
          content: `Our achievements have been recognized by Forbes, TechCrunch, Bloomberg, and we've received the FinTech Innovation Award 2024 for Best AI Trading Platform.`,
          image: '/images/recognition.jpg'
        },
        {
          id: 'future',
          title: 'Looking to the Future',
          content: `Our vision includes Multi-Asset Support, Advanced AI Models, Institutional Features, Global Expansion, and Mobile Applications to continue revolutionizing automated trading.`,
          image: '/images/future.jpg'
        }
      ]
    },
    id: {
      title: "Tentang QuantForge AI - Revolusi Trading Otomatis",
      description: "Pelajari tentang misi QuantForge AI untuk mendemokratisasikan trading algoritmik melalui teknologi AI canggih. Temui tim ahli kami dan temukan kisah kami.",
      sections: [
        {
          id: 'misi',
          title: 'Misi Kami',
          content: `Di QuantForge AI, kami merevolusi dunia trading otomatis dengan membuat trading algoritmik yang canggih dapat diakses oleh semua orang. Misi kami adalah mendemokratisasikan trading kuantitatif dengan menyediakan tools AI yang mutakhir untuk mengubah ide trading menjadi strategi otomatis yang kuat.`,
          image: '/images/mission.jpg'
        },
        {
          id: 'tim',
          title: 'Siapa Kami',
          content: `QuantForge AI didirikan oleh tim trader kuantitatif berpengalaman, peneliti AI, dan pengembang perangkat lunak yang mengenali kebutuhan akan tools trading yang lebih mudah diakses dan cerdas. Dengan pengalaman puluhan tahun di pasar keuangan, machine learning, dan pengembangan perangkat lunak, kami posisi unik untuk menjembatani trading kuantitatif kompleks dengan implementasi praktis.`,
          image: '/images/team.jpg'
        }
      ]
    }
  };

  const currentContent = content[language] || content.en;
  const tableOfContents = generateTableOfContents(currentContent.sections.map(s => `<h2>${s.title}</h2><p>${s.content}</p>`).join('\n'));

  useEffect(() => {
    const handleScroll = () => {
      const sections = currentContent.sections;
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentContent.sections]);

  return (
    <>
      <AdvancedSEO
        pageType="about"
        title={currentContent.title}
        description={currentContent.description}
        keywords="QuantForge AI about, automated trading team, AI trading platform company, MQL5 generator company, trading robot developers, quantitative finance team, algorithmic trading experts"
        canonicalUrl="https://quanforge.ai/about"
        type="website"
        author="QuantForge AI"
        publishDate="2023-01-01"
        category="Company"
        tags={['QuantForge AI', 'Trading Technology', 'AI', 'MQL5', 'Company']}
        enableAnalytics={true}
      />
      
      <div className="min-h-screen bg-dark-bg text-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              {language === 'id' ? 'Tentang QuantForge AI' : 'About QuantForge AI'}
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              {language === 'id' 
                ? 'Mendemokratisasikan trading algoritmik melalui teknologi AI canggih'
                : 'Democratizing algorithmic trading through cutting-edge AI technology'
              }
            </p>
            <div className="flex justify-center space-x-4">
              <Suspense fallback={
                <button className="bg-brand-600 px-8 py-3 rounded-lg font-semibold text-white">
                  {language === 'id' ? 'Mulai Sekarang' : 'Get Started'}
                </button>
              }>
                <Link 
                  to="/generator"
                  className="bg-brand-600 hover:bg-brand-500 px-8 py-3 rounded-lg font-semibold transition-colors"
                >
                  {language === 'id' ? 'Mulai Sekarang' : 'Get Started'}
                </Link>
              </Suspense>
              <Suspense fallback={
                <button className="border border-brand-500 text-brand-400 px-8 py-3 rounded-lg font-semibold">
                  {language === 'id' ? 'Pelajari Lebih Lanjut' : 'Learn More'}
                </button>
              }>
                <Link 
                  to="/wiki"
                  className="border border-brand-500 text-brand-400 hover:bg-brand-500 hover:text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                >
                  {language === 'id' ? 'Pelajari Lebih Lanjut' : 'Learn More'}
                </Link>
              </Suspense>
            </div>
          </div>
        </section>

        {/* Table of Contents */}
        <section className="sticky top-20 z-10 bg-dark-surface border-b border-dark-border py-4 px-4">
          <div className="max-w-7xl mx-auto">
            <nav className="flex flex-wrap items-center space-x-6">
              <span className="text-sm font-semibold text-gray-400">
                {language === 'id' ? 'Navigasi:' : 'Navigation:'}
              </span>
              {tableOfContents.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    const element = document.getElementById(item.id);
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`text-sm transition-colors ${
                    activeSection === item.id 
                      ? 'text-brand-400 font-semibold' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </nav>
          </div>
        </section>

        {/* Content Sections */}
        <div className="max-w-7xl mx-auto px-4 py-12">
          {currentContent.sections.map((section, index) => (
            <section 
              key={section.id}
              id={section.id}
              className="mb-20 scroll-mt-24"
            >
              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                index % 2 === 1 ? 'lg:flex-row-reverse' : ''
              }`}>
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
                    {section.title}
                  </h2>
                  <div className="prose prose-lg prose-invert max-w-none">
                    {section.content.split('\n').map((paragraph, pIndex) => (
                      <p key={pIndex} className="text-gray-300 leading-relaxed mb-4">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <div className="bg-dark-surface rounded-2xl p-8 border border-dark-border">
                    <div className="aspect-video bg-gradient-to-br from-brand-500/20 to-brand-600/20 rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-brand-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <p className="text-gray-400">
                          {language === 'id' ? 'Gambar Konten' : 'Content Image'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* CTA Section */}
        <section className="bg-dark-surface border-t border-dark-border py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              {language === 'id' 
                ? 'Bergabunglah dengan Revolusi Trading'
                : 'Join the Trading Revolution'
              }
            </h2>
            <p className="text-gray-300 mb-8">
              {language === 'id'
                ? 'Apakah Anda trader kuantitatif berpengalaman atau baru memulai perjalanan trading otomatis, QuantForge AI ada di sini untuk membantu Anda berhasil.'
                : 'Whether you\'re an experienced quantitative trader or just starting your journey in automated trading, QuantForge AI is here to help you succeed.'
              }
            </p>
            <Suspense fallback={
              <button className="bg-brand-600 hover:bg-brand-500 px-8 py-3 rounded-lg font-semibold transition-colors inline-block text-white">
                {language === 'id' ? 'Mulai Gratis' : 'Start Free'}
              </button>
            }>
              <Link 
                to="/generator"
                className="bg-brand-600 hover:bg-brand-500 px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
              >
                {language === 'id' ? 'Mulai Gratis' : 'Start Free'}
              </Link>
            </Suspense>
          </div>
        </section>
      </div>
    </>
  );
};

export { AboutComponent as About };
export default AboutComponent;