
import React, { useState, useEffect, memo } from 'react';
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

export const StrategyConfig: React.FC<StrategyConfigProps> = memo(({ params, onChange, onApply, isApplying = false, onReset }) => {
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
     </div>
   );
 });
