import React, { memo } from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
}

interface EmptyStateTip {
  icon: string;
  text: string;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  tips?: EmptyStateTip[];
  className?: string;
}

const RobotIcon = memo(() => (
  <svg 
    className="w-12 h-12 text-brand-400" 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    {/* Robot head */}
    <rect x="6" y="4" width="12" height="10" rx="2" strokeWidth="1.5" />
    {/* Robot eyes */}
    <circle cx="9.5" cy="8" r="1.5" fill="currentColor" className="animate-pulse" />
    <circle cx="14.5" cy="8" r="1.5" fill="currentColor" className="animate-pulse" style={{ animationDelay: '0.2s' }} />
    {/* Robot mouth */}
    <path d="M9 11h6" strokeWidth="1.5" strokeLinecap="round" />
    {/* Robot antenna */}
    <line x1="12" y1="4" x2="12" y2="2" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="1.5" r="1" fill="currentColor" className="animate-pulse" style={{ animationDelay: '0.4s' }} />
    {/* Robot body */}
    <path d="M8 14v3M16 14v3M6 17h12" strokeWidth="1.5" strokeLinecap="round" />
    {/* Gear decorations */}
    <circle cx="4" cy="12" r="1.5" strokeWidth="1" className="opacity-50" />
    <circle cx="20" cy="12" r="1.5" strokeWidth="1" className="opacity-50" />
  </svg>
));

RobotIcon.displayName = 'RobotIcon';

export const EmptyState: React.FC<EmptyStateProps> = memo(({
  icon,
  title,
  description,
  actions = [],
  tips = [],
  className = ''
}) => {
  return (
    <div 
      className={`bg-dark-surface border border-dark-border rounded-2xl p-8 md:p-12 text-center ${className}`}
      role="region"
      aria-label="Empty state"
    >
      {/* Animated Icon Container */}
      <div className="relative mx-auto mb-6">
        <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-2xl animate-pulse" aria-hidden="true" />
        <div className="relative w-24 h-24 bg-gradient-to-br from-brand-500/20 to-brand-600/10 rounded-full flex items-center justify-center mx-auto border border-brand-500/30 group-hover:border-brand-500/50 transition-colors">
          {icon || <RobotIcon />}
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
      <p className="text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">{description}</p>

      {/* Quick Start Tips */}
      {tips.length > 0 && (
        <div className="mb-8 space-y-3">
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-4">
            Try saying:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {tips.map((tip, index) => (
              <div
                key={index}
                className="inline-flex items-center gap-2 px-4 py-2 bg-dark-bg border border-dark-border rounded-full text-sm text-gray-300 hover:border-brand-500/50 hover:text-brand-400 transition-all cursor-default group"
              >
                <span className="text-lg" aria-hidden="true">{tip.icon}</span>
                <span>{tip.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {actions.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {actions.map((action, index) => {
            const buttonClasses = action.variant === 'primary'
              ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20'
              : 'bg-dark-bg border border-dark-border hover:border-brand-500 text-gray-300 hover:text-white';

            const content = (
              <>
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
                {action.variant === 'primary' && (
                  <svg 
                    className="w-4 h-4 ml-2 inline-block transition-transform group-hover:translate-x-1" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                )}
              </>
            );

            if (action.href) {
              return (
                <Link
                  key={index}
                  to={action.href}
                  className={`inline-flex items-center justify-center px-6 py-3 rounded-xl font-medium transition-all group ${buttonClasses}`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={index}
                onClick={action.onClick}
                className={`inline-flex items-center justify-center px-6 py-3 rounded-xl font-medium transition-all group ${buttonClasses}`}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;
