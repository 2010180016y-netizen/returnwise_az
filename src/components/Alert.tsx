import React, { ReactNode, HTMLAttributes } from 'react';

export type AlertType = 'info' | 'warning' | 'error' | 'success';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  type?: AlertType;
  title?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

const defaultIcons: Record<AlertType, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🚫',
  success: '✅',
};

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  icon,
  className = '',
  children,
  ...props
}) => {
  const displayIcon = icon ?? defaultIcons[type];

  return (
    <div
      role="alert"
      className={`rw-alert rw-alert-${type} ${className}`.trim()}
      {...props}
    >
      <div style={{ flexShrink: 0, fontSize: '1.125rem' }} aria-hidden="true">
        {displayIcon}
      </div>
      <div style={{ flex: 1 }}>
        {title && (
          <strong style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
            {title}
          </strong>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};
