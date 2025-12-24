import { useCallback, useRef } from 'react';
import { Message, MessageRole } from '../../types';
import { createScopedLogger } from '../../utils/logger';
import { loadGeminiService } from '../../services/aiServiceLoader';
import { ValidationService } from '../../utils/validation';

const logger = createScopedLogger('useAIMessageHandling');

interface UseAIMessageHandlingProps {
  processAIResponse: (response: { content: string; thinking?: string }) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setLoadingProgress: (progress: { step: string; message: string } | null) => void;
  addMessage: (message: Message) => void;
  code: string;
  strategyParams: any;
  messages: Message[];
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const useAIMessageHandling = ({
  processAIResponse,
  setLoading,
  setLoadingProgress,
  addMessage,
  code,
  strategyParams,
  messages,
  showToast,
}: UseAIMessageHandlingProps) => {
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      showToast("Generation stopped by user", "info");
    }
  }, [setLoading, showToast]);

  const handleSendMessage = useCallback(async (content: string) => {
    // Validate input
    const validationResult = ValidationService.validateChatMessage(content);
    if (!validationResult.isValid) {
      showToast(ValidationService.formatErrors(validationResult.errors), 'error');
      return;
    }

    // Sanitize input
    const sanitizedContent = ValidationService.sanitizeInput(content);
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: sanitizedContent,
      timestamp: Date.now(),
    };
    
    addMessage(newMessage);
    const updatedMessages = [...messages, newMessage];
    setLoading(true);
    setLoadingProgress({ step: 'generating', message: 'Generating MQL5 code...' });

    try {
      const { generateMQL5Code } = await loadGeminiService();
      const response = await generateMQL5Code(content, code, strategyParams, updatedMessages, signal);
      setLoadingProgress({ step: 'processing', message: 'Processing response...' });
      await processAIResponse(response);
     } catch (error: unknown) {
       if (error instanceof Error && error.name === 'AbortError') return;
       
       logger.error(error);
       const errorMessage = error instanceof Error ? error.message : "Error generating response";
       showToast(errorMessage, 'error');
       addMessage({
           id: Date.now().toString(),
           role: MessageRole.MODEL,
           content: "Sorry, I encountered an error generating the response.",
           timestamp: Date.now()
       });
     } finally {
      if (!signal.aborted) {
        setLoading(false);
        setLoadingProgress(null);
      }
      abortControllerRef.current = null;
    }
  }, [code, strategyParams, messages, processAIResponse, setLoading, setLoadingProgress, addMessage, showToast]);

  return {
    handleSendMessage,
    stopGeneration,
  };
};