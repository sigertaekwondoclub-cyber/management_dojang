import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div 
      className={`bg-white border-2 border-dark rounded-2xl p-6 shadow-brutal text-dark ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
