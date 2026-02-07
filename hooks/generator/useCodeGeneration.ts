import { useCallback, useRef } from 'react';
import { Message, MessageRole } from '../../types';
import { createScopedLogger } from '../../utils/logger';
import { loadGeminiService } from '../../services/aiServiceLoader';
import { ValidationService } from '../../utils/validation';

const logger = createScopedLogger('useCodeGeneration');

interface UseCodeGenerationProps {
  code: string;
  strategyParams: any;
  messages: Message[];
  processAIResponse: (response: { content: string; thinking?: string }) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setLoadingProgress: (progress: { step: string; message: string } | null) => void;
  addMessage: (message: Message) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const useCodeGeneration = ({
  code,
  strategyParams,
  messages,
  processAIResponse,
  setLoading,
  setLoadingProgress,
  addMessage,
  showToast,
}: UseCodeGenerationProps) => {
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleApplySettings = useCallback(async () => {
    // Validate strategy parameters before applying
    const validationResult = ValidationService.validateStrategyParams(strategyParams);
    if (!ValidationService.isValid(validationResult)) {
      validationResult.forEach((error) => showToast(error.message, 'error'));
      return;
    }
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setLoadingProgress({ step: 'applying-settings', message: 'Applying configuration changes...' });
    try {
      const { generateMQL5Code } = await loadGeminiService();
      const prompt = "Update the code to strictly follow the provided configuration constraints (Timeframe, Risk, Stop Loss, Take Profit, Custom Inputs). Keep the existing strategy logic but ensure inputs are consistent with the config.";
      const response = await generateMQL5Code(prompt, code, strategyParams, messages, signal);
      setLoadingProgress({ step: 'processing', message: 'Processing updated code...' });
      await processAIResponse(response);
      showToast("Settings applied & code updated", 'success');
       } catch (error: unknown) {
           if (error instanceof Error && error.name === 'AbortError') return;
           logger.error("Failed to apply settings:", error);
           showToast("Failed to apply settings", 'error');
       } finally {
       if (!signal.aborted) {
         setLoading(false);
         setLoadingProgress(null);
       }
       abortControllerRef.current = null;
    }
  }, [code, strategyParams, messages, processAIResponse, setLoading, setLoadingProgress, showToast]);

  const handleRefineCode = useCallback(async () => {
    if (!code) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setLoadingProgress({ step: 'refining', message: 'Refining code...' });
    try {
      const { refineCode } = await loadGeminiService();
      const response = await refineCode(code, signal);
      setLoadingProgress({ step: 'processing', message: 'Processing refined code...' });
      await processAIResponse(response);
      
      addMessage({
          id: Date.now().toString(),
          role: MessageRole.SYSTEM,
          content: "Auto-Refinement completed. Code optimized for efficiency and robustness.",
          timestamp: Date.now()
      });

      showToast("Code optimized & refined", 'success');
   } catch (error: unknown) {
       if (error instanceof Error && error.name === 'AbortError') return;
       logger.error("Refinement failed:", error);
       showToast("Refinement failed", 'error');
   } finally {
      if (!signal.aborted) {
        setLoading(false);
        setLoadingProgress(null);
      }
      abortControllerRef.current = null;
    }
  }, [code, processAIResponse, setLoading, setLoadingProgress, addMessage, showToast]);

  const handleExplainCode = useCallback(async () => {
    if (!code) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setLoading(true);
    setLoadingProgress({ step: 'explaining', message: 'Generating code explanation...' });
    try {
      const { explainCode } = await loadGeminiService();
      const response = await explainCode(code, signal);
      
      // Inject explanation into chat
      addMessage({
          id: Date.now().toString(),
          role: MessageRole.MODEL,
          content: response.content || "Could not generate explanation.",
          thinking: response.thinking || null,
          timestamp: Date.now()
      });
      
      showToast("Code explanation generated", 'success');
   } catch (error: unknown) {
       if (error instanceof Error && error.name === 'AbortError') return;
       logger.error("Explanation failed:", error);
       showToast("Explanation failed", 'error');
   } finally {
      if (!signal.aborted) {
        setLoading(false);
        setLoadingProgress(null);
      }
      abortControllerRef.current = null;
    }
  }, [code, setLoading, setLoadingProgress, addMessage, showToast]);

  return {
    handleApplySettings,
    handleRefineCode,
    handleExplainCode,
  };
};