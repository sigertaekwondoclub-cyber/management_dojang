import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
}

export function Card({ children, hoverable = false, className = '', ...props }: CardProps) {
  const hoverStyle = hoverable ? "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#1E2A38] transition-all duration-75 ease-in-out cursor-pointer" : "";

  return (
    <div 
      className={`bg-white border-[3px] border-dark rounded-none p-6 shadow-[4px_4px_0px_#1E2A38] text-dark ${hoverStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
