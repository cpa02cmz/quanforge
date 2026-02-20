
import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { frontendPerformanceOptimizer } from '../services/frontendPerformanceOptimizer';
import { Link } from 'react-router-dom';
import { db } from '../services';
import { Robot, UserSession } from '../types';
import { useToast } from '../components/useToast';
import { useTranslation } from '../services/i18n';
import { useAnimatedPlaceholder } from '../hooks/useAnimatedPlaceholder';
import { AdvancedSEO } from '../utils/advancedSEO';
import { createScopedLogger } from '../utils/logger';
import { VirtualScrollList } from '../components/VirtualScrollList';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { CopyButton } from '../components/CopyButton';
import { CardSkeletonLoader } from '../components/LoadingState';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { TiltCard } from '../components/TiltCard';

// Debounce utility for search optimization
 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const debounce = <T extends (...args: any[]) => any>(func: T, delay: number): T => {
  let timeoutId: ReturnType<typeof setTimeout>;
   
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
};

const logger = createScopedLogger('Dashboard');

const getStrategyIcon = (strategyType: string) => {
  const type = strategyType?.toLowerCase() || 'custom';
  switch (type) {
    case 'scalping':
      return (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case 'trend':
      return (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      );
    default:
      return (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      );
  }
};

const getStrategyConfig = (strategyType: string) => {
  const type = strategyType?.toLowerCase() || 'custom';
  switch (type) {
    case 'scalping':
      return {
        bgClass: 'bg-purple-900/30',
        textClass: 'text-purple-300',
        borderClass: 'border-purple-800',
        ariaLabel: 'Scalping strategy'
      };
    case 'trend':
      return {
        bgClass: 'bg-green-900/30',
        textClass: 'text-green-300',
        borderClass: 'border-green-800',
        ariaLabel: 'Trend following strategy'
      };
    default:
      return {
        bgClass: 'bg-blue-900/30',
        textClass: 'text-blue-300',
        borderClass: 'border-blue-800',
        ariaLabel: 'Custom strategy'
      };
  }
};

interface RobotCardProps {
  robot: Robot;
  processingId: string | null;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const RobotCard: React.FC<RobotCardProps> = memo(({
  robot,
  processingId,
  onDuplicate,
  onDelete
}) => {
  const handleDelete = useCallback(() => {
    onDelete(robot.id, robot.name);
  }, [robot.id, robot.name, onDelete]);

  const handleDuplicate = useCallback(() => {
    onDuplicate(robot.id);
  }, [robot.id, onDuplicate]);

  return (
    <TiltCard
      intensity="subtle"
      scale="sm"
      showGlare
      bordered
      rounded="xl"
      className="group relative flex flex-col h-full animate-fade-in-up"
    >
      <div className="p-6 flex flex-col h-full">
        {processingId === robot.id && (
          <div className="absolute inset-0 bg-dark-surface/80 flex items-center justify-center z-10 rounded-xl backdrop-blur-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          </div>
        )}

        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-brand-500/10 rounded-lg text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-colors" aria-hidden="true">
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
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border
              ${getStrategyConfig(robot.strategy_type).bgClass}
              ${getStrategyConfig(robot.strategy_type).textClass}
              ${getStrategyConfig(robot.strategy_type).borderClass}
            `}
            aria-label={getStrategyConfig(robot.strategy_type).ariaLabel}
          >
            {getStrategyIcon(robot.strategy_type)}
            {robot.strategy_type || 'Custom'}
          </span>

          <div className="flex items-center space-x-1">
            <CopyButton
              textToCopy={robot.name}
              variant="subtle"
              size="sm"
              aria-label={`Copy robot name "${robot.name}"`}
              tooltip="Copy robot name"
            />

            <IconButton
              onClick={handleDuplicate}
              variant="primary"
              aria-label={`Duplicate ${robot.name}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V4" />
              </svg>
            </IconButton>

            <IconButton
              onClick={handleDelete}
              variant="danger"
              aria-label={`Delete ${robot.name}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </IconButton>

            <Link
              to={`/generator/${robot.id}`}
              className="ml-2 px-3 py-1.5 bg-dark-bg border border-dark-border hover:border-brand-500 text-xs font-medium text-gray-300 hover:text-white rounded-md transition-all flex items-center"
              aria-label={`Edit ${robot.name}`}
            >
              Edit
            </Link>
          </div>
        </div>
      </div>
    </TiltCard>
  );
}, (prevProps, nextProps) => {
  return prevProps.robot.id === nextProps.robot.id &&
         prevProps.robot.updated_at === nextProps.robot.updated_at &&
         prevProps.processingId === nextProps.processingId &&
         prevProps.t === nextProps.t;
});

// Animated search input with cycling placeholder suggestions
interface AnimatedSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onDebouncedChange: (value: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const AnimatedSearchInput: React.FC<AnimatedSearchInputProps> = memo(({
  value,
  onChange,
  onDebouncedChange,
  t
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Cycling search suggestions for delightful UX
  const animatedPlaceholder = useAnimatedPlaceholder({
    suggestions: [
      t('dash_search_placeholder'),
      'EMA crossover...',
      'RSI strategy...',
      'Scalping bot...',
      'Trend following...'
    ],
    typingSpeed: 60,
    deleteSpeed: 35,
    pauseDuration: 1800
  });

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    onDebouncedChange(newValue);
  }, [onChange, onDebouncedChange]);

  // Clear search with smooth animation and focus management
  const handleClear = useCallback(() => {
    onChange('');
    onDebouncedChange('');
    // Focus back on input for seamless continued typing
    inputRef.current?.focus();
  }, [onChange, onDebouncedChange]);

  // Keyboard shortcut: Escape to clear search
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && value) {
      e.preventDefault();
      handleClear();
    }
  }, [value, handleClear]);

  const hasValue = value.length > 0;

  return (
    <div className="flex-1 relative group">
      {/* Search icon */}
      <svg 
        className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-brand-400" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        placeholder={value ? t('dash_search_placeholder') : animatedPlaceholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-full bg-dark-bg border border-dark-border rounded-lg pl-10 pr-10 py-2 text-white focus:ring-1 focus:ring-brand-500 outline-none placeholder-gray-600 transition-all"
        aria-label="Search trading robots"
        id="robot-search"
      />

      {/* Clear button - appears with smooth animation when there's text */}
      <button
        type="button"
        onClick={handleClear}
        className={`
          absolute right-2 top-1/2 -translate-y-1/2
          w-6 h-6 flex items-center justify-center
          rounded-full
          text-gray-500 hover:text-white hover:bg-gray-700
          transition-all duration-200 ease-out
          focus:outline-none focus:ring-2 focus:ring-brand-500/30
          ${hasValue ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'}
        `}
        aria-label={hasValue ? 'Clear search' : undefined}
        tabIndex={hasValue ? 0 : -1}
      >
        <svg 
          className="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M6 18L18 6M6 6l12 12" 
          />
        </svg>
      </button>
    </div>
  );
});

AnimatedSearchInput.displayName = 'AnimatedSearchInput';

interface DashboardProps {
    session?: UserSession | null;
}

export const Dashboard: React.FC<DashboardProps> = memo(({ session }) => {
  const { t } = useTranslation();
  
  // Log session for debugging (remove the warning about unused parameter)
  logger.debug('Dashboard session:', !!session);
    const [robots, setRobots] = useState<Robot[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    
    // Confirmation modal state
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        robotId: string;
        robotName: string;
    }>({ isOpen: false, robotId: '', robotName: '' });
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');

  // Debounced search for performance optimization
  const debouncedSetSearchTerm = useMemo(
    () => debounce((value: string) => setDebouncedSearchTerm(value), 300),
    []
  );

  const { showToast } = useToast();

  useEffect(() => {
    loadRobots();
  }, []);

  const loadRobots = async () => {
    try {
      const { data, error } = await db.getRobots();
      if (error) throw error;
      if (data) setRobots(data);
    } catch (err) {
      logger.error('Failed to load robots', err);
      showToast('Failed to load robots', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = useCallback((id: string, name: string) => {
    setConfirmModal({ isOpen: true, robotId: id, robotName: name });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const { robotId } = confirmModal;
    if (!robotId) return;

    setProcessingId(robotId);
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    
    try {
        const { error } = await db.deleteRobot(robotId);
        if (error) throw error;
        // Optimistic update
        setRobots(prev => prev.filter(r => r.id !== robotId));
        showToast(t('dash_toast_delete_success'), 'success');
    } catch (err) {
        logger.error("Failed to delete robot", err);
        showToast("Failed to delete robot", 'error');
    } finally {
        setProcessingId(null);
        setConfirmModal({ isOpen: false, robotId: '', robotName: '' });
    }
  }, [confirmModal, t, showToast]);

  const handleDeleteCancel = useCallback(() => {
    setConfirmModal({ isOpen: false, robotId: '', robotName: '' });
  }, []);

  const handleDuplicate = useCallback(async (id: string) => {
      setProcessingId(id);
      try {
          const { data, error } = await db.duplicateRobot(id);
          if (error) throw error;
          if (data && data[0]) {
              // Add new robot to list (top)
              setRobots(prev => [data[0], ...prev]);
              showToast(t('dash_toast_duplicate_success'), 'success');
          }
      } catch (err) {
          logger.error("Failed to duplicate robot", err);
          showToast("Failed to duplicate robot", 'error');
      } finally {
          setProcessingId(null);
      }
  }, [t, showToast]);

  // Determine if virtual scrolling should be used (for large lists)
  // Optimized threshold for better performance with medium-sized lists
  const shouldUseVirtualScroll = robots.length > 20;

   // Enhanced Filter Logic with optimized indexing and early termination
    const filteredRobots = useMemo(() => {
      const startTime = import.meta.env.DEV ? performance.now() : 0;
      
      // Use the performance optimizer to memoize this expensive operation
      const result = frontendPerformanceOptimizer.memoizeComponent(
        `filtered_robots_${debouncedSearchTerm}_${filterType}_${robots.length}`,
        () => {
          // Pre-calculate normalized debounced search term to avoid repeated operations
          const normalizedSearchTerm = debouncedSearchTerm.toLowerCase();
          
          // Early return if no filters needed
          if (normalizedSearchTerm === '' && filterType === 'All') {
            return robots;
          }
          
          // Optimized filtering with early termination
          return robots.filter(robot => {
            // Type filter first (faster comparison)
            if (filterType !== 'All' && (robot.strategy_type || 'Custom') !== filterType) {
              return false;
            }
            
            // Search filter last (more expensive)
            if (normalizedSearchTerm !== '') {
              const robotName = robot.name.toLowerCase();
              if (!robotName.includes(normalizedSearchTerm)) {
                return false;
              }
            }
            
            return true;
          });
        },
        5000 // 5 second TTL for this filter result
      );
      
      // Log performance in development
      if (import.meta.env.DEV && startTime) {
        const duration = performance.now() - startTime;
        if (duration > 10) { // Only log if filtering takes more than 10ms
          logger.debug(`Filtering ${robots.length} robots took ${duration.toFixed(2)}ms`);
        }
      }
      
      return result;
    }, [robots, debouncedSearchTerm, filterType]);

  // Derived list of unique strategy types for the dropdown - memoized
  const availableTypes = useMemo(() => 
    ['All', ...Array.from(new Set(robots.map(r => r.strategy_type || 'Custom')))], 
    [robots]
  );

  return (
<>
<AdvancedSEO 
          pageType="homepage"
          title="Dashboard - Trading Robots Management | QuantForge AI"
          description="Manage your MQL5 trading robots and Expert Advisors. View, edit, duplicate, and analyze your automated trading strategies with advanced AI-powered tools."
          keywords="trading robot dashboard, MQL5 management, Expert Advisor dashboard, automated trading portfolio, forex robot management, MT5 EA portfolio, trading algorithm dashboard, quantitative trading portfolio, AI trading management"
          canonicalUrl="https://quanforge.ai/"
          enableAnalytics={true}
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
              <AnimatedSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                onDebouncedChange={debouncedSetSearchTerm}
                t={t}
              />
              <div className="w-full md:w-48">
                  <label htmlFor="robot-filter" className="sr-only">{t('dash_filter_label')}</label>
                  <select 
                      id="robot-filter"
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-brand-500 outline-none"
                      aria-label={`Filter robots by strategy type: ${filterType}`}
                  >
                      {availableTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                      ))}
                  </select>
              </div>
          </div>
      )}

      {loading ? (
        <CardSkeletonLoader count={6} aria-label="Loading trading robots" />
      ) : robots.length === 0 ? (
        <EmptyState
          title={t('dash_empty_title')}
          description={t('dash_empty_desc')}
          actions={[
            {
              label: t('dash_empty_create_btn'),
              href: '/generator',
              variant: 'primary',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              )
            },
            {
              label: t('dash_empty_examples_btn'),
              href: '/wiki',
              variant: 'secondary'
            }
          ]}
          tips={[
            { icon: '📈', text: t('dash_empty_tip_1') },
            { icon: '💱', text: t('dash_empty_tip_2') },
            { icon: '🎯', text: t('dash_empty_tip_3') }
          ]}
        />
      ) : filteredRobots.length === 0 ? (
          <div className="bg-dark-surface border border-dark-border rounded-xl p-12 text-center">
              <h3 className="text-lg font-medium text-white mb-2">{t('dash_no_matches')}</h3>
              <p className="text-gray-400">Try adjusting your search or filters.</p>
              <button onClick={() => { setSearchTerm(''); setFilterType('All'); }} className="mt-4 text-brand-400 hover:underline">{t('dash_clear_filters')}</button>
          </div>
      ) : shouldUseVirtualScroll ? (
        <VirtualScrollList
          robots={robots}
          searchTerm={searchTerm}
          filterType={filterType}
          processingId={processingId}
          onDuplicate={handleDuplicate}
          onDelete={handleDeleteRequest}
          onClearFilters={() => { setSearchTerm(''); setFilterType('All'); }}
          t={t}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRobots.map((robot) => (
            <RobotCard
              key={robot.id}
              robot={robot}
              processingId={processingId}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteRequest}
              t={t}
            />
          ))}
        </div>
      )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={t('confirm_delete_title') || 'Delete Robot'}
        message={t('dash_delete_confirm', { name: confirmModal.robotName })}
        confirmLabel={t('confirm_delete') || 'Delete'}
        cancelLabel={t('confirm_cancel') || 'Cancel'}
        variant="danger"
        isLoading={processingId === confirmModal.robotId}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  );
});
