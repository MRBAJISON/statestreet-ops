interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
}

export default function ProgressBar({ value, max = 100, color, height = 6, showLabel = false }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = color || (pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : '#ef4444');

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-[#2a2a2a] rounded-full overflow-hidden" style={{ height }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      {showLabel && <span className="text-xs text-gray-400 min-w-[2.5rem] text-right">{value}%</span>}
    </div>
  );
}
