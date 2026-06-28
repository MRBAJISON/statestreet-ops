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
  // When set, draws a subtle trend sparkline bleeding to the bottom edge of the card.
  sparkline?: number[];
  sparkColor?: string;
}

// Command-center KPI card: icon chip + label, large tabular value, change pill /
// target, optional progress bar, optional edge-to-edge sparkline. Matches the
// command-center.html reference. All props are backwards-compatible.
export default function KPICard({ label, value, target, change, changeLabel, prefix, suffix, status, icon, small, progress, sparkline, sparkColor = '#e8c75a' }: KPICardProps) {
  const statusColor = status === 'green' ? 'text-green-500' : status === 'yellow' ? 'text-yellow-500' : status === 'red' ? 'text-red-500' : 'text-[var(--c-fg)]';
  const statusBorder = status === 'green' ? 'border-green-500/30' : status === 'yellow' ? 'border-yellow-500/30' : status === 'red' ? 'border-red-500/30' : 'border-[var(--c-border)]';

  return (
    <div className={`panel-surface bg-[var(--c-card)] border ${statusBorder} rounded-xl ${small ? 'p-3' : 'p-4'} relative overflow-hidden flex flex-col`}>
      <div className="flex items-center gap-2">
        {icon && (
          <span className="grid place-items-center w-[22px] h-[22px] rounded-md bg-[var(--c-card2)] text-[#e8c75a] text-xs flex-shrink-0">{icon}</span>
        )}
        <span className="text-[0.65rem] text-gray-500 uppercase tracking-wider font-semibold leading-tight">{label}</span>
      </div>

      <div className={`flex items-baseline gap-1 mt-2 ${small ? 'text-xl' : 'text-2xl'} font-bold tabular-nums ${statusColor}`}>
        {prefix && <span className="text-sm text-gray-400 font-normal">{prefix}</span>}
        {value}
        {suffix && <span className="text-sm text-gray-400 font-normal">{suffix}</span>}
      </div>

      {(change !== undefined || target !== undefined) && (
        <div className="flex items-center gap-2 mt-1.5 text-xs">
          {change !== undefined && (
            <span className={`inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-md ${change >= 0 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change)}{changeLabel || '%'}
            </span>
          )}
          {target !== undefined && <span className="text-gray-500">Target: {target}</span>}
        </div>
      )}

      {progress !== undefined && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-[var(--c-hover)] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#c8a951] to-[#e8c75a]" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
          <div className="text-[0.65rem] text-[#e8c75a] font-semibold mt-0.5 text-right">{progress.toFixed(0)}% of target</div>
        </div>
      )}

      {sparkline && sparkline.length > 1 && (
        <div className="absolute left-0 right-0 bottom-0 opacity-50 pointer-events-none">
          <MiniSparkline data={sparkline} color={sparkColor} height={34} />
        </div>
      )}
    </div>
  );
}
