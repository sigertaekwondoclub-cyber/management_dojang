import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label htmlFor={inputId} className="font-bold text-dark">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark placeholder:text-dark/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-dark transition-colors ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
