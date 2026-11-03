import React, { useState, ReactNode } from 'react';

export interface TooltipProps {
  content: ReactNode;
  children?: ReactNode;
  ariaLabel?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, ariaLabel = '도움말 안내' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span
      className="rw-tooltip-wrapper"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <button
        type="button"
        className="rw-tooltip-trigger"
        aria-label={ariaLabel}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {children ?? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
      </button>
      {isVisible && (
        <div className="rw-tooltip-bubble" role="tooltip">
          {content}
        </div>
      )}
    </span>
  );
};
