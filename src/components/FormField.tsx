import React, { ReactNode } from 'react';

export interface FormFieldProps {
  id?: string;
  label?: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  tooltip?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  required = false,
  helpText,
  error,
  tooltip,
  children,
  className = '',
}) => {
  return (
    <div className={`rw-field ${className}`.trim()}>
      {label && (
        <label htmlFor={id} className="rw-label">
          <span>{label}</span>
          {required && <span className="rw-required-star" aria-label="필수 입력 항목">*</span>}
          {tooltip && <span style={{ marginLeft: '0.25rem' }}>{tooltip}</span>}
        </label>
      )}
      {children}
      {error ? (
        <span id={id ? `${id}-error` : undefined} className="rw-error-text" role="alert">
          {error}
        </span>
      ) : helpText ? (
        <span className="rw-help-text">{helpText}</span>
      ) : null}
    </div>
  );
};
