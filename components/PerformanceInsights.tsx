import React, { useState, useEffect } from 'react';
import { frontendPerformanceOptimizer } from '../services/frontendPerformanceOptimizer';
import { performanceMonitor } from '../utils/performance';
import { UI_TIMING, PERFORMANCE_SCORE_THRESHOLDS } from '../constants';

interface PerformanceInsightsProps {
  showInsights?: boolean;
}

const PerformanceInsights: React.FC<PerformanceInsightsProps> = ({ showInsights = false }) => {
  const [isVisible, setIsVisible] = useState(showInsights);
  const [metrics, setMetrics] = useState(frontendPerformanceOptimizer.getMetrics());
  const [perfMetrics, setPerfMetrics] = useState(performanceMonitor.getWebVitals());
  const [optimizationScore, setOptimizationScore] = useState(frontendPerformanceOptimizer.getOptimizationScore());
  
  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        setMetrics(frontendPerformanceOptimizer.getMetrics());
        setPerfMetrics(performanceMonitor.getWebVitals());
        setOptimizationScore(frontendPerformanceOptimizer.getOptimizationScore());
      }, UI_TIMING.PERFORMANCE_INSIGHTS_INTERVAL);
      
      return () => clearInterval(interval);
    }
    // Return undefined when condition is not met
    return () => {};
  }, [isVisible]);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const getScoreColor = (score: number): string => {
    if (score >= PERFORMANCE_SCORE_THRESHOLDS.EXCELLENT) return 'text-green-400';
    if (score >= PERFORMANCE_SCORE_THRESHOLDS.GOOD) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= PERFORMANCE_SCORE_THRESHOLDS.EXCELLENT) return 'Excellent';
    if (score >= PERFORMANCE_SCORE_THRESHOLDS.GOOD) return 'Good';
    return 'Needs Improvement';
  };

  if (!isVisible) {
    return (
      <button
        onClick={toggleVisibility}
        className="fixed bottom-4 right-4 bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-full shadow-lg z-50"
        aria-label="Show Performance Insights"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="p-4 border-b border-dark-border flex justify-between items-center">
        <h3 className="text-white font-medium">Performance Insights</h3>
        <button 
          onClick={toggleVisibility}
          className="text-gray-400 hover:text-white"
          aria-label="Close Performance Insights"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="p-4 max-h-96 overflow-y-auto">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-400 text-sm">Optimization Score</span>
            <span className={`font-bold ${getScoreColor(optimizationScore)}`}>
              {Math.round(optimizationScore)}%
            </span>
          </div>
          <div className="w-full bg-dark-bg rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                optimizationScore >= PERFORMANCE_SCORE_THRESHOLDS.EXCELLENT ? 'bg-green-500' : 
                optimizationScore >= PERFORMANCE_SCORE_THRESHOLDS.GOOD ? 'bg-yellow-500' : 'bg-red-500'
              }`} 
              style={{ width: `${Math.min(100, optimizationScore)}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {getScoreLabel(optimizationScore)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-dark-bg p-2 rounded">
            <div className="text-gray-500 text-xs">Load Time</div>
            <div className="text-white font-mono">
              {perfMetrics.lcp ? `${perfMetrics.lcp.toFixed(0)}ms` : 'N/A'}
            </div>
          </div>
          <div className="bg-dark-bg p-2 rounded">
            <div className="text-gray-500 text-xs">Cache Hit Rate</div>
            <div className="text-white font-mono">
              {metrics.cacheHitRate ? `${metrics.cacheHitRate.toFixed(1)}%` : '0%'}
            </div>
          </div>
          <div className="bg-dark-bg p-2 rounded">
            <div className="text-gray-500 text-xs">Memory</div>
            <div className="text-white font-mono">
              {metrics.memoryUsage ? `${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB` : 'N/A'}
            </div>
          </div>
          <div className="bg-dark-bg p-2 rounded">
            <div className="text-gray-500 text-xs">VR Scroll</div>
            <div className="text-white font-mono">
              {metrics.virtualScrollEfficiency ? `${metrics.virtualScrollEfficiency.toFixed(1)}%` : '0%'}
            </div>
          </div>
        </div>

        <div className="mb-3">
          <h4 className="text-gray-400 text-sm mb-2">Optimization Features</h4>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${frontendPerformanceOptimizer.getMetrics().cacheHitRate > 0 ? 'bg-green-500' : 'bg-gray-600'}`}></span>
              <span>Resource Caching</span>
            </li>
            <li className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${frontendPerformanceOptimizer.getMetrics().virtualScrollEfficiency > 0 ? 'bg-green-500' : 'bg-gray-600'}`}></span>
              <span>Virtual Scrolling</span>
            </li>
            <li className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${frontendPerformanceOptimizer.getMetrics().preconnectHitRate > 0 ? 'bg-green-500' : 'bg-gray-600'}`}></span>
              <span>Preconnect Optimization</span>
            </li>
            <li className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${frontendPerformanceOptimizer.getMetrics().renderOptimizationScore > 0 ? 'bg-green-500' : 'bg-gray-600'}`}></span>
              <span>Render Optimization</span>
            </li>
          </ul>
        </div>

        <button
          onClick={() => {
            frontendPerformanceOptimizer.warmUp();
            performanceMonitor.trackBundlePerformance();
          }}
          className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white rounded text-sm font-medium transition-colors"
        >
          Warm Up Optimizer
        </button>
      </div>
    </div>
  );
};

export default PerformanceInsights;