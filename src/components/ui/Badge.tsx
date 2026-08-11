import React from 'react';

type BadgeColor = 'primary' | 'secondary' | 'accent' | 'dark';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  color?: BadgeColor;
}

export function Badge({ children, color = 'primary', className = '', ...props }: BadgeProps) {
  const colors = {
    primary: "bg-primary",
    secondary: "bg-secondary",
    accent: "bg-accent",
    dark: "bg-dark text-white"
  };

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-none border-2 border-dark font-pixel text-xs ${colors[color]} ${className}`}
      {...props}
    >
      <span className="w-1.5 h-1.5 bg-dark shrink-0"></span>
      {children}
    </span>
  );
}
