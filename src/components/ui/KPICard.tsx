'use client';

import { MiniSparkline } from '@/components/charts/Charts';

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
  // When set (0–100+), draws a gold progress bar + % of target under the value.
  progress?: number;
  // When set, draws a subtle trend sparkline across the bottom of the card.
  sparkline?: number[];
  sparkColor?: string;
}

export default function KPICard({ label, value, target, change, changeLabel, prefix, suffix, status, icon, small, progress, sparkline, sparkColor = '#e8c75a' }: KPICardProps) {
  const statusColor = status === 'green' ? 'text-green-500' : status === 'yellow' ? 'text-yellow-500' : status === 'red' ? 'text-red-500' : 'text-[var(--c-fg)]';
  const statusBorder = status === 'green' ? 'border-green-500/30' : status === 'yellow' ? 'border-yellow-500/30' : status === 'red' ? 'border-red-500/30' : 'border-[var(--c-border)]';

  return (
    <div className={`panel-surface bg-[var(--c-card)] border ${statusBorder} rounded-xl ${small ? 'p-3' : 'p-4'} flex flex-col gap-1`}>
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
      {progress !== undefined && (
        <div className="mt-0.5">
          <div className="h-1.5 rounded-full bg-[var(--c-hover)] overflow-hidden">
            <div className="h-full bg-[#c8a951] rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
          <div className="text-[0.65rem] text-[#c8a951] font-semibold mt-0.5 text-right">{progress.toFixed(0)}% of target</div>
        </div>
      )}
      {sparkline && sparkline.length > 1 && (
        <div className="-mx-3 -mb-3 mt-1 opacity-60">
          <MiniSparkline data={sparkline} color={sparkColor} height={32} />
        </div>
      )}
    </div>
  );
}
