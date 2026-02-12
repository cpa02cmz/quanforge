
import React, { useEffect, useState, useRef, memo } from 'react';
import { marketData as marketService, MarketData } from '../services';
import { useTranslation } from '../services/i18n';
import { UI_TIMING } from '../constants';

interface MarketTickerProps {
  symbol: string;
}

/**
 * MarketTicker - Enhanced market data display with micro-UX price flash effects
 *
 * Features:
 * - Price flash animation when bid price changes (green for up, red for down)
 * - Smooth color transitions with CSS animations
 * - Reduced motion support for accessibility
 * - Visual feedback makes market data feel more responsive and professional
 * - Flash intensity gradually fades for satisfying micro-interaction
 */
export const MarketTicker: React.FC<MarketTickerProps> = memo(({ symbol }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<MarketData | null>(null);
  const prevBidRef = useRef<number>(0);
  const [direction, setDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [flashIntensity, setFlashIntensity] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    // Reset data when symbol changes
    setData(null);
    setFlashIntensity(0);

    const handleUpdate = (newData: MarketData) => {
      if (prevBidRef.current !== 0 && newData.bid !== 0) {
        if (newData.bid > prevBidRef.current) {
          setDirection('up');
          // Trigger flash effect (unless reduced motion is preferred)
          if (!prefersReducedMotion) {
            setFlashIntensity(1);
          }
        } else if (newData.bid < prevBidRef.current) {
          setDirection('down');
          // Trigger flash effect (unless reduced motion is preferred)
          if (!prefersReducedMotion) {
            setFlashIntensity(1);
          }
        }
      }
      if (newData.bid !== 0) prevBidRef.current = newData.bid;
      setData(newData);
    };

    marketService.subscribe(symbol, handleUpdate);

    const timeout = setTimeout(() => setDirection('neutral'), UI_TIMING.DIRECTION_INDICATOR_DURATION);

    return () => {
      marketService.unsubscribe(symbol, handleUpdate);
      clearTimeout(timeout);
    };
  }, [symbol, prefersReducedMotion]);

  // Flash fade-out effect
  useEffect(() => {
    if (flashIntensity <= 0) return;

    const fadeInterval = setInterval(() => {
      setFlashIntensity(prev => {
        const next = prev - 0.1;
        return next <= 0 ? 0 : next;
      });
    }, 50); // Update every 50ms for smooth fade (500ms total fade duration)

    return () => clearInterval(fadeInterval);
  }, [flashIntensity]);

  // Loading / Connecting State
  if (!data || data.status === 'connecting') {
      return (
          <div className="mt-2 p-3 bg-dark-bg/50 border border-dark-border/50 rounded-lg h-[72px] flex items-center justify-center">
               <div className="flex items-center space-x-2">
                   <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                   <span className="text-xs text-gray-500 font-mono">{t('mt_connecting')}</span>
               </div>
          </div>
      );
  }

  // Error / Disconnected State (Zero data after timeout or error status)
  if (data.status === 'error' || (data.status === 'connected' && data.bid === 0)) {
       return (
          <div className="mt-2 p-3 bg-red-900/10 border border-red-500/20 rounded-lg h-[72px] flex items-center justify-center">
               <div className="flex items-center space-x-2">
                   <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                   <span className="text-xs text-red-400 font-mono">{t('mt_unavailable')}</span>
               </div>
          </div>
      );
  }

  const textColor = direction === 'up' ? 'text-green-500' : direction === 'down' ? 'text-red-500' : 'text-white';
  const bgColor = direction === 'up' ? 'bg-green-500/10' : direction === 'down' ? 'bg-red-500/10' : 'bg-transparent';

  // Calculate flash color and opacity based on direction and intensity
  const getFlashColor = () => {
    if (flashIntensity <= 0) return 'transparent';
    const opacity = flashIntensity * 0.3; // Max 30% opacity
    return direction === 'up'
      ? `rgba(34, 197, 94, ${opacity})` // Green flash
      : `rgba(239, 68, 68, ${opacity})`; // Red flash
  };

  return (
    <div
      className={`mt-2 p-3 rounded-lg border transition-colors duration-300 ${bgColor} border-dark-border relative overflow-hidden`}
      style={{
        // Apply flash effect as box-shadow for a subtle glow
        boxShadow: flashIntensity > 0
          ? `inset 0 0 ${20 * flashIntensity}px ${getFlashColor()}`
          : undefined,
        transition: 'box-shadow 0.05s ease-out'
      }}
    >
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
             <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('mt_live')}</span>
        </div>
        <span className="text-xs text-gray-500 font-mono">{new Date(data.timestamp).toLocaleTimeString()}</span>
      </div>
      
      <div className="flex items-end justify-between font-mono">
        <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase">{t('mt_bid')}</span>
            <span className={`text-lg font-bold transition-colors duration-300 ${textColor}`}>
                {data.bid.toFixed(data.digits)}
            </span>
        </div>
        
        <div className="flex flex-col items-center px-2">
            <span className="text-[10px] text-gray-500 uppercase">{t('mt_spread')}</span>
            <span className="text-xs text-gray-300 bg-dark-bg px-1.5 py-0.5 rounded border border-dark-border">
                {data.spread} pts
            </span>
        </div>

        <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-500 uppercase">{t('mt_ask')}</span>
            <span className="text-sm font-medium text-gray-300">
                {data.ask.toFixed(data.digits)}
            </span>
        </div>
      </div>
    </div>
  );
});

MarketTicker.displayName = 'MarketTicker';

export default MarketTicker;
