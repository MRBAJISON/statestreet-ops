// StateStreet-branded loading screen: gold spinner ring around the logo.
export default function BrandedLoader({ fullScreen = false, label = 'Loading…' }: { fullScreen?: boolean; label?: string }) {
  return (
    <div className={`${fullScreen ? 'min-h-screen' : 'min-h-[60vh]'} w-full flex flex-col items-center justify-center gap-4 bg-[var(--c-bg)] text-[var(--c-fg)]`}>
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--c-border)] border-t-[#c8a951] animate-spin" />
        <div className="w-9 h-9 bg-[#c8a951] rounded flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-bold tracking-wider">STATESTREET</div>
        <div className="text-[0.6rem] text-[#c8a951] tracking-widest">RETAIL GROUP</div>
      </div>
      <div className="text-xs text-gray-400 animate-pulse">{label}</div>
    </div>
  );
}

// Small inline spinner for buttons/actions.
export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin align-[-2px] ${className}`} />;
}
