import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockDb } from '../services/supabase';
import { Robot, UserSession } from '../types';
import { useToast } from '../components/Toast';
import { useTranslation } from '../services/i18n';
import { SEOHead, structuredDataTemplates } from '../utils/seo';

interface DashboardProps {
    session?: UserSession | null;
}

// Memoized Robot Card component to prevent unnecessary re-renders
const RobotCard = memo(({ 
  robot, 
  processingId, 
  onDuplicate, 
  onDelete, 
  onEdit 
}: {
  robot: Robot;
  processingId: string | null;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onEdit: (id: string) => void;
}) => {
  const getStrategyTypeStyles = (type?: string) => {
    switch (type) {
      case 'Scalping':
        return 'bg-purple-900/30 text-purple-300 border-purple-800';
      case 'Trend':
        return 'bg-green-900/30 text-green-300 border-green-800';
      default:
        return 'bg-blue-900/30 text-blue-300 border-blue-800';
    }
  };

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-6 hover:border-brand-500/50 transition-colors group relative flex flex-col h-full animate-fade-in-up">
      {processingId === robot.id && (
        <div className="absolute inset-0 bg-dark-surface/80 flex items-center justify-center z-10 rounded-xl backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      )}
      
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-brand-500/10 rounded-lg text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <span className="text-xs font-mono text-gray-500">
          {new Date(robot.created_at).toLocaleDateString()}
        </span>
      </div>
      
      <h3 className="text-lg font-bold text-white mb-1 truncate" title={robot.name}>
        {robot.name}
      </h3>
      <p className="text-sm text-gray-400 mb-4 line-clamp-2 flex-grow">
        {robot.description}
      </p>
      
      <div className="pt-4 border-t border-dark-border flex items-center justify-between mt-auto">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStrategyTypeStyles(robot.strategy_type)}`}>
          {robot.strategy_type || 'Custom'}
        </span>
        
        <div className="flex items-center space-x-1">
          <button 
            onClick={() => onDuplicate(robot.id)}
            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
            title="Duplicate Robot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V4" />
            </svg>
          </button>
          
          <button 
            onClick={() => onDelete(robot.id, robot.name)}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
            title="Delete Robot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          
          <button 
            onClick={() => onEdit(robot.id)}
            className="p-1.5 text-gray-400 hover:text-brand-400 hover:bg-brand-500/10 rounded-md transition-colors"
            title="Edit Robot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

RobotCard.displayName = 'RobotCard';

export const Dashboard: React.FC<DashboardProps> = memo(({ session }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');

  const { showToast } = useToast();

  // Load robots
  useEffect(() => {
    const loadRobots = async () => {
      try {
        setLoading(true);
        const { data, error } = await mockDb.getRobots();
        if (error) throw error;
        setRobots(data || []);
      } catch (err) {
        console.error("Failed to load robots", err);
        showToast("Failed to load robots", 'error');
      } finally {
        setLoading(false);
      }
    };

    loadRobots();
  }, [showToast]);

  // Delete handler with memoization
  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    setProcessingId(id);
    try {
        const { error } = await mockDb.deleteRobot(id);
        if (error) throw error;
        setRobots(prev => prev.filter(r => r.id !== id));
        showToast(t('dash_toast_delete_success'), 'success');
    } catch (err) {
        console.error("Failed to delete robot", err);
        showToast("Failed to delete robot", 'error');
    } finally {
        setProcessingId(null);
    }
  }, [t, showToast]);

  const handleDuplicate = useCallback(async (id: string) => {
      setProcessingId(id);
      try {
          const { data, error } = await mockDb.duplicateRobot(id);
          if (error) throw error;
          if (data && data[0]) {
              // Add new robot to the list (top)
              setRobots(prev => [data[0], ...prev]);
              showToast(t('dash_toast_duplicate_success'), 'success');
          }
      } catch (err) {
          console.error("Failed to duplicate robot", err);
          showToast("Failed to duplicate robot", 'error');
      } finally {
          setProcessingId(null);
      }
  }, [t, showToast]);

  const handleEdit = useCallback((id: string) => {
    navigate(`/generator/${id}`);
  }, [navigate]);

  // Filter Logic - memoized for performance
  const filteredRobots = useMemo(() => 
    robots.filter(robot => {
      const matchesSearch = robot.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'All' || (robot.strategy_type || 'Custom') === filterType;
      return matchesSearch && matchesType;
    }), [robots, searchTerm, filterType]
  );

  // Available strategy types for filter - memoized
  const availableTypes = useMemo(() => 
    ['All', ...Array.from(new Set(robots.map(r => r.strategy_type || 'Custom')))], 
    [robots]
  );

  return (
    <>
      <SEOHead 
        title="Dashboard - Trading Robots Management"
        description="Manage your MQL5 trading robots and Expert Advisors. View, edit, duplicate, and analyze your automated trading strategies."
        keywords="trading robot dashboard, MQL5 management, Expert Advisor dashboard, automated trading portfolio, forex robot management, MT5 EA portfolio, trading algorithm dashboard, quantitative trading portfolio"
        canonicalUrl="https://quanforge.ai/"
        structuredData={[
           structuredDataTemplates.softwareApplication,
           structuredDataTemplates.breadcrumb([
             { name: 'Home', url: 'https://quanforge.ai/' },
             { name: 'Dashboard', url: 'https://quanforge.ai/' }
           ]),
           structuredDataTemplates.videoGame(
             'Trading Robot Portfolio Manager',
             'Manage and monitor your automated trading strategies with advanced analytics and performance tracking.'
           ),
           structuredDataTemplates.webPage(
             'Trading Robot Dashboard',
             'Comprehensive dashboard for managing MQL5 trading robots and Expert Advisors with performance analytics.',
             'https://quanforge.ai/'
           )
         ]}
      />
      <div className="p-8 max-w-7xl mx-auto" role="main" aria-label="Trading robots dashboard">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{t('dash_title')}</h1>
            <p className="text-gray-400">{t('dash_subtitle')}</p>
          </div>
          <Link 
            to="/generator" 
            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            {t('dash_new_robot')}
          </Link>
        </div>

        {/* Search and Filters */}
        {robots.length > 0 && (
          <div className="bg-dark-surface border border-dark-border rounded-xl p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                          {t('dash_search_placeholder')}
                      </label>
                      <input 
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder={t('dash_search_placeholder')}
                          className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:ring-1 focus:ring-brand-500 outline-none"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                          {t('dash_filter_type')}
                      </label>
                      <select 
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-brand-500 outline-none"
                      >
                          {availableTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                          ))}
                      </select>
                  </div>
              </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          </div>
        ) : robots.length === 0 ? (
          <div className="bg-dark-surface border border-dark-border rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
              </div>
              <h3 className="text-xl font-medium text-white mb-2">{t('dash_no_robots_title')}</h3>
              <p className="text-gray-400 mb-6 max-w-sm mx-auto">{t('dash_no_robots_desc')}</p>
              <Link to="/generator" className="text-brand-400 hover:text-brand-300 font-medium hover:underline">{t('dash_start_generating')} &rarr;</Link>
          </div>
        ) : filteredRobots.length === 0 ? (
            <div className="bg-dark-surface border border-dark-border rounded-xl p-12 text-center">
                <h3 className="text-lg font-medium text-white mb-2">{t('dash_no_matches')}</h3>
                <p className="text-gray-400">Try adjusting your search or filters.</p>
                <button onClick={() => { setSearchTerm(''); setFilterType('All'); }} className="mt-4 text-brand-400 hover:underline">{t('dash_clear_filters')}</button>
            </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRobots.map((robot) => (
              <RobotCard 
                key={robot.id}
                robot={robot}
                processingId={processingId}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
});

Dashboard.displayName = 'Dashboard';