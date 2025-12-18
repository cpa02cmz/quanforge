
import React, { Suspense, useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Message, MessageRole } from '../types';
import { useTranslation } from '../services/i18n';
import { loadSuggestedStrategies } from '../constants';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('ChatInterface');

// Loading fallback component
const ChatInterfaceLoading = () => (
  <div className="flex items-center justify-center h-64 bg-dark-bg border border-dark-border rounded-2xl">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto mb-3"></div>
      <p className="text-gray-400 text-sm">Loading chat interface...</p>
    </div>
  </div>
);

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  onClear?: () => void;
  onStop?: () => void; // New Prop
}

// Extract and memoize Message component to prevent re-renders of the whole list on input change
const MemoizedMessage = memo(({ msg, formatMessageContent }: { msg: Message, formatMessageContent: (_content: string) => React.ReactNode }) => {
    return (
        <div className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md ${
                    msg.role === MessageRole.USER
                    ? 'bg-brand-600 text-white rounded-br-none'
                    : 'bg-dark-bg border border-dark-border text-gray-200 rounded-bl-none'
                }`}
                role="article"
                aria-label={`${msg.role === MessageRole.USER ? 'User' : 'AI'} message`}
            >
                {/* Thinking Process Visualization */}
                {msg.thinking && (
                    <details className="mb-3 group">
                        <summary className="cursor-pointer text-xs text-brand-400 flex items-center gap-1 opacity-80 hover:opacity-100 select-none">
                            <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                            <span>Reasoning Process</span>
                        </summary>
                        <div className="mt-2 p-3 bg-black/20 border-l-2 border-brand-500/30 text-xs text-gray-400 font-mono italic leading-relaxed whitespace-pre-wrap">
                            {msg.thinking}
                        </div>
                    </details>
                )}

                <div className="leading-relaxed">
                    {formatMessageContent(msg.content)}
                </div>
            </div>
        </div>
    );
});

MemoizedMessage.displayName = 'MemoizedMessage';

export const ChatInterface: React.FC<ChatInterfaceProps> = React.memo(({ messages, onSendMessage, isLoading, onClear, onStop }) => {
  const { t, language } = useTranslation();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const memoryMonitorRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  

  // Enhanced memory management with proper cleanup and memory leak prevention
  useEffect(() => {
    // Create new abort controller for this effect
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    // Unified memory monitoring with adaptive intervals
    const startMemoryMonitoring = () => {
      if (memoryMonitorRef.current || signal.aborted) return; // Already monitoring or aborted
      
      // Adaptive monitoring frequency based on message count
      const interval = messages.length > 100 ? 5000 : 10000; // 5s for large, 10s for normal
      
      memoryMonitorRef.current = setInterval(() => {
        if (signal.aborted) return;
        
        try {
          if (typeof window !== 'undefined' && 'memory' in performance) {
            const memoryUsage = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
            if (memoryUsage) {
              const usedMB = Math.round(memoryUsage.usedJSHeapSize / 1024 / 1024);
              const limitMB = Math.round(memoryUsage.jsHeapSizeLimit / 1024 / 1024);
              const usagePercent = (usedMB / limitMB) * 100;
              
              if (usagePercent > 85) {
                logger.warn(`High memory usage: ${usedMB}MB (${usagePercent.toFixed(1)}%).`);
                
                // Auto-cleanup if memory is critically high
                if (usagePercent > 95 && onClear && !signal.aborted) {
                  logger.error(`Emergency cleanup triggered: ${usagePercent.toFixed(1)}%`);
                  onClear();
                }
              }
            }
          }
        } catch (error) {
          logger.error('Memory monitoring error:', error);
        }
      }, interval);
    };
    
    // Start monitoring for conversations with more than 30 messages
    if (messages.length > 30 && !signal.aborted) {
      startMemoryMonitoring();
    }
    
    // Cleanup function with unified memory management
    return () => {
      // Abort any ongoing operations
      if (abortControllerRef.current && !signal.aborted) {
        abortControllerRef.current.abort();
      }
      
      // Clear memory monitoring
      if (memoryMonitorRef.current) {
        clearInterval(memoryMonitorRef.current);
        memoryMonitorRef.current = null;
      }
      
      // Clear any pending cleanup timeouts
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
      
      // Clear references
      abortControllerRef.current = null;
    };
  }, [messages.length, onClear]);

  // Optimized scroll to bottom with requestAnimationFrame
  const scrollToBottom = useCallback(() => {
    if (abortControllerRef.current?.signal.aborted) return;
    
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    if (!abortControllerRef.current?.signal.aborted) {
      scrollToBottom();
    }
  }, [messages, isLoading, scrollToBottom]);

  const sanitizeInput = (input: string): string => {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const sanitizedInput = sanitizeInput(input);
    onSendMessage(sanitizedInput);
    setInput('');
  };

  const handleSuggestionClick = (prompt: string) => {
      onSendMessage(prompt);
  };

  // Pre-compiled regex patterns for performance
  const boldRegex = useMemo(() => /(\*\*.*?\*\*)/g, []);
  const codeRegex = useMemo(() => /(`.*?`)/g, []);
  const listRegex = useMemo(() => /^[-*]\s/, []);

  // Enhanced helper to parse **bold** and `code` with memory optimization
  const parseInlineStyles = useCallback((text: string) => {
    // Limit text length to prevent memory issues
    const maxLength = 1000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    
    // We split by bold markers first using pre-compiled regex
    const boldParts = truncatedText.split(boldRegex);
    
    return boldParts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`bold-${i}`} className="text-brand-300 font-bold">{part.slice(2, -2)}</strong>;
      }
      
      // Then split by code markers using pre-compiled regex
      const codeParts = part.split(codeRegex);
      return codeParts.map((subPart, j) => {
        if (subPart.startsWith('`') && subPart.endsWith('`')) {
          return (
            <code key={`code-${i}-${j}`} className="bg-dark-bg border border-dark-border px-1 py-0.5 rounded text-xs font-mono text-brand-400">
              {subPart.slice(1, -1)}
            </code>
          );
        }
        return <span key={`text-${i}-${j}`}>{subPart}</span>;
      });
    });
  }, [boldRegex, codeRegex]);

  // Enhanced Markdown Formatter with memory optimization
  // Memoized to prevent unnecessary re-renders
  const formatMessageContent = useCallback((content: string): React.ReactElement[] => {
    if (!content) return [];
    
    // Limit content length to prevent memory issues
    const maxLength = 5000;
    const truncatedContent = content.length > maxLength 
      ? content.substring(0, maxLength) + '...' 
      : content;
    
    const lines = truncatedContent.split('\n');
    const elements: React.ReactElement[] = [];
    
    // Optimize by using forEach with better memory management
    lines.forEach((line, i) => {
      if (!line) return;
      
      const trimmedLine = line.trim();
      
      // Handle Lists
      if (listRegex.test(trimmedLine)) {
        const listContent = trimmedLine.substring(2);
        elements.push(
          <div key={`line-${i}`} className="flex items-start ml-2 mb-1">
            <span className="mr-2 text-brand-500">•</span>
            <span>{parseInlineStyles(listContent)}</span>
          </div>
        );
      }
      // Standard Paragraph (with empty line handling)
      else if (trimmedLine === '') {
        elements.push(<div key={`empty-${i}`} className="h-2" />);
      }
      else {
        elements.push(<div key={`para-${i}`} className="mb-1">{parseInlineStyles(line)}</div>);
      }
    });
    
    return elements;
  }, [listRegex, parseInlineStyles]);

  // Get strategies based on current language
  const [suggestedStrategies, setSuggestedStrategies] = useState<Array<{ label: string; prompt: string }>>([]);

  useEffect(() => {
    loadSuggestedStrategies(language).then((strategies: any) => {
      setSuggestedStrategies(strategies[language] || strategies.en || []);
    }).catch((err: any) => {
      logger.error('Failed to load suggested strategies:', err);
      setSuggestedStrategies([]);
    });
  }, [language]);

// Optimized virtual scrolling with stable windowing and enhanced memory management
   const visibleMessages = useMemo(() => {
     const VIEWPORT_SIZE = 20;
     const BUFFER_SIZE = 10;
     const MAX_MESSAGES = 100;
     const WINDOW_SIZE = VIEWPORT_SIZE + (BUFFER_SIZE * 2);
     
     // Early return for small conversations
     if (messages.length <= WINDOW_SIZE) {
       return messages;
     }
     
     // Use sliding window for large conversations - prioritize recent messages
     const totalMessages = Math.min(messages.length, MAX_MESSAGES);
     const startIndex = Math.max(0, totalMessages - WINDOW_SIZE);
     
     return messages.slice(startIndex, startIndex + WINDOW_SIZE);
   }, [messages]);

   // Generate stable keys for virtual scrolling
   const getMessageKey = useCallback((msg: Message, index: number) => {
     return `${msg.id}-${index}`;
   }, []);

// Memory pressure event listener for cleanup coordination
   useEffect(() => {
     const handleMemoryPressure = () => {
       if (messages.length > 50) {
         logger.info(`Memory pressure detected: ${messages.length} messages, consider clearing chat`);
       }
     };

     // Check if memory pressure event is supported
     if ('memory' in performance) {
       window.addEventListener('memory-pressure', handleMemoryPressure);
     }
     
     return () => {
       if ('memory' in performance) {
         window.removeEventListener('memory-pressure', handleMemoryPressure);
       }
     };
   }, [messages.length]);

  return (
    <Suspense fallback={<ChatInterfaceLoading />}>
      <div className="flex flex-col h-full bg-dark-surface border-r border-dark-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-surface shrink-0">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            {t('chat_title')}
          </h2>
          {messages.length > 0 && onClear && (
            <button 
                onClick={onClear}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
                title="Clear Chat History"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                {t('chat_clear')}
            </button>
          )}
      </div>

      {/* Messages Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6" role="status" aria-live="polite">
                <div className="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center mb-6 text-brand-500 opacity-80">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">{t('chat_welcome_title')}</h3>
                <p className="text-gray-400 text-sm mb-8 max-w-xs">
                    {t('chat_welcome_desc')}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-md">
                    {suggestedStrategies.map((strategy) => (
                        <button
                            key={strategy.label}
                            onClick={() => handleSuggestionClick(strategy.prompt)}
                            disabled={isLoading}
                            className="text-left px-4 py-3 bg-dark-bg border border-dark-border hover:border-brand-500/50 hover:bg-dark-border/50 rounded-xl transition-all text-sm group"
                        >
                            <span className="block font-medium text-gray-200 group-hover:text-brand-400 transition-colors mb-1">
                                {strategy.label}
                            </span>
                            <span className="block text-xs text-gray-500 line-clamp-2">
                                {strategy.prompt}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        )}
        {visibleMessages.map((msg, index) => (
            <MemoizedMessage key={getMessageKey(msg, index)} msg={msg} formatMessageContent={formatMessageContent} />
        ))}
        {isLoading && (
          <div className="flex justify-start items-center gap-2" role="status" aria-label="AI is typing">
            <div className="bg-dark-bg border border-dark-border rounded-2xl rounded-bl-none px-4 py-3 flex items-center space-x-2" aria-hidden="true">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            {onStop && (
                <button 
                    onClick={onStop}
                    className="p-2 rounded-full bg-dark-bg border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    title={t('chat_stop')}
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
                </button>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-dark-border bg-dark-surface">
        <form onSubmit={handleSubmit} className="relative">
          <label htmlFor="chat-input" className="sr-only">{t('chat_placeholder')}</label>
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chat_placeholder')}
            className="w-full bg-dark-bg border border-dark-border rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all placeholder-gray-500 shadow-inner"
            disabled={isLoading}
            aria-describedby={isLoading ? 'typing-indicator' : undefined}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-1.5 bg-brand-600 rounded-lg text-white hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-600/20"
            aria-label="Send message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </form>
      </div>
    </div>
    </Suspense>
  );
});
