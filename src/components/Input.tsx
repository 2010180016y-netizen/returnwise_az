import { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  suffix?: string;
  isError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ suffix, isError = false, className = '', id, 'aria-describedby': ariaDescribedBy, ...props }, ref) => {
    const errorId = id && isError ? `${id}-error` : undefined;
    const combinedDescribedBy = [ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="rw-input-wrapper">
        <input
          ref={ref}
          id={id}
          className={`rw-input ${suffix ? 'has-suffix' : ''} ${isError ? 'rw-input-error' : ''} ${className}`.trim()}
          aria-invalid={isError ? 'true' : undefined}
          aria-describedby={combinedDescribedBy}
          {...props}
        />
        {suffix && <span className="rw-input-suffix" aria-hidden="true">{suffix}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
