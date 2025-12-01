
import React, { useState, useEffect } from 'react';
import { StrategyParams, CustomInput } from '../types';
import { TIMEFRAMES } from '../constants';
import { MarketTicker } from './MarketTicker';
import { useToast } from './Toast';
import { NumericInput } from './NumericInput';
import { useTranslation } from '../services/i18n';

interface StrategyConfigProps {
  params: StrategyParams;
  onChange: (params: StrategyParams) => void;
  onApply?: () => void;
  isApplying?: boolean;
  onReset?: () => void;
}

export const StrategyConfig: React.FC<StrategyConfigProps> = ({ params, onChange, onApply, isApplying = false, onReset }) => {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [showManualImport, setShowManualImport] = useState(false);
  const [manualImportText, setManualImportText] = useState('');

  // Default to BTCUSDT if empty or generic
  useEffect(() => {
      if (params.symbol === '_Symbol' || params.symbol === '') {
          onChange({ ...params, symbol: 'BTCUSDT' });
      }
  }, []);

  const handleChange = (field: keyof StrategyParams, value: any) => {
     onChange({ ...params, [field]: value });
  };

  const handleInputChange = (id: string, field: keyof CustomInput, value: string) => {
    const newInputs = params.customInputs.map(input => 
      input.id === id ? { ...input, [field]: value } : input
    );
    onChange({ ...params, customInputs: newInputs });
  };

  const handleInputTypeChange = (id: string, newType: CustomInput['type']) => {
      let defaultValue = '0';
      if (newType === 'bool') defaultValue = 'false';
      if (newType === 'string') defaultValue = '';
      
      const newInputs = params.customInputs.map(input => 
        input.id === id ? { ...input, type: newType, value: defaultValue } : input
      );
      onChange({ ...params, customInputs: newInputs });
  };

  const addInput = () => {
    const newInput: CustomInput = {
      id: Date.now().toString(),
      name: 'New_Param',
      type: 'int',
      value: '0'
    };
    onChange({ ...params, customInputs: [...params.customInputs, newInput] });
  };

  const removeInput = (id: string) => {
    onChange({ ...params, customInputs: params.customInputs.filter(i => i.id !== id) });
  };

  const copyConfig = () => {
      const configStr = JSON.stringify(params, null, 2);
      navigator.clipboard.writeText(configStr).then(() => {
          showToast('Configuration copied to clipboard', 'success');
      }).catch(err => {
          console.error("Copy failed", err);
          showToast("Failed to copy to clipboard", "error");
      });
  };

  const parseAndImport = (text: string) => {
    try {
        if (!text) throw new Error("Input is empty");
        const parsed = JSON.parse(text);
        
        // Strict Validation
        if (!parsed || typeof parsed !== 'object') {
            throw new Error("Invalid format: Not a JSON object");
        }
        if (!parsed.timeframe || typeof parsed.timeframe !== 'string') {
             throw new Error("Missing or invalid 'timeframe'");
        }
        if (typeof parsed.riskPercent !== 'number') {
             throw new Error("Missing or invalid 'riskPercent'");
        }
        if (parsed.customInputs && !Array.isArray(parsed.customInputs)) {
            throw new Error("'customInputs' must be an array");
        }

        onChange({ 
            ...params, 
            ...parsed,
            customInputs: Array.isArray(parsed.customInputs) ? parsed.customInputs : params.customInputs
        });
        showToast('Configuration imported successfully', 'success');
        setShowManualImport(false);
        setManualImportText('');
    } catch (e: any) {
        console.error(e);
        showToast(`Import Failed: ${e.message}`, 'error');
    }
  };

  const importConfig = async () => {
      try {
          const text = await navigator.clipboard.readText();
          parseAndImport(text);
      } catch (e: any) {
          console.warn("Clipboard read failed, switching to manual mode", e);
          setShowManualImport(true);
          showToast('Clipboard blocked. Please paste manually below.', 'info');
      }
  };

  return (
    <div className="flex flex-col h-full bg-dark-surface border-r border-dark-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border shrink-0 bg-dark-surface">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            {t('config_title')}
        </h2>
        <div className="flex gap-2">
            {onReset && (
                <button 
                    onClick={onReset}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                    title={t('config_reset')}
                >
                    {t('config_reset')}
                </button>
            )}
            <button 
                onClick={importConfig}
                className="text-xs text-gray-500 hover:text-white transition-colors"
                title={t('config_import_clipboard')}
            >
                {t('config_import_clipboard')}
            </button>
            <button 
                onClick={copyConfig}
                className="text-xs text-gray-500 hover:text-white transition-colors"
                title={t('config_copy')}
            >
                {t('config_copy')}
            </button>
        </div>
      </div>

      {/* Manual Import Fallback Area */}
      {showManualImport && (
          <div className="p-4 bg-dark-bg border-b border-dark-border animate-fade-in">
              <label className="block text-xs text-gray-400 mb-2">Paste JSON Configuration:</label>
              <textarea 
                  value={manualImportText}
                  onChange={(e) => setManualImportText(e.target.value)}
                  className="w-full h-24 bg-dark-surface border border-dark-border rounded-lg p-2 text-xs font-mono text-gray-300 focus:border-brand-500 outline-none mb-2"
                  placeholder='{"timeframe": "H1", ...}'
              />
              <div className="flex justify-end gap-2">
                  <button 
                      onClick={() => setShowManualImport(false)}
                      className="text-xs text-gray-500 hover:text-white px-3 py-1"
                  >
                      Cancel
                  </button>
                  <button 
                      onClick={() => parseAndImport(manualImportText)}
                      className="text-xs bg-brand-600 hover:bg-brand-500 text-white px-3 py-1 rounded"
                  >
                      Import
                  </button>
              </div>
          </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        
        {/* Main Settings */}
        <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('config_general')}</h3>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('config_timeframe')}</label>
                    <select 
                        value={params.timeframe}
                        onChange={(e) => handleChange('timeframe', e.target.value)}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none"
                    >
                        {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('config_symbol')}</label>
                    <input 
                        type="text" 
                        value={params.symbol}
                        onChange={(e) => handleChange('symbol', e.target.value)}
                        list="common-symbols"
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none font-mono uppercase"
                    />
                    <datalist id="common-symbols">
                        <option value="BTCUSDT" />
                        <option value="ETHUSDT" />
                        <option value="SOLUSDT" />
                        <option value="XAUUSD" />
                        <option value="EUR/USD" />
                        <option value="GBP/USD" />
                    </datalist>
                </div>
            </div>

            {/* Market Ticker Integration */}
            <MarketTicker symbol={params.symbol} />

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('config_risk')}</label>
                    <NumericInput 
                        value={params.riskPercent}
                        onChange={(val) => handleChange('riskPercent', val)}
                        step="0.1"
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none font-mono"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('config_magic')}</label>
                    <NumericInput 
                        value={params.magicNumber}
                        onChange={(val) => handleChange('magicNumber', val)}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none font-mono"
                    />
                </div>
            </div>
        </div>

        {/* Trade Logic */}
        <div className="space-y-4 pt-4 border-t border-dark-border">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('config_logic')}</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('config_sl')}</label>
                    <NumericInput 
                        value={params.stopLoss}
                        onChange={(val) => handleChange('stopLoss', val)}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none font-mono"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('config_tp')}</label>
                    <NumericInput 
                        value={params.takeProfit}
                        onChange={(val) => handleChange('takeProfit', val)}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none font-mono"
                    />
                </div>
            </div>
        </div>

        {/* Custom Inputs */}
        <div className="space-y-4 pt-4 border-t border-dark-border">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('config_custom_inputs')}</h3>
                <button 
                    onClick={addInput}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    {t('config_add_input')}
                </button>
            </div>

            {params.customInputs.length === 0 && (
                <p className="text-xs text-gray-500 italic">No custom inputs defined.</p>
            )}

            <div className="space-y-3">
                {params.customInputs.map((input) => (
                    <div key={input.id} className="bg-dark-bg p-3 rounded-lg border border-dark-border group relative">
                        <button 
                            onClick={() => removeInput(input.id)}
                            className="absolute top-2 right-2 text-gray-600 hover:text-red-400 transition-colors"
                        >
                             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <input 
                                type="text"
                                value={input.name}
                                onChange={(e) => handleInputChange(input.id, 'name', e.target.value)}
                                placeholder="Variable Name"
                                className="bg-transparent border-b border-gray-700 text-sm text-white focus:border-brand-500 outline-none py-1 placeholder-gray-600 font-mono"
                            />
                            <select
                                value={input.type}
                                onChange={(e) => handleInputTypeChange(input.id, e.target.value as any)}
                                className="bg-transparent border-b border-gray-700 text-xs text-gray-400 focus:border-brand-500 outline-none py-1"
                            >
                                <option value="int">int</option>
                                <option value="double">double</option>
                                <option value="string">string</option>
                                <option value="bool">bool</option>
                            </select>
                        </div>
                        
                        {input.type === 'bool' ? (
                            <div className="flex items-center space-x-2 mt-2">
                                <label className="text-xs text-gray-500">Value:</label>
                                <input 
                                    type="checkbox"
                                    checked={input.value === 'true'}
                                    onChange={(e) => handleInputChange(input.id, 'value', e.target.checked ? 'true' : 'false')}
                                    className="accent-brand-500"
                                />
                                <span className="text-xs text-gray-300 font-mono">{input.value}</span>
                            </div>
                        ) : (
                            <div className="mt-1">
                                <label className="text-[10px] text-gray-500 block mb-1">Value</label>
                                <input 
                                    type={input.type === 'string' ? 'text' : 'number'}
                                    step={input.type === 'double' ? '0.01' : '1'}
                                    value={input.value}
                                    onChange={(e) => handleInputChange(input.id, 'value', e.target.value)}
                                    className="w-full bg-dark-surface rounded px-2 py-1 text-xs text-white border border-transparent focus:border-brand-500 outline-none font-mono"
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Footer Actions */}
      {onApply && (
          <div className="p-4 border-t border-dark-border bg-dark-surface">
            <button 
                onClick={onApply}
                disabled={isApplying}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all shadow-lg shadow-brand-600/20 flex items-center justify-center space-x-2"
            >
                {isApplying ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>{t('config_applying')}</span>
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        <span>{t('config_apply_btn')}</span>
                    </>
                )}
            </button>
          </div>
      )}
    </div>
  );
};
