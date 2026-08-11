import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'accent';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const baseStyle = "font-pixel text-dark border-[3px] border-dark rounded-none px-6 py-2.5 shadow-[4px_4px_0px_#1E2A38] transition-all duration-75 ease-in-out hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#1E2A38] active:translate-x-1 active:translate-y-1 active:shadow-none select-none cursor-pointer";
  
  const variants = {
    primary: "bg-primary",
    secondary: "bg-secondary",
    accent: "bg-accent"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
