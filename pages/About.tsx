import React from 'react';

export const About: React.FC = () => {
  const team = [
    {
      name: 'QuantForge Team',
      role: 'AI Trading Solutions',
      description: 'Dedicated to revolutionizing algorithmic trading with AI-powered automation'
    }
  ];

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            About QuantForge AI
          </h1>
          <p className="text-xl text-brand-100 max-w-3xl mx-auto">
            Empowering traders with cutting-edge AI technology to generate professional trading algorithms
          </p>
        </div>
      </div>

      {/* Mission Section */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Our Mission</h2>
              <p className="text-gray-300 text-lg mb-6">
                We believe that powerful trading algorithms should be accessible to everyone, not just institutional 
                traders with massive development budgets. QuantForge AI bridges this gap by providing professional-grade 
                MQL5 trading robot generation through intuitive AI-powered tools.
              </p>
              <p className="text-gray-300 text-lg">
                Our platform combines advanced machine learning with deep financial market expertise to deliver 
                trading solutions that compete with the best in the industry.
              </p>
            </div>
            <div className="bg-dark-surface rounded-lg p-8 border border-gray-700">
              <h3 className="text-xl font-semibold text-white mb-4">What We Do</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start space-x-3">
                  <span className="text-brand-500 mt-1">•</span>
                  <span>Generate optimized MQL5 Expert Advisors using AI</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-brand-500 mt-1">•</span>
                  <span>Provide comprehensive backtesting tools</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-brand-500 mt-1">•</span>
                  <span>Offer risk management optimization</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-brand-500 mt-1">•</span>
                  <span>Deploy strategies to multiple trading platforms</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Technology */}
      <div className="bg-dark-surface py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Powered by Advanced Technology</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              We leverage cutting-edge AI and machine learning to deliver superior trading strategies
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🧠</div>
              <h3 className="text-xl font-semibold text-white mb-2">Artificial Intelligence</h3>
              <p className="text-gray-400">
                Advanced neural networks trained on millions of market data points
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold text-white mb-2">High Performance</h3>
              <p className="text-gray-400">
                Optimized algorithms for fast execution and minimal latency
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-semibold text-white mb-2">Secure & Reliable</h3>
              <p className="text-gray-400">
                Enterprise-grade security and 99.9% uptime guarantee
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Meet Our Team</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {team.map((member) => (
              <div key={member.name} className="bg-dark-surface rounded-lg p-8 border border-gray-700 text-center">
                <div className="w-24 h-24 bg-brand-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-3xl">👥</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{member.name}</h3>
                <p className="text-brand-400 mb-3">{member.role}</p>
                <p className="text-gray-400 text-sm">{member.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contact CTA */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Trading?
          </h2>
          <p className="text-brand-100 text-lg mb-8">
            Join thousands of traders who have already revolutionized their strategies with QuantForge AI
          </p>
          <button className="bg-white text-brand-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            Get Started Today
          </button>
        </div>
      </div>
    </div>
  );
};

export default About;