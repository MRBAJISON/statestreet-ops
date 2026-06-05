'use client';

interface ScoreGaugeProps {
  score: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export default function ScoreGauge({ score, label, size = 'md', color }: ScoreGaugeProps) {
  const sizes = { sm: 48, md: 72, lg: 96 };
  const s = sizes[size];
  const stroke = size === 'sm' ? 4 : size === 'md' ? 6 : 8;
  const radius = (s - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (color) return color;
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    return '#ef4444';
  };

  const fontSize = size === 'sm' ? '0.7rem' : size === 'md' ? '1rem' : '1.5rem';
  const labelSize = size === 'sm' ? '0.5rem' : '0.6rem';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={s} height={s} className="-rotate-90">
        <circle cx={s / 2} cy={s / 2} r={radius} fill="none" stroke="#2a2a2a" strokeWidth={stroke} />
        <circle
          cx={s / 2} cy={s / 2} r={radius} fill="none"
          stroke={getColor()} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
        <text x={s / 2} y={s / 2} textAnchor="middle" dominantBaseline="central"
          fill="white" fontSize={fontSize} fontWeight="bold"
          className="rotate-90 origin-center">
          {score}{size !== 'sm' && '%'}
        </text>
      </svg>
      {label && <span className="text-gray-400" style={{ fontSize: labelSize }}>{label}</span>}
    </div>
  );
}
