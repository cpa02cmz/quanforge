
import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { mockDb } from '../services/supabase';
import { Robot, UserSession } from '../types';
import { useToast } from '../components/Toast';
import { useTranslation } from '../services/i18n';
import { SEOHead, structuredDataTemplates } from '../utils/seo';



interface DashboardProps {
    session: UserSession | null;
}

export const Dashboard: React.FC<DashboardProps> = memo(({ session }) => {
  const { t } = useTranslation();
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  
  // Debounce search term to improve performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms debounce delay
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { showToast } = useToast();

  useEffect(() => {
    loadRobots();
  }, []);

  const loadRobots = async () => {
    try {
      const { data, error } = await mockDb.getRobots();
      if (error) throw error;
      if (data) setRobots(data);
    } catch (err) {
      console.error('Failed to load robots', err);
      showToast('Failed to load robots', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!window.confirm(t('dash_delete_confirm', { name }))) {
        return;
    }

    setProcessingId(id);
    try {
        const { error } = await mockDb.deleteRobot(id);
        if (error) throw error;
        // Optimistic update
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

  // Filter Logic - memoized for performance with debounced search
  const filteredRobots = useMemo(() => 
    robots.filter(robot => {
      const matchesSearch = robot.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesType = filterType === 'All' || (robot.strategy_type || 'Custom') === filterType;
      return matchesSearch && matchesType;
    }), [robots, debouncedSearchTerm, filterType]
  );

  // Derived list of unique strategy types for the dropdown - memoized
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
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{t('dash_title')}</h1>
          <p className="text-gray-400">{t('dash_subtitle')}</p>
        </div>
        <Link 
          to="/generator" 
          className="flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-lg shadow-brand-600/20"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          <span>{t('dash_create_btn')}</span>
        </Link>
      </div>

      {/* Search and Filter Toolbar */}
      {robots.length > 0 && (
          <div className="bg-dark-surface border border-dark-border rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                  <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input 
                      type="text" 
                      placeholder={t('dash_search_placeholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-dark-bg border border-dark-border rounded-lg pl-10 pr-4 py-2 text-white focus:ring-1 focus:ring-brand-500 outline-none placeholder-gray-600"
                      aria-label="Search trading robots"
                      id="robot-search"
                  />
              </div>
              <div className="w-full md:w-48">
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
      )}

      {loading ? (
        <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : robots.length === 0 ? (
        <div className="bg-dark-surface border border-dark-border rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
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
            <div key={robot.id} className="bg-dark-surface border border-dark-border rounded-xl p-6 hover:border-brand-500/50 transition-colors group relative flex flex-col h-full animate-fade-in-up">
              {processingId === robot.id && (
                  <div className="absolute inset-0 bg-dark-surface/80 flex items-center justify-center z-10 rounded-xl backdrop-blur-sm">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                  </div>
              )}
              
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-brand-500/10 rounded-lg text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
                <span className="text-xs font-mono text-gray-500">{new Date(robot.created_at).toLocaleDateString()}</span>
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1 truncate" title={robot.name}>{robot.name}</h3>
              <p className="text-sm text-gray-400 mb-4 line-clamp-2 flex-grow">{robot.description}</p>
              
              <div className="pt-4 border-t border-dark-border flex items-center justify-between mt-auto">
                 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                    ${robot.strategy_type === 'Scalping' ? 'bg-purple-900/30 text-purple-300 border-purple-800' : 
                      robot.strategy_type === 'Trend' ? 'bg-green-900/30 text-green-300 border-green-800' :
                      'bg-blue-900/30 text-blue-300 border-blue-800'}
                 `}>
                    {robot.strategy_type || 'Custom'}
                 </span>
                 
                 <div className="flex items-center space-x-1">
                    <button 
                        onClick={() => handleDuplicate(robot.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                        title="Duplicate Robot"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V4" /></svg>
                    </button>
                    
                    <button 
                        onClick={() => handleDelete(robot.id, robot.name)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        title="Delete Robot"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    
                    <Link 
                        to={`/generator/${robot.id}`} 
                        className="ml-2 px-3 py-1.5 bg-dark-bg border border-dark-border hover:border-brand-500 text-xs font-medium text-gray-300 hover:text-white rounded-md transition-all flex items-center"
                    >
                        Edit
                    </Link>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </>
  );
});
