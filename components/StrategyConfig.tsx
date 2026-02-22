
import React, { useState, useEffect, memo, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { StrategyParams, CustomInput } from '../types';
import { TIMEFRAMES } from '../constants';
import { MarketTicker } from './MarketTicker';
import { useToast } from './useToast';
import { NumericInput } from './NumericInput';
import { useTranslation } from '../services/i18n';
import { createScopedLogger } from '../utils/logger';
import { announceFormValidation } from '../utils/announcer';
import { FormField } from './FormField';
import { CustomInputRow } from './CustomInputRow';

const logger = createScopedLogger('StrategyConfig');

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
  const [errors, setErrors] = useState<Partial<Record<keyof StrategyParams, string>>>({});

  const validateField = (field: keyof StrategyParams, value: unknown): string | undefined => {
    const stringValue = typeof value === 'string' ? value : String(value);
    switch (field) {
      case 'symbol':
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          return 'Symbol is required';
        }
        if (!/^[A-Z]{3,6}[A-Z]?[A-Z]?$/.test(value.trim().toUpperCase())) {
          return 'Invalid symbol format (e.g., BTCUSDT)';
        }
        break;
      case 'riskPercent': {
        const risk = parseFloat(stringValue);
        if (isNaN(risk) || risk <= 0) {
          return 'Risk percent must be greater than 0';
        }
        if (risk > 100) {
          return 'Risk percent cannot exceed 100%';
        }
        break;
      }
      case 'stopLoss': {
        const sl = parseFloat(stringValue);
        if (isNaN(sl) || sl <= 0) {
          return 'Stop loss must be positive';
        }
        break;
      }
      case 'takeProfit': {
        const tp = parseFloat(stringValue);
        if (isNaN(tp) || tp <= 0) {
          return 'Take profit must be positive';
        }
        const slValue = typeof params.stopLoss === 'number' ? params.stopLoss : parseFloat(params.stopLoss || '0');
        if (slValue > 0 && tp <= slValue) {
          return 'Take profit must be greater than stop loss';
        }
        break;
      }
      case 'magicNumber': {
        const magic = parseInt(stringValue);
        if (isNaN(magic) || magic <= 0) {
          return 'Magic number must be a positive integer';
        }
        if (magic > 2147483647) {
          return 'Magic number exceeds maximum value';
        }
        break;
      }
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof StrategyParams, string>> = {};
    const fields: (keyof StrategyParams)[] = ['symbol', 'riskPercent', 'stopLoss', 'takeProfit', 'magicNumber'];
    
    fields.forEach(field => {
      const error = validateField(field, params[field]);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    
    // Announce validation errors to screen readers for accessibility (WCAG 4.1.3)
    const errorMessages = Object.values(newErrors).filter(Boolean);
    if (errorMessages.length > 0) {
      announceFormValidation(errorMessages, 'Strategy Configuration');
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const handleChangeWithValidation = useCallback((field: keyof StrategyParams, value: unknown) => {
    const error = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: error || undefined
    }));
    handleChange(field, value);
  }, [params, onChange]);

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

  const handleChange = useCallback((field: keyof StrategyParams, value: unknown) => {
     const sanitizedValue = typeof value === 'string' ? sanitizeInput(value) : value;
     onChange({ ...params, [field]: sanitizedValue });
   }, [params, onChange]);

  const handleInputChange = useCallback((id: string, field: keyof CustomInput, value: string) => {
    const newInputs = params.customInputs.map(input => 
      input.id === id ? { ...input, [field]: value } : input
    );
    onChange({ ...params, customInputs: newInputs });
  }, [params.customInputs, onChange]);

  const handleInputTypeChange = useCallback((id: string, newType: CustomInput['type']) => {
      let defaultValue = '0';
      if (newType === 'bool') defaultValue = 'false';
      if (newType === 'string') defaultValue = '';
      
      const newInputs = params.customInputs.map(input => 
        input.id === id ? { ...input, type: newType, value: defaultValue } : input
      );
      onChange({ ...params, customInputs: newInputs });
  }, [params.customInputs, onChange]);

  const addInput = useCallback(() => {
    const newInput: CustomInput = {
      id: Date.now().toString(),
      name: 'New_Param',
      type: 'int',
      value: '0'
    };
    onChange({ ...params, customInputs: [...params.customInputs, newInput] });
  }, [params.customInputs, onChange]);

  const removeInput = useCallback((id: string) => {
    onChange({ ...params, customInputs: params.customInputs.filter(i => i.id !== id) });
  }, [params.customInputs, onChange]);

  const copyConfig = useCallback(() => {
      const configStr = JSON.stringify(params, null, 2);
      navigator.clipboard.writeText(configStr).then(() => {
          showToast('Configuration copied to clipboard', 'success');
      }).catch(err => {
          logger.error("Copy failed", err);
          showToast("Failed to copy to clipboard", "error");
      });
  }, [params, showToast]);

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
    } catch (e: unknown) {
        logger.error(e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        showToast(`Import Failed: ${errorMessage}`, 'error');
    }
  };

  const importConfig = async () => {
      try {
          const text = await navigator.clipboard.readText();
          parseAndImport(text);
      } catch (e: unknown) {
          logger.warn("Clipboard read failed, switching to manual mode", e);
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
                    aria-label={t('config_reset')}
                >
                    {t('config_reset')}
                </button>
            )}
            <button
                onClick={importConfig}
                className="text-xs text-gray-500 hover:text-white transition-colors"
                aria-label={t('config_import_clipboard')}
            >
                {t('config_import_clipboard')}
            </button>
            <button
                onClick={copyConfig}
                className="text-xs text-gray-500 hover:text-white transition-colors"
                aria-label={t('config_copy')}
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

       {/* Main Config Form */}
       <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* General Settings */}
          <div className="bg-dark-bg rounded-xl border border-dark-border p-4">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6H2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
              {t('config_general')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label={t('config_symbol')}
                error={errors.symbol}
                hint="Trading pair symbol (e.g., BTCUSDT, EURUSD)"
                required
                htmlFor="config-symbol"
              >
                <input
                  id="config-symbol"
                  type="text"
                  value={params.symbol}
                  onChange={(e) => handleChangeWithValidation('symbol', e.target.value)}
                  className={`w-full bg-dark-surface border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 outline-none transition-colors ${
                    errors.symbol ? 'border-red-500 focus:ring-red-500' : 'border-dark-border focus:ring-brand-500'
                  }`}
                  placeholder="BTCUSDT"
                  aria-invalid={!!errors.symbol}
                  aria-describedby={errors.symbol ? 'config-symbol-error' : 'config-symbol-hint'}
                />
              </FormField>
              <FormField
                label={t('config_timeframe')}
                htmlFor="config-timeframe"
                required
              >
                <select
                  id="config-timeframe"
                  value={params.timeframe}
                  onChange={(e) => handleChange('timeframe', e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 outline-none"
                >
                  {TIMEFRAMES.map(tf => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
              </FormField>
              <FormField
                label={t('config_risk')}
                error={errors.riskPercent}
                hint="Percentage of account balance to risk per trade (1-100)"
                required
                htmlFor="config-risk"
              >
                <NumericInput
                  id="config-risk"
                  value={params.riskPercent}
                  onChange={(val) => handleChangeWithValidation('riskPercent', val)}
                  step={0.1}
                  min={0.1}
                  max={100}
                  className={`w-full bg-dark-surface border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 outline-none transition-colors ${
                    errors.riskPercent ? 'border-red-500 focus:ring-red-500' : 'border-dark-border focus:ring-brand-500'
                  }`}
                  aria-invalid={!!errors.riskPercent}
                  aria-describedby={errors.riskPercent ? 'config-risk-error' : 'config-risk-hint'}
                />
              </FormField>
              <FormField
                label={t('config_magic')}
                error={errors.magicNumber}
                hint="Unique identifier for Expert Advisor"
                required
                htmlFor="config-magic"
              >
                <NumericInput
                  id="config-magic"
                  value={params.magicNumber}
                  onChange={(val) => handleChangeWithValidation('magicNumber', val)}
                  className={`w-full bg-dark-surface border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 outline-none transition-colors ${
                    errors.magicNumber ? 'border-red-500 focus:ring-red-500' : 'border-dark-border focus:ring-brand-500'
                  }`}
                  aria-invalid={!!errors.magicNumber}
                  aria-describedby={errors.magicNumber ? 'config-magic-error' : 'config-magic-hint'}
                />
              </FormField>
            </div>
          </div>

          {/* Trade Logic Settings */}
          <div className="bg-dark-bg rounded-xl border border-dark-border p-4">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              {t('config_logic')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label={t('config_sl')}
                error={errors.stopLoss}
                hint="Distance in pips to close losing trade"
                required
                htmlFor="config-sl"
              >
                <NumericInput
                  id="config-sl"
                  value={params.stopLoss}
                  onChange={(val) => handleChangeWithValidation('stopLoss', val)}
                  className={`w-full bg-dark-surface border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 outline-none transition-colors ${
                    errors.stopLoss ? 'border-red-500 focus:ring-red-500' : 'border-dark-border focus:ring-brand-500'
                  }`}
                  aria-invalid={!!errors.stopLoss}
                  aria-describedby={errors.stopLoss ? 'config-sl-error' : 'config-sl-hint'}
                />
              </FormField>
              <FormField
                label={t('config_tp')}
                error={errors.takeProfit}
                hint="Distance in pips to close profitable trade"
                required
                htmlFor="config-tp"
              >
                <NumericInput
                  id="config-tp"
                  value={params.takeProfit}
                  onChange={(val) => handleChangeWithValidation('takeProfit', val)}
                  className={`w-full bg-dark-surface border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 outline-none transition-colors ${
                    errors.takeProfit ? 'border-red-500 focus:ring-red-500' : 'border-dark-border focus:ring-brand-500'
                  }`}
                  aria-invalid={!!errors.takeProfit}
                  aria-describedby={errors.takeProfit ? 'config-tp-error' : 'config-tp-hint'}
                />
              </FormField>
            </div>
          </div>

         {/* Custom Inputs */}
         <div className="bg-dark-bg rounded-xl border border-dark-border p-4">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-bold text-white flex items-center gap-2">
               <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
               {t('config_custom_inputs')}
             </h3>
              <button
                onClick={addInput}
                className="text-xs bg-brand-600 hover:bg-brand-500 text-white px-2 py-1 rounded flex items-center gap-1"
                aria-label={t('config_add_input')}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                {t('config_add_input')}
              </button>
           </div>
           
           <div className="space-y-3">
              {params.customInputs.map((input, index) => (
                <CustomInputRow
                  key={input.id}
                  input={input}
                  inputTypes={[
                    { value: 'int', label: 'int' },
                    { value: 'double', label: 'double' },
                    { value: 'bool', label: 'bool' },
                    { value: 'string', label: 'string' }
                  ]}
                  onNameChange={(id, value) => handleInputChange(id, 'name', value)}
                  onTypeChange={handleInputTypeChange}
                  onValueChange={(id, value) => handleInputChange(id, 'value', value)}
                  onDelete={removeInput}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === params.customInputs.length - 1}
                />
              ))}
            </div>
         </div>

          {/* Apply Button */}
          {onApply && (
            <div className="pt-4">
              <button
                onClick={() => {
                  if (validateForm()) {
                    onApply();
                  } else {
                    showToast('Please fix validation errors', 'error');
                  }
                }}
                disabled={isApplying}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 disabled:opacity-50 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
               {isApplying ? (
                 <>
                   <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   {t('config_applying')}
                 </>
               ) : (
                 <>
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                   {t('config_apply_btn')}
                 </>
               )}
             </button>
           </div>
         )}
       </div>

        {/* Market Ticker */}
        <div className="p-4 border-t border-dark-border bg-dark-surface">
          <MarketTicker symbol={params.symbol} />
        </div>
      </div>
    );
  });

StrategyConfig.displayName = 'StrategyConfig';
