import React, { memo } from 'react';
import { useTranslation } from '../services/i18n';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = memo(({ isOpen, onClose }) => {
  const { t } = useTranslation();

  // Use modern userAgentData API with fallback to userAgent string (navigator.platform is deprecated)
  const isMac = React.useMemo(() => {
    // Check for modern userAgentData API (high entropy values)
    if (typeof navigator !== 'undefined' && 'userAgentData' in navigator) {
      const uaData = (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData;
      if (uaData?.platform) {
        return uaData.platform.toUpperCase().includes('MAC');
      }
    }
    // Fallback to userAgent string parsing
    return /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
  }, []);

  const shortcuts = [
    {
      keys: isMac ? ['Cmd', 'S'] : ['Ctrl', 'S'],
      description: t('kb_save_strategy'),
      context: 'Generator'
    },
    {
      keys: isMac ? ['Cmd', 'Enter'] : ['Ctrl', 'Enter'],
      description: t('kb_send_chat'),
      context: 'Chat'
    },
    {
      keys: ['Escape'],
      description: t('kb_stop_generation'),
      context: 'Chat'
    },
    {
      keys: ['Tab'],
      description: t('kb_next_field'),
      context: 'Forms'
    },
    {
      keys: ['Shift', 'Tab'],
      description: t('kb_prev_field'),
      context: 'Forms'
    },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kb-modal-title"
    >
      <div
        className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 id="kb-modal-title" className="text-lg font-bold text-white">
            {t('kb_title')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close keyboard shortcuts"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-3">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.description}
                className="flex items-center justify-between py-3 px-4 bg-dark-bg rounded-lg border border-dark-border"
              >
                <div className="flex items-center space-x-2">
                  {shortcut.keys.map((key, keyIndex) => (
                    <React.Fragment key={`${shortcut.description}-${key}`}>
                      <kbd
                        className="px-3 py-1.5 text-xs font-mono font-medium bg-dark-surface border border-dark-border rounded-md text-gray-300"
                        aria-label={`Keyboard key: ${key}`}
                      >
                        {key === 'Ctrl' && isMac ? '⌘ Cmd' : key}
                        {key === 'Cmd' && key}
                        {key === 'Shift' && '⇧ Shift'}
                        {key === 'Escape' && 'Esc'}
                        {key === 'Enter' && '⏎ Enter'}
                        {key === 'Tab' && '⇥ Tab'}
                        {key !== 'Ctrl' && key !== 'Cmd' && key !== 'Shift' && key !== 'Escape' && key !== 'Enter' && key !== 'Tab' && key}
                      </kbd>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span className="text-gray-500 text-lg mx-1" aria-hidden="true">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div className="flex-1">
                  <span className="text-sm text-gray-300">{shortcut.description}</span>
                  <span className="text-xs text-gray-500 ml-2 block">
                    {shortcut.context}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-dark-border text-center">
            <p className="text-xs text-gray-500">
              {isMac ? 'macOS shortcuts use Command key (⌘)' : 'Windows/Linux shortcuts use Ctrl key'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

KeyboardShortcutsModal.displayName = 'KeyboardShortcutsModal';
