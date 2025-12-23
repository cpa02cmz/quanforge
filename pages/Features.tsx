import React from 'react';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon }) => (
  <div className="bg-dark-surface rounded-lg p-6 border border-gray-700 hover:border-brand-500 transition-colors">
    <div className="text-4xl mb-4">{icon}</div>
    <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-400">{description}</p>
  </div>
);

export const Features: React.FC = () => {
  const features = [
    {
      title: 'AI-Powered Generation',
      description: 'Generate professional MQL5 trading robots using advanced AI technology and industry best practices.',
      icon: '🤖'
    },
    {
      title: 'Advanced Backtesting',
      description: 'Test your strategies on historical data with sophisticated analysis tools and detailed performance metrics.',
      icon: '📊'
    },
    {
      title: 'Smart Optimization',
      description: 'Optimize your trading strategies with machine learning algorithms to maximize profitability.',
      icon: '⚡'
    },
    {
      title: 'Risk Management',
      description: 'Built-in risk management tools to protect your capital with stop-loss, take-profit, and position sizing.',
      icon: '🛡️'
    },
    {
      title: 'Real-time Monitoring',
      description: 'Monitor your trading algorithms in real-time with comprehensive dashboards and alerts.',
      icon: '📱'
    },
    {
      title: 'Cloud Deployment',
      description: 'Deploy your trading bots to cloud platforms for reliable, always-on trading across multiple markets.',
      icon: '☁️'
    }
  ];

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Powerful Features for Professional Trading
          </h1>
          <p className="text-xl text-brand-100 max-w-3xl mx-auto">
            Everything you need to create, test, and deploy profitable trading algorithms with confidence
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Built for Professional Traders
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Our platform combines cutting-edge AI technology with proven trading strategies to deliver
              exceptional results
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Technical Specs */}
      <div className="bg-dark-surface py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Technical Excellence
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xl font-semibold text-white mb-6">Supported Platforms</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-center space-x-3">
                  <span className="text-green-500">✓</span>
                  <span>MetaTrader 5 (MT5)</span>
                </li>
                <li className="flex items-center space-x-3">
                  <span className="text-green-500">✓</span>
                  <span>MetaTrader 4 (MT4)</span>
                </li>
                <li className="flex items-center space-x-3">
                  <span className="text-green-500">✓</span>
                  <span>cTrader</span>
                </li>
                <li className="flex items-center space-x-3">
                  <span className="text-green-500">✓</span>
                  <span>T Trading Station API</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-6">Advanced Features</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-center space-x-3">
                  <span className="text-green-500">✓</span>
                  <span>Multi-timeframe analysis</span>
                </li>
                <li className="flex items-center space-x-3">
                  <span className="text-green-500">✓</span>
                  <span>Custom indicators integration</span>
                </li>
                <li className="flex items-center space-x-3">
                  <span className="text-green-500">✓</span>
                  <span>Advanced order management</span>
                </li>
                <li className="flex items-center space-x-3">
                  <span className="text-green-500">✓</span>
                  <span>Portfolio optimization</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Features;