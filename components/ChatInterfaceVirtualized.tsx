import React, { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { Message, MessageRole } from '../types';
import { loadSuggestedStrategies } from '../constants';
import { useTranslation } from '../services/i18n';
import { componentOptimizer } from '../services/componentOptimizer';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  onClear?: () => void;
  onStop?: () => void;
  onTrimMessages?: () => void;
}

// Virtualized Message component
const VirtualizedMessage = memo(({ 
  msg, 
  formatMessageContent,
  style // For virtualization positioning
}: { 
  msg: Message, 
  formatMessageContent: (c: string) => any,
  style: React.CSSProperties
}) => {
  return (
    <div style={style} className="w-full">
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
          <div className="whitespace-pre-wrap">
            {formatMessageContent(msg.content)}
          </div>
          <div className="text-xs opacity-60 mt-1">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
});

const ChatInterfaceVirtualized: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading, 
  onClear, 
  onStop,
  onTrimMessages
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [suggestedStrategies, setSuggestedStrategies] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const optimizedCallback = componentOptimizer.createOptimizedCallback;
  const optimizedMemo = (factory: () => any, deps: React.DependencyList) => {
    return useMemo(factory, deps);
  };
  
  // Load suggested strategies
  useEffect(() => {
    loadSuggestedStrategies('en').then(strategies => {
      setSuggestedStrategies(strategies.slice(0, 5)); // Get first 5 strategies
    });
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  }, [inputValue, isLoading, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isLoading) {
        handleSubmit(e as any);
      }
    }
  }, [inputValue, isLoading, handleSubmit]);

  // Virtualization parameters
  const ITEM_HEIGHT = 120; // Approximate height of each message
  const CONTAINER_HEIGHT = 400; // Height of visible area
  const paddingTop = 0;
  const visibleStart = 0; // In a real implementation, calculate based on scroll position
  const visibleEnd = Math.min(
    Math.ceil(CONTAINER_HEIGHT / ITEM_HEIGHT) + 10, // +10 for buffer
    messages.length
  );
  
  const visibleMessages = optimizedMemo(() => 
    messages.slice(visibleStart, visibleEnd), 
    [messages, visibleStart, visibleEnd]
  );

  // Calculate total height for scroll container
  const totalHeight = messages.length * ITEM_HEIGHT;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-surface">
        <h2 className="font-semibold text-white">{t('chat_title')}</h2>
        <div className="flex space-x-2">
          {onClear && (
            <button
              onClick={onClear}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-dark-border text-gray-300 rounded hover:bg-dark-bg disabled:opacity-50"
              title={t('chat_clear')}
            >
              {t('chat_clear')}
            </button>
          )}
          {onTrimMessages && messages.length > 30 && (
            <button
              onClick={onTrimMessages}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-dark-border text-gray-300 rounded hover:bg-dark-bg disabled:opacity-50"
              title="Trim History"
            >
              Trim
            </button>
          )}
          {onStop && isLoading && (
            <button
              onClick={onStop}
              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              {t('chat_stop')}
            </button>
          )}
        </div>
      </div>

      {/* Messages Container with Virtualization */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 bg-dark-bg/30 relative"
        style={{ height: `${Math.min(CONTAINER_HEIGHT, window.innerHeight * 0.4)}px` }}
      >
        {/* This would be replaced with real virtualization in production */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleMessages.map((msg: Message, index: number) => (
            <VirtualizedMessage
              key={msg.id}
              msg={msg}
              style={{
                position: 'absolute',
                top: (visibleStart + index) * ITEM_HEIGHT,
                left: 0,
                right: 0,
                height: ITEM_HEIGHT,
              }}
              formatMessageContent={(content) => {
                // Simple markdown-like formatting for code blocks
                if (content.includes('```')) {
                  const parts = content.split(/(```[\s\S]*?```)/g);
                  return parts.map((part, i) => {
                    if (part.startsWith('```')) {
                      const code = part.slice(3, -3).trim();
                      return (
                        <pre key={i} className="my-2 p-2 bg-dark-bg/50 rounded text-xs overflow-x-auto">
                          <code>{code}</code>
                        </pre>
                      );
                    }
                    return part;
                  });
                }
                return content;
              }}
            />
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Strategies (only show if no messages) */}
      {messages.length === 0 && suggestedStrategies.length > 0 && (
        <div className="px-4 py-3 border-t border-dark-border bg-dark-surface">
          <p className="text-xs text-gray-400 mb-2">{t('chat_welcome_desc')}</p>
          <div className="grid grid-cols-1 gap-2">
            {suggestedStrategies.map((strategy, i) => (
              <button
                key={i}
                onClick={() => setInputValue(strategy)}
                className="text-left text-xs bg-dark-bg/50 hover:bg-dark-bg p-2 rounded border border-dark-border text-gray-300"
              >
                {strategy}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-dark-border bg-dark-surface">
        <div className="flex space-x-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat_placeholder')}
            disabled={isLoading}
            className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-transparent resize-none"
            rows={2}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('loading')}
              </span>
            ) : (
              'Send'
            )}
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {t('chat_placeholder')} (Press Enter to send, Shift+Enter for new line)
        </div>
      </form>
    </div>
  );
};

export { ChatInterfaceVirtualized };