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
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-dark font-bold text-sm ${colors[color]} ${className}`}
      {...props}
    >
      <span className="w-2 h-2 rounded-full bg-dark"></span>
      {children}
    </span>
  );
}
