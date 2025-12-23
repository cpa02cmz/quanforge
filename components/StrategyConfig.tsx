import React, { useState, useEffect, memo, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { StrategyParams } from '../types';
import { useToast } from '../hooks/useToast';

interface StrategyConfigProps {
  params: StrategyParams;
  onChange: (_params: StrategyParams) => void;
  onApply?: () => void;
  isApplying?: boolean;
  onReset?: () => void;
}

export const StrategyConfig: React.FC<StrategyConfigProps> = memo(({ 
  params, 
  onChange, 
  onApply, 
  isApplying = false, 
  onReset 
}) => {
  const { showToast } = useToast();
  const [showManualImport, setShowManualImport] = useState(false);
  const [manualImportText, setManualImportText] = useState('');

  // Default to BTCUSDT if empty or generic
  useEffect(() => {
    if (params.symbol === '_Symbol' || params.symbol === '') {
      onChange({ ...params, symbol: 'BTCUSDT' });
    }
  }, []);

  const sanitizeInput = (input: string): string => {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  };

  const handleChange = useCallback((field: keyof StrategyParams, value: string | number | boolean) => {
    if (typeof value === 'string') {
      value = sanitizeInput(value);
    }
    onChange({ ...params, [field]: value });
  }, [params, onChange]);

  const handleApply = useCallback(() => {
    if (onApply) {
      onApply();
    }
    showToast('Strategy applied successfully', 'success');
  }, [onApply, showToast]);

  const handleReset = useCallback(() => {
    if (onReset) {
      onReset();
    }
    showToast('Strategy reset to defaults', 'info');
  }, [onReset, showToast]);

  return (
    <div className="bg-dark-surface rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold text-white mb-6">Strategy Configuration</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Symbol Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Symbol
          </label>
          <input
            type="text"
            value={params.symbol || 'BTCUSDT'}
            onChange={(e) => handleChange('symbol', e.target.value)}
            className="w-full px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:ring-brand-500 focus:border-brand-500"
            placeholder="BTCUSDT"
          />
        </div>

        {/* Timeframe Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Timeframe
          </label>
          <select
            value={params.timeframe || 'H1'}
            onChange={(e) => handleChange('timeframe', e.target.value)}
            className="w-full px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:ring-brand-500 focus:border-brand-500"
          >
            <option value="M1">1 Minute</option>
            <option value="M5">5 Minutes</option>
            <option value="M15">15 Minutes</option>
            <option value="M30">30 Minutes</option>
            <option value="H1">1 Hour</option>
            <option value="H4">4 Hours</option>
            <option value="D1">Daily</option>
          </select>
        </div>

        {/* Risk Management */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Stop Loss (%)
          </label>
          <input
            type="number"
            value={params.stopLoss || ''}
            onChange={(e) => handleChange('stopLoss', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:ring-brand-500 focus:border-brand-500"
            placeholder="2.0"
            min="0"
            max="10"
            step="0.1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Take Profit (%)
          </label>
          <input
            type="number"
            value={params.takeProfit || ''}
            onChange={(e) => handleChange('takeProfit', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:ring-brand-500 focus:border-brand-500"
            placeholder="5.0"
            min="0"
            max="50"
            step="0.1"
          />
        </div>

        {/* Strategy Settings */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Risk Per Trade (%)
          </label>
          <input
            type="number"
            value={params.riskPercent || ''}
            onChange={(e) => handleChange('riskPercent', parseFloat(e.target.value) || 1)}
            className="w-full px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:ring-brand-500 focus:border-brand-500"
            placeholder="1.0"
            min="0.1"
            max="10"
            step="0.1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Magic Number
          </label>
          <input
            type="number"
            value={params.magicNumber || ''}
            onChange={(e) => handleChange('magicNumber', parseInt(e.target.value) || 12345)}
            className="w-full px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:ring-brand-500 focus:border-brand-500"
            placeholder="12345"
            min="1"
            max="999999"
            step="1"
          />
        </div>

        {/* Custom Inputs Section */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Custom Inputs
          </label>
          <p className="text-xs text-gray-400 mb-3">
            Use the Manual Import to configure custom inputs for your strategy.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={handleApply}
          disabled={isApplying}
          className="px-6 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isApplying ? 'Applying...' : 'Apply Strategy'}
        </button>
        
        <button
          onClick={handleReset}
          className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Reset to Defaults
        </button>

        <button
          onClick={() => setShowManualImport(!showManualImport)}
          className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          {showManualImport ? 'Hide' : 'Import'} Parameters
        </button>
      </div>

      {/* Manual Import */}
      {showManualImport && (
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Import Parameters (JSON)
          </label>
          <textarea
            value={manualImportText}
            onChange={(e) => setManualImportText(e.target.value)}
            className="w-full px-3 py-2 bg-dark-bg border border-gray-600 rounded-md text-white focus:ring-brand-500 focus:border-brand-500 font-mono text-sm"
            rows={6}
            placeholder='{"symbol": "BTCUSDT", "timeframe": "H1", ...}'
          />
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => {
                try {
                  const importedParams = JSON.parse(manualImportText);
                  onChange({ ...params, ...importedParams });
                  showToast('Parameters imported successfully', 'success');
                  setShowManualImport(false);
                  setManualImportText('');
                } catch (_error) {
                  showToast('Invalid JSON format', 'error');
                }
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Import
            </button>
            <button
              onClick={() => {
                setManualImportText(JSON.stringify(params, null, 2));
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Export Current
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

StrategyConfig.displayName = 'StrategyConfig';

export default StrategyConfig;