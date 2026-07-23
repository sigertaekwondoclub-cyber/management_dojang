import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'accent';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const baseStyle = "font-bold text-dark border-2 border-dark rounded-2xl px-6 py-3 shadow-brutal transition-all active:shadow-none active:translate-x-1 active:translate-y-1 hover:-translate-y-0.5";
  
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
