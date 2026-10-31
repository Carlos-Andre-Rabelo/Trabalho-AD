import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 sm:p-5 transition-shadow hover:shadow ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
