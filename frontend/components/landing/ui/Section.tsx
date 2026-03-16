import { ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export default function Section({ children, className = '', id }: SectionProps) {
  return (
    <section id={id} className={`py-20 px-4 ${className}`}>
      <div className="max-w-[1200px] mx-auto">
        {children}
      </div>
    </section>
  );
}
