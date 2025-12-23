import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserSession } from '../types';

interface ActivityItem {
  type: string;
  message: string;
  time: string;
}

interface DashboardProps {
  session: UserSession;
}

export const Dashboard: React.FC<DashboardProps> = ({ session }) => {
  const [stats, setStats] = useState({
    totalRobots: 0,
    activeRobots: 0,
    totalStrategies: 0,
    recentActivity: [] as ActivityItem[]
  });

  useEffect(() => {
    // Initialize dashboard data
    const loadDashboardData = async () => {
      try {
        // This would normally fetch from API
        setStats({
          totalRobots: 12,
          activeRobots: 8,
          totalStrategies: 25,
          recentActivity: [
            { type: 'robot_created', message: 'Created new EA: GoldenCross Strategy', time: '2 hours ago' },
            { type: 'backtest', message: 'Backtest completed: RSI Strategy', time: '5 hours ago' },
            { type: 'deployment', message: 'Deployed to production', time: '1 day ago' }
          ]
        });
      } catch (error) {
        // Failed to load dashboard data - error handled by UI states
      }
    };

    loadDashboardData();
  }, []);

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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-dark-surface rounded-lg p-6 border border-gray-700">
          <div className="flex items justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Total Robots</p>
              <p className="text-2xl font-semibold text-white">{stats.totalRobots}</p>
            </div>
            <div className="text-3xl">🤖</div>
          </div>
        </div>

        <div className="bg-dark-surface rounded-lg p-6 border border-gray-700">
          <div className="flex items justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Active Robots</p>
              <p className="text-2xl font-semibold text-green-400">{stats.activeRobots}</p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>

        <div className="bg-dark-surface rounded-lg p-6 border border-gray-700">
          <div className="flex items justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Total Strategies</p>
              <p className="text-2xl font-semibold text-white">{stats.totalStrategies}</p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>

        <div className="bg-dark-surface rounded-lg p-6 border border-gray-700">
          <div className="flex items justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Success Rate</p>
              <p className="text-2xl font-semibold text-brand-400">87%</p>
            </div>
            <div className="text-3xl">📈</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
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

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
        <div className="bg-dark-surface rounded-lg border border-gray-700">
          {stats.recentActivity.length > 0 ? (
            <div className="divide-y divide-gray-700">
              {stats.recentActivity.map((activity, index) => (
                <div key={index} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-brand-500 rounded-full"></div>
                    <p className="text-white">{activity.message}</p>
                  </div>
                  <p className="text-sm text-gray-400">{activity.time}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              No recent activity to display
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;