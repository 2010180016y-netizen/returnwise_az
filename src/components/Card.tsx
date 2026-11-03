import React, { ReactNode, HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  isRecommended?: boolean;
  isDisabled?: boolean;
  children?: ReactNode;
}

export const Card: React.FC<CardProps> = ({
  isRecommended = false,
  isDisabled = false,
  className = '',
  children,
  ...props
}) => {
  const highlightClass = isRecommended ? 'rw-card-recommended' : '';
  const disabledClass = isDisabled ? 'rw-card-disabled' : '';

  return (
    <div
      className={`rw-card ${highlightClass} ${disabledClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={`rw-card-header ${className}`.trim()} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<HTMLAttributes<HTMLHeadingElement>> = ({ className = '', children, ...props }) => (
  <h3 className={`rw-card-title ${className}`.trim()} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<HTMLAttributes<HTMLParagraphElement>> = ({ className = '', children, ...props }) => (
  <p className={`rw-card-description ${className}`.trim()} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={`rw-card-content ${className}`.trim()} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={`rw-card-footer ${className}`.trim()} {...props}>
    {children}
  </div>
);
