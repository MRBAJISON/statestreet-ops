interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  mission?: string;
  missionDetail?: string;
  date?: string;
}

export default function DashboardHeader({ title, subtitle, mission, missionDetail, date }: DashboardHeaderProps) {
  const now = date || new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="bg-[var(--c-card2)] border-b border-[var(--c-hover)] px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide">{title}</h1>
          <p className="text-xs text-[#c8a951] tracking-wider mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-gray-400">{now}</div>
            <div className="text-[0.6rem] text-gray-600">Updated: 09:00 AM</div>
          </div>
          {mission && (
            <div className="bg-[var(--c-card)] border border-[#c8a951]/30 rounded-lg px-4 py-2 max-w-[200px]">
              <div className="text-[0.6rem] text-[#c8a951] font-bold uppercase tracking-wider">{mission}</div>
              {missionDetail && <div className="text-[0.55rem] text-gray-400 mt-0.5">{missionDetail}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
