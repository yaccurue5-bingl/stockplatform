import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export default function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`
        bg-[#121821] border border-gray-800 rounded-xl
        ${hover ? 'hover:border-[#00D4A6]/40 hover:shadow-lg hover:shadow-[#00D4A6]/5 transition-all duration-200' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
