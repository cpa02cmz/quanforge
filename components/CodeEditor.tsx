
import React, { useEffect, useRef, useState, useMemo, useCallback, useLayoutEffect } from 'react';
import { useTranslation } from '../services/i18n';
import { UI_TIMING } from '../constants';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface CodeEditorProps {
  code: string;
  readOnly?: boolean;
  filename?: string;
  onChange?: (newCode: string) => void;
  onRefine?: () => void;
  onExplain?: () => void; // New Prop
  /** Whether to enable focus mode (Zen Mode) by default */
  defaultFocusMode?: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  color: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = React.memo(({ code, readOnly = false, filename = "ExpertAdvisor", onChange, onRefine, onExplain, defaultFocusMode = false }) => {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [fontSize, setFontSize] = useState(14); // Default font size in px
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isFocusMode, setIsFocusMode] = useState(defaultFocusMode);
  const [showFocusModeHint, setShowFocusModeHint] = useState(false);
  const particleIdRef = useRef(0);
  const particleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusModeHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (particleTimeoutRef.current) {
        clearTimeout(particleTimeoutRef.current);
      }
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
      if (focusModeHintTimeoutRef.current) {
        clearTimeout(focusModeHintTimeoutRef.current);
      }
    };
  }, []);

  // Load focus mode preference from localStorage
  useEffect(() => {
    const savedFocusMode = localStorage.getItem('codeEditor_focusMode');
    if (savedFocusMode !== null) {
      setIsFocusMode(savedFocusMode === 'true');
    }
  }, []);

  // Save focus mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('codeEditor_focusMode', isFocusMode.toString());
  }, [isFocusMode]);

  // Toggle focus mode with keyboard shortcut (Ctrl/Cmd + Shift + F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle focus mode with Ctrl/Cmd + Shift + F
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        toggleFocusMode();
      }
      // Exit focus mode with Escape
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode]);

  const toggleFocusMode = useCallback(() => {
    setIsFocusMode(prev => {
      const newValue = !prev;
      // Show hint when entering focus mode
      if (newValue) {
        setShowFocusModeHint(true);
        focusModeHintTimeoutRef.current = setTimeout(() => {
          setShowFocusModeHint(false);
        }, 3000);
      }
      return newValue;
    });
  }, []);

  const contentRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);

  // Re-run highlighting when code changes or when switching back to view mode
  useLayoutEffect(() => {
    if (!isEditing && codeRef.current && (window as unknown as { Prism?: { highlightElement: (el: HTMLElement) => void } }).Prism) {
        // MQL5 is very similar to C++, so we use the cpp language definition
        // Use requestAnimationFrame to ensure highlighting happens after DOM updates
        requestAnimationFrame(() => {
          (window as unknown as { Prism?: { highlightElement: (el: HTMLElement) => void } }).Prism?.highlightElement(codeRef.current!);
        });
    }
  }, [code, isEditing]);

  // Sync scrolling between content and gutter with debouncing for performance
  const handleScroll = useCallback(() => {
    if (contentRef.current && gutterRef.current) {
      // Use requestAnimationFrame to prevent layout thrashing
      requestAnimationFrame(() => {
        if (contentRef.current && gutterRef.current) {
          gutterRef.current.scrollTop = contentRef.current.scrollTop;
        }
      });
    }
  }, []);

  // Generate particle burst effect for delightful copy feedback
  const triggerParticleBurst = useCallback((buttonElement: HTMLButtonElement) => {
    const rect = buttonElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Create 8 particles with different angles and colors
    const newParticles: Particle[] = Array.from({ length: 8 }, (_, i) => ({
      id: particleIdRef.current++,
      x: centerX,
      y: centerY,
      angle: (i * 45) + (Math.random() * 20 - 10), // 8 directions with slight randomness
      color: i % 2 === 0 ? '#22c55e' : '#4ade80', // Alternate between brand colors
    }));

    setParticles(newParticles);

    // Clear particles after animation completes
    particleTimeoutRef.current = setTimeout(() => {
      setParticles([]);
    }, 600);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);

    // Trigger particle burst for delightful feedback
    if (copyButtonRef.current) {
      triggerParticleBurst(copyButtonRef.current);
    }

    copiedTimeoutRef.current = setTimeout(() => setCopied(false), UI_TIMING.COPY_FEEDBACK_DURATION);
  }, [code, triggerParticleBurst]);

  const handleDownload = useCallback(() => {
    const element = document.createElement("a");
    const file = new Blob([code], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    
    // Sanitize filename
    const safeName = filename.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
    element.download = `${safeName}.mq5`;
    
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }, [code, filename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const value = e.currentTarget.value;
      
      // Insert 2 spaces
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      
      if (onChange) {
        onChange(newValue);
        // We need to restore the cursor position after the state update
        // Using setTimeout to ensure render cycle has processed the new value
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
          }
        }, 0);
      }
    }
    
    // Handle Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleDownload();
    }
    
    // Handle Ctrl/Cmd + / for comment toggle
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const value = e.currentTarget.value;
      const selectedText = value.substring(start, end);
      
      // Simple comment toggling for MQL5
      if (selectedText.trim().startsWith('//')) {
        // Remove comment
        const newValue = value.substring(0, start) + selectedText.replace(/\/\/\s?/g, '') + value.substring(end);
        if (onChange) onChange(newValue);
      } else {
        // Add comment
        const newValue = value.substring(0, start) + selectedText.replace(/^(.*)$/gm, '//$1') + value.substring(end);
        if (onChange) onChange(newValue);
      }
    }
  }, [onChange, handleDownload]);

  // Handle Ctrl/Cmd + Plus and Minus for font size adjustment with proper cleanup
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle when not focused on input elements
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && 
          !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          setFontSize(prev => Math.min(prev + 1, 24)); // Max font size 24px
        } else if (e.key === '-') {
          e.preventDefault();
          setFontSize(prev => Math.max(prev - 1, 10)); // Min font size 10px
        } else if (e.key === '0') {
          e.preventDefault();
          setFontSize(14); // Reset to default
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

 // Generate line numbers efficiently - optimized with proper dependency tracking
     const lineNumbers = useMemo(() => {
       // More efficient line counting without creating intermediate array
       const lineCount = (code.match(/\n/g) || []).length + 1;
       
       // Pre-allocate array with exact size for better performance
       const numbers = new Array(lineCount);
       for (let i = 0; i < lineCount; i++) {
         numbers[i] = i + 1;
       }
       return numbers;
     }, [code]); // Only recalculate when actual code content changes
     
// Calculate editor height based on content for auto-expanding textarea
      const editorHeight = useMemo(() => {
        if (!isEditing) return 'auto';
        
        // Calculate height based on number of lines with a minimum height
        // Use a more efficient approach to count lines
        let lineCount = 1;
        for (let i = 0; i < code.length; i++) {
          if (code[i] === '\n') lineCount++;
        }
        const lineHeight = fontSize * 1.625; // Use actual line height based on font size
        return `${Math.max(lineCount * lineHeight, 300)}px`;
      }, [code, isEditing, fontSize]);

  return (
    <div className={`flex flex-col h-full bg-[#0d1117] text-gray-300 font-mono text-sm relative transition-all duration-500 ${isFocusMode ? 'ring-2 ring-brand-500/30' : ''}`}>
      {/* Focus Mode Hint Toast */}
      {showFocusModeHint && (
        <div 
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-brand-600/90 text-white text-sm rounded-lg shadow-lg backdrop-blur-sm flex items-center gap-2 ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
          role="status"
          aria-live="polite"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Focus Mode activated. Press <kbd className="px-1 py-0.5 bg-white/20 rounded text-xs">Esc</kbd> to exit</span>
        </div>
      )}
      <div className={`flex items-center justify-between px-4 py-2 bg-dark-surface border-b border-dark-border shrink-0 z-10 transition-all duration-500 ${isFocusMode ? 'opacity-30 hover:opacity-100' : ''}`}>
        <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-500 font-sans uppercase tracking-wider">{t('editor_source')}</span>
            
            {/* Focus Mode Toggle Button */}
            <button
              onClick={toggleFocusMode}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs transition-all duration-200 border ${
                isFocusMode
                  ? 'bg-brand-500/20 text-brand-400 border-brand-500/50 shadow-lg shadow-brand-500/20'
                  : 'bg-dark-bg text-gray-400 border-dark-border hover:text-white hover:border-gray-500'
              }`}
              aria-label={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
              title={isFocusMode ? 'Exit Focus Mode (Esc)' : 'Enter Focus Mode (Ctrl+Shift+F)'}
              aria-pressed={isFocusMode}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {isFocusMode ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                )}
              </svg>
              <span>{isFocusMode ? 'Zen' : 'Focus'}</span>
            </button>
            {!readOnly && onChange && (
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`text-xs px-2 py-0.5 rounded transition-colors border ${
                        isEditing
                        ? 'bg-brand-500/20 text-brand-400 border-brand-500/50'
                        : 'bg-dark-bg text-gray-400 border-dark-border hover:text-white'
                    }`}
                    aria-label={isEditing ? t('editor_done') : t('editor_edit')}
                    title="Toggle Edit Mode"
                >
                    {isEditing ? t('editor_done') : t('editor_edit')}
                </button>
            )}

            {!readOnly && onRefine && (
                 <button
                    onClick={onRefine}
                    className="flex items-center space-x-1 px-2 py-0.5 bg-purple-900/30 text-purple-300 border border-purple-800 rounded hover:bg-purple-900/50 transition-colors text-xs"
                    aria-label={t('editor_refine')}
                    title="Auto-optimize logic using AI"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <span>{t('editor_refine')}</span>
                </button>
            )}

            {!readOnly && onExplain && (
                 <button
                    onClick={onExplain}
                    className="flex items-center space-x-1 px-2 py-0.5 bg-blue-900/30 text-blue-300 border border-blue-800 rounded hover:bg-blue-900/50 transition-colors text-xs"
                    aria-label={t('editor_explain')}
                    title="Explain this code in chat"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                    <span>{t('editor_explain')}</span>
                </button>
            )}
        </div>
        <div className="flex space-x-2">
            <div className="flex items-center space-x-2">
              {/* Font size controls */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setFontSize(prev => Math.max(prev - 1, 10))}
                  className="w-6 h-6 flex items-center justify-center bg-dark-bg text-gray-400 hover:text-white rounded text-xs"
                  aria-label="Decrease font size"
                  title="Decrease font size"
                >
                  -
                </button>
                <span className="text-xs w-8 text-center">{fontSize}px</span>
                <button
                  onClick={() => setFontSize(prev => Math.min(prev + 1, 24))}
                  className="w-6 h-6 flex items-center justify-center bg-dark-bg text-gray-400 hover:text-white rounded text-xs"
                  aria-label="Increase font size"
                  title="Increase font size"
                >
                  +
                </button>
              </div>

              {/* Word wrap toggle */}
              <button
                onClick={() => setWordWrap(!wordWrap)}
                className={`px-2 py-0.5 text-xs rounded border ${
                  wordWrap
                    ? 'bg-brand-500/20 text-brand-400 border-brand-500/50'
                    : 'bg-dark-bg text-gray-400 border-dark-border hover:text-white'
                }`}
                aria-label={`Word wrap ${wordWrap ? 'enabled' : 'disabled'}`}
                title="Toggle word wrap"
              >
                W
              </button>

              <button
                ref={copyButtonRef}
                onClick={handleCopy}
                className={`relative flex items-center space-x-1.5 px-2 py-1 rounded text-xs transition-all duration-200 ${
                  copied
                    ? 'bg-green-500/10 text-green-400 scale-105'
                    : 'hover:bg-white/5 text-gray-400 hover:text-gray-200'
                }`}
                aria-label={copied ? t('editor_copied') : t('editor_copy')}
                title="Copy code to clipboard (Ctrl+C)"
              >
                {/* Particle burst effect for delightful feedback */}
                {particles.map((particle) => (
                  <span
                    key={particle.id}
                    className="fixed pointer-events-none z-50"
                    style={{
                      left: particle.x,
                      top: particle.y,
                      width: '4px',
                      height: '4px',
                      backgroundColor: particle.color,
                      borderRadius: '50%',
                      animation: `particle-burst 0.6s ease-out forwards`,
                      transform: `rotate(${particle.angle}deg)`,
                    }}
                  />
                ))}

                {copied ? (
                  <>
                    <svg
                      className="w-3.5 h-3.5 animate-[scaleIn_0.2s_ease-out]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                        className="animate-[drawCheck_0.3s_ease-out_0.1s_both]"
                        style={{
                          strokeDasharray: 24,
                          strokeDashoffset: copied ? 0 : 24,
                          transition: 'stroke-dashoffset 0.3s ease-out 0.1s'
                        }}
                      />
                    </svg>
                    <span className="font-medium">{t('editor_copied')}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>{t('editor_copy')}</span>
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center space-x-1 px-2 py-1 bg-brand-600/20 text-brand-400 hover:bg-brand-600/30 rounded text-xs transition-colors border border-brand-600/30"
                aria-label={t('editor_download')}
                title="Download .mq5 file (Ctrl+S)"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span>{t('editor_download')}</span>
              </button>
            </div>
        </div>
      </div>
      
      {/* Editor Body */}
      <div className={`flex flex-1 relative overflow-hidden transition-all duration-500 ${isFocusMode ? 'bg-[#0a0c10]' : ''}`}>
        
         {/* Line Numbers Gutter */}
         <div 
           ref={gutterRef}
           className="w-12 bg-[#0d1117] border-r border-[#30363d] text-right pr-3 pt-4 text-gray-600 select-none overflow-hidden"
           style={{ 
             lineHeight: '1.625',
             fontSize: `${fontSize}px` // Dynamic font size for line numbers
           }}
         >
           <div style={{ height: `${lineNumbers.length * (fontSize * 1.625)}px` }}>
             {lineNumbers.map(n => (
               <div 
                 key={n} 
                 className="flex items-center justify-end px-0"
                 style={{ height: `${fontSize * 1.625}px` }}
               >
                 {n}
               </div>
             ))}
           </div>
         </div>

        {/* Content Area */}
        <div 
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto custom-scrollbar bg-[#0d1117] relative"
        >
          {isEditing ? (
              <textarea
                  ref={textareaRef}
                  value={code}
                  onChange={(e) => onChange && onChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.625',
                    whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                    wordWrap: wordWrap ? 'break-word' : 'normal',
                    minHeight: editorHeight
                  }}
                  className="absolute top-0 left-0 w-full bg-transparent text-gray-300 p-4 pl-4 resize-none outline-none font-mono leading-relaxed"
                  placeholder="// Start coding..."
              />
          ) : (
              <pre 
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.625',
                  whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                  wordWrap: wordWrap ? 'break-word' : 'normal',
                }}
                className="outline-none min-h-full language-cpp p-4 pl-4 !bg-transparent"
              >
                <code ref={codeRef} className="language-cpp block leading-relaxed">
                  {code || '// Generated code will appear here...'}
                </code>
              </pre>
          )}
        </div>
      </div>
      
      {/* Status bar */}
      <div className={`flex items-center justify-between px-4 py-1 bg-dark-surface border-t border-dark-border text-xs text-gray-500 shrink-0 transition-all duration-500 ${isFocusMode ? 'opacity-30 hover:opacity-100' : ''}`}>
        <div className="flex items-center space-x-4">
          <span className={`flex items-center gap-1 ${isFocusMode ? 'text-brand-400' : ''}`}>
            {isFocusMode && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {isEditing ? 'Editing' : isFocusMode ? 'Focus Mode' : 'Viewing'}
          </span>
          <span>{lineNumbers.length} lines</span>
          <span>{code.length} characters</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>Font: {fontSize}px</span>
          <span>Wrap: {wordWrap ? 'On' : 'Off'}</span>
          {isFocusMode && (
            <span className="text-brand-400 hidden sm:inline">
              Press <kbd className="px-1 py-0.5 bg-dark-bg rounded">Esc</kbd> to exit
            </span>
          )}
        </div>
      </div>
      
      {/* CSS Animations */}
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translate(-50%, -10px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
});
