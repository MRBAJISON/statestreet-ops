interface SectionProps {
  number?: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Section({ number, title, subtitle, children, className = '' }: SectionProps) {
  return (
    <div className={`bg-[#111] border border-[#2a2a2a] rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {number !== undefined && (
          <span className="bg-[#c8a951] text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{number}</span>
        )}
        <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
        {subtitle && <span className="text-xs text-gray-500">({subtitle})</span>}
      </div>
      {children}
    </div>
  );
}
