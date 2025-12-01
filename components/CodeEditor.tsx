
import React, { useEffect, useRef, useState } from 'react';

interface CodeEditorProps {
  code: string;
  readOnly?: boolean;
  filename?: string;
  onChange?: (newCode: string) => void;
  onRefine?: () => void;
  onExplain?: () => void; // New Prop
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, readOnly = false, filename = "ExpertAdvisor", onChange, onRefine, onExplain }) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Re-run highlighting when code changes or when switching back to view mode
  useEffect(() => {
    if (!isEditing && codeRef.current && (window as any).Prism) {
        // MQL5 is very similar to C++, so we use the cpp language definition
        (window as any).Prism.highlightElement(codeRef.current);
    }
  }, [code, isEditing]);

  // Sync scrolling between content and gutter
  const handleScroll = () => {
    if (contentRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = contentRef.current.scrollTop;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([code], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    
    // Sanitize filename
    const safeName = filename.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
    element.download = `${safeName}.mq5`;
    
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
  };

  // Generate line numbers
  const lines = code.split('\n');
  const lineNumbers = lines.map((_, i) => i + 1);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-300 font-mono text-sm relative">
      <div className="flex items-center justify-between px-4 py-2 bg-dark-surface border-b border-dark-border shrink-0 z-10">
        <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-500 font-sans uppercase tracking-wider">MQL5 Source</span>
            {!readOnly && onChange && (
                <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className={`text-xs px-2 py-0.5 rounded transition-colors border ${
                        isEditing 
                        ? 'bg-brand-500/20 text-brand-400 border-brand-500/50' 
                        : 'bg-dark-bg text-gray-400 border-dark-border hover:text-white'
                    }`}
                >
                    {isEditing ? 'Done Editing' : 'Edit Code'}
                </button>
            )}
            
            {!readOnly && onRefine && (
                 <button 
                    onClick={onRefine}
                    className="flex items-center space-x-1 px-2 py-0.5 bg-purple-900/30 text-purple-300 border border-purple-800 rounded hover:bg-purple-900/50 transition-colors text-xs"
                    title="Auto-optimize logic using AI"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <span>Auto-Refine</span>
                </button>
            )}

            {!readOnly && onExplain && (
                 <button 
                    onClick={onExplain}
                    className="flex items-center space-x-1 px-2 py-0.5 bg-blue-900/30 text-blue-300 border border-blue-800 rounded hover:bg-blue-900/50 transition-colors text-xs"
                    title="Explain this code in the chat"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                    <span>Explain</span>
                </button>
            )}
        </div>
        <div className="flex space-x-2">
            <button 
                onClick={handleCopy}
                className="flex items-center space-x-1 px-2 py-1 hover:bg-white/5 rounded text-xs transition-colors"
            >
                {copied ? <span className="text-green-500">Copied!</span> : <span>Copy</span>}
            </button>
            <button 
                onClick={handleDownload}
                className="flex items-center space-x-1 px-2 py-1 bg-brand-600/20 text-brand-400 hover:bg-brand-600/30 rounded text-xs transition-colors border border-brand-600/30"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span>Download .mq5</span>
            </button>
        </div>
      </div>
      
      {/* Editor Body */}
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* Line Numbers Gutter */}
        <div 
          ref={gutterRef}
          className="w-12 bg-[#0d1117] border-r border-[#30363d] text-right pr-3 pt-4 text-gray-600 select-none overflow-hidden"
          style={{ lineHeight: '1.625' }} // match tailwind leading-relaxed
        >
          {lineNumbers.map(n => (
            <div key={n} className="px-0">{n}</div>
          ))}
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
                  className="absolute top-0 left-0 w-full h-full min-h-full bg-transparent text-gray-300 p-4 pl-4 resize-none outline-none font-mono text-sm leading-relaxed whitespace-pre"
                  placeholder="// Start coding..."
              />
          ) : (
              <pre className="outline-none min-h-full language-cpp p-4 pl-4 !bg-transparent">
                <code ref={codeRef} className="language-cpp block leading-relaxed">
                  {code || '// Generated code will appear here...'}
                </code>
              </pre>
          )}
        </div>
      </div>
    </div>
  );
};
