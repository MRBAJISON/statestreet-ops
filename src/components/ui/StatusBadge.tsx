interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  let bg = 'bg-gray-700';
  let text = 'text-gray-300';

  if (normalized.includes('on track') || normalized.includes('in progress') || normalized.includes('good') || normalized === 'strong' || normalized === 'positive' || normalized === 'green') {
    bg = 'bg-green-500/20';
    text = 'text-green-400';
  } else if (normalized.includes('at risk') || normalized === 'watch' || normalized.includes('yellow') || normalized.includes('planned') || normalized === 'medium') {
    bg = 'bg-yellow-500/20';
    text = 'text-yellow-400';
  } else if (normalized.includes('off track') || normalized.includes('critical') || normalized === 'red' || normalized === 'high') {
    bg = 'bg-red-500/20';
    text = 'text-red-400';
  } else if (normalized === 'improving' || normalized === 'sunny') {
    bg = 'bg-green-500/20';
    text = 'text-green-400';
  } else if (normalized.includes('cloudy')) {
    bg = 'bg-yellow-500/20';
    text = 'text-yellow-400';
  }

  const sizeClass = size === 'sm' ? 'text-[0.65rem] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`${bg} ${text} ${sizeClass} rounded-full font-medium whitespace-nowrap`}>
      {status}
    </span>
  );
}
