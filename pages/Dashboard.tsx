import React from 'react';
import { Link } from 'react-router-dom';
import { UserSession } from '../types';
import { useDashboardStats } from '../hooks/useDashboardStats';

interface DashboardProps {
  session: UserSession;
}

export const Dashboard: React.FC<DashboardProps> = ({ session }) => {
  const {
    totalRobots,
    activeRobots,
    totalStrategies,
    recentActivity,
    loading,
    error,
    refresh,
    isEmpty
  } = useDashboardStats({ refreshInterval: 30000 });

  const quickActions = [
    { 
      title: 'Create New Robot', 
      description: 'Generate a new trading robot with AI',
      href: '/generator',
      icon: '🤖',
      color: 'bg-brand-500 hover:bg-brand-600'
    },
    { 
      title: 'View Strategies', 
      description: 'Browse and manage existing strategies',
      href: '/strategies',
      icon: '📊',
      color: 'bg-green-500 hover:bg-green-600'
    },
    { 
      title: 'Backtesting', 
      description: 'Test strategies on historical data',
      href: '/backtest',
      icon: '📈',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    { 
      title: 'Analytics', 
      description: 'View performance metrics and reports',
      href: '/analytics',
      icon: '📉',
      color: 'bg-purple-500 hover:bg-purple-600'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {session.user.email?.split('@')[0] || 'User'}! 👋
        </h1>
        <p className="text-gray-400">
          Manage your trading robots and generate new strategies with AI
        </p>
      </div>

      {/* Empty State for New Users */}
      {!loading && !error && isEmpty && (
        <div className="bg-dark-surface rounded-lg border border-gray-700 p-12 mb-8 text-center">
          <div className="text-6xl mb-6">🤖</div>
          <h2 className="text-2xl font-bold text-white mb-4">Welcome to QuantForge AI</h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Start your journey into algorithmic trading by creating your first AI-powered trading robot. 
            Describe your strategy in plain English and let our AI generate professional MQL5 code.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              to="/generator"
              className="inline-flex items-center px-6 py-3 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors font-medium"
            >
              <span className="mr-2">🚀</span>
              Create Your First Robot
            </Link>
            <Link
              to="/wiki"
              className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
            >
              <span className="mr-2">📚</span>
              Learn More
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="text-center">
              <div className="text-3xl mb-3">💬</div>
              <h3 className="font-semibold text-white mb-2">Natural Language</h3>
              <p className="text-sm text-gray-400">Describe your strategy in plain English</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="font-semibold text-white mb-2">AI-Powered</h3>
              <p className="text-sm text-gray-400">Advanced AI generates professional MQL5 code</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">📈</div>
              <h3 className="font-semibold text-white mb-2">Trade Ready</h3>
              <p className="text-sm text-gray-400">Deploy directly to MetaTrader 5</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard Content (Hidden when empty) */}
      {!isEmpty && (
        <>
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64 mb-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="text-red-800">
              <h3 className="font-semibold">Error loading dashboard data</h3>
              <p className="text-sm">{error}</p>
            </div>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-dark-surface rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Robots</p>
                <p className="text-2xl font-semibold text-white">{totalRobots}</p>
              </div>
              <div className="text-3xl">🤖</div>
            </div>
          </div>

          <div className="bg-dark-surface rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Active Robots</p>
                <p className="text-2xl font-semibold text-green-400">{activeRobots}</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </div>

          <div className="bg-dark-surface rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Strategies</p>
                <p className="text-2xl font-semibold text-white">{totalStrategies}</p>
              </div>
              <div className="text-3xl">📊</div>
            </div>
          </div>

          <div className="bg-dark-surface rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Success Rate</p>
                <p className="text-2xl font-semibold text-brand-400">
                  {totalRobots > 0 ? Math.round((activeRobots / totalRobots) * 100) : 0}%
                </p>
              </div>
              <div className="text-3xl">📈</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions (Hidden when empty) */}
      {!isEmpty && (
        <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              to={action.href}
              className={`${action.color} text-white rounded-lg p-6 text-center transition-colors duration-200`}
            >
              <div className="text-4xl mb-3">{action.icon}</div>
              <h3 className="font-semibold mb-1">{action.title}</h3>
              <p className="text-sm opacity-90">{action.description}</p>
            </Link>
          ))}
        </div>
        </div>
      )}

      {/* Recent Activity */}
      {!loading && !error && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
            <button
              onClick={refresh}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="bg-dark-surface rounded-lg border border-gray-700">
            {recentActivity.length > 0 ? (
              <div className="divide-y divide-gray-700">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-brand-500 rounded-full"></div>
                      <p className="text-white">{activity.message}</p>
                    </div>
                    <p className="text-sm text-gray-400">{activity.time}</p>
                  </div>
                ))}
              </div>
            ) : isEmpty ? (
              <div className="p-8 text-center text-gray-400">
                <div className="mb-4">
                  <div className="text-4xl mb-2">🤖</div>
                  <p className="font-semibold mb-1">No robots yet</p>
                  <p className="text-sm">Create your first trading robot to get started</p>
                </div>
                <Link
                  to="/generator"
                  className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors text-sm"
                >
                  Create Robot
                </Link>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">
                No recent activity to display
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default Dashboard;