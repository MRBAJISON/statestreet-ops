interface SectionProps {
  number?: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Section({ number, title, subtitle, children, className = '' }: SectionProps) {
  return (
    <div className={`panel-surface bg-[var(--c-card)] border border-[var(--c-border)] rounded-xl p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {number !== undefined && (
          <span className="bg-gradient-to-br from-[#e8c75a] to-[#a08535] text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-[0_4px_10px_-3px_rgba(200,169,81,.6)]">{number}</span>
        )}
        <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
        {subtitle && <span className="text-xs text-gray-500">({subtitle})</span>}
      </div>
      {children}
    </div>
  );
}
