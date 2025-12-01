
import React, { useEffect, useState, useRef } from 'react';
import { marketService, MarketData } from '../services/marketData';
import { useTranslation } from '../services/i18n';

interface MarketTickerProps {
  symbol: string;
}

export const MarketTicker: React.FC<MarketTickerProps> = ({ symbol }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<MarketData | null>(null);
  const prevBidRef = useRef<number>(0);
  const [direction, setDirection] = useState<'up' | 'down' | 'neutral'>('neutral');

  useEffect(() => {
    // Reset data when symbol changes
    setData(null);
    
    const handleUpdate = (newData: MarketData) => {
      if (prevBidRef.current !== 0 && newData.bid !== 0) {
        if (newData.bid > prevBidRef.current) setDirection('up');
        else if (newData.bid < prevBidRef.current) setDirection('down');
      }
      if (newData.bid !== 0) prevBidRef.current = newData.bid;
      setData(newData);
    };

    marketService.subscribe(symbol, handleUpdate);

    const timeout = setTimeout(() => setDirection('neutral'), 800);

    return () => {
      marketService.unsubscribe(symbol, handleUpdate);
      clearTimeout(timeout);
    };
  }, [symbol]);

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

  return (
    <div className={`mt-2 p-3 rounded-lg border transition-colors duration-300 ${bgColor} border-dark-border`}>
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
};
