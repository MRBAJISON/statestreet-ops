'use client';

interface KPICardProps {
  label: string;
  value: string | number;
  target?: string | number;
  change?: number;
  changeLabel?: string;
  prefix?: string;
  suffix?: string;
  status?: 'green' | 'yellow' | 'red';
  icon?: React.ReactNode;
  small?: boolean;
}

export default function KPICard({ label, value, target, change, changeLabel, prefix, suffix, status, icon, small }: KPICardProps) {
  const statusColor = status === 'green' ? 'text-green-500' : status === 'yellow' ? 'text-yellow-500' : status === 'red' ? 'text-red-500' : 'text-[var(--c-fg)]';
  const statusBorder = status === 'green' ? 'border-green-500/30' : status === 'yellow' ? 'border-yellow-500/30' : status === 'red' ? 'border-red-500/30' : 'border-[var(--c-border)]';

  return (
    <div className={`bg-[var(--c-card)] border ${statusBorder} rounded-lg ${small ? 'p-3' : 'p-4'} flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] text-gray-400 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-[#c8a951]">{icon}</span>}
      </div>
      <div className={`flex items-baseline gap-1 ${small ? 'text-lg' : 'text-2xl'} font-bold ${statusColor}`}>
        {prefix && <span className="text-sm text-gray-400">{prefix}</span>}
        {value}
        {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
      </div>
      <div className="flex items-center gap-2 text-xs">
        {target !== undefined && (
          <span className="text-gray-500">Target: {target}</span>
        )}
        {change !== undefined && (
          <span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change)}{changeLabel || '%'}
          </span>
        )}
      </div>
    </div>
  );
}
