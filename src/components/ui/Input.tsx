import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="font-pixel text-sm text-dark">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`border-[3px] border-dark rounded-none px-4 py-2.5 bg-white text-dark placeholder:text-dark/40 focus:outline-none focus:border-primary focus:shadow-[3px_3px_0px_#1E2A38] transition-all duration-75 ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
