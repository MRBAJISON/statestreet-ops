interface EmptyStateProps {
  message?: string;
  hint?: string;
  height?: number;
}

// Shown wherever there is no data yet, so the UI reads as intentional, not broken.
export default function EmptyState({ message = 'No data yet', hint, height = 160 }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-[var(--c-border)] bg-[var(--c-card2)]"
      style={{ minHeight: height }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 14l3-3 3 3 4-5" />
      </svg>
      <p className="text-xs text-gray-500 mt-2">{message}</p>
      {hint && <p className="text-[0.65rem] text-gray-600 mt-0.5 max-w-[14rem]">{hint}</p>}
    </div>
  );
}
