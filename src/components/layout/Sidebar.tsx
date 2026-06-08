'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Department } from '@/lib/types';

interface SidebarProps {
  userName: string;
  userRole: string;
  departments: Department[];
}

const DEPT_CONFIG: Record<Department, { label: string; icon: string; color: string }> = {
  executive: { label: 'Executive Command', icon: '⚡', color: '#c8a951' },
  finance: { label: 'Finance', icon: '💰', color: '#22c55e' },
  commercial: { label: 'Commercial', icon: '🏪', color: '#3b82f6' },
  marketing: { label: 'Marketing', icon: '📢', color: '#8b5cf6' },
  operations: { label: 'Operations', icon: '⚙️', color: '#f97316' },
  inventory: { label: 'Inventory', icon: '📦', color: '#06b6d4' },
  brand: { label: 'Brand Health', icon: '🏆', color: '#ec4899' },
};

const ALL_FORM_DEPTS: Department[] = ['finance', 'commercial', 'marketing', 'operations', 'inventory', 'brand'];

export default function Sidebar({ userName, userRole, departments }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);
  // Operations manager can use every form; others only their own department(s).
  const formDepts = userRole === 'operations' ? ALL_FORM_DEPTS : departments.filter((d) => d !== 'executive');

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <>
    {/* Mobile top bar (hamburger left; theme toggle floats top-right globally) */}
    <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[var(--c-card2)] border-b border-[var(--c-border)]">
      <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-2xl leading-none">☰</button>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-[#c8a951] rounded flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-sm font-bold tracking-wider">STATESTREET</span>
      </div>
    </div>

    {/* Mobile overlay */}
    {open && <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />}

    <aside className={`w-56 bg-[var(--c-card2)] border-r border-[var(--c-border)] flex flex-col h-screen fixed inset-y-0 left-0 z-50 transform transition-transform md:sticky md:top-0 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-4 border-b border-[var(--c-hover)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#c8a951] rounded flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold tracking-wider">STATESTREET</div>
            <div className="text-[0.6rem] text-[#c8a951] tracking-widest">RETAIL GROUP</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2">Dashboards</div>
        {departments.map(dept => {
          const config = DEPT_CONFIG[dept];
          const href = `/dashboard/${dept === 'brand' ? 'brand-health' : dept}`;
          const isActive = pathname === href;
          return (
            <Link key={dept} href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-[var(--c-hover)] text-[var(--c-fg)]' : 'text-gray-500 hover:text-gray-300 hover:bg-[var(--c-card)]'
              }`}>
              <span>{config.icon}</span>
              <span>{config.label}</span>
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />}
            </Link>
          );
        })}

        {userRole === 'owner' && (
          <>
            <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4">Administration</div>
            <Link href="/dashboard/admin"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === '/dashboard/admin' ? 'bg-[var(--c-hover)] text-[var(--c-fg)]' : 'text-gray-500 hover:text-gray-300 hover:bg-[var(--c-card)]'
              }`}>
              <span>👤</span>
              <span>User Admin</span>
            </Link>
          </>
        )}

        {userRole === 'store-manager' && (
          <>
            <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4">Data Entry</div>
            <Link href="/forms/store-manager"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === '/forms/store-manager' ? 'bg-[var(--c-hover)] text-[var(--c-fg)]' : 'text-gray-500 hover:text-gray-300 hover:bg-[var(--c-card)]'
              }`}>
              <span className="text-xs">📝</span>
              <span>Weekly Review</span>
            </Link>
          </>
        )}

        {userRole !== 'owner' && userRole !== 'store-manager' && (
          <>
            <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4">Data Entry</div>
            {formDepts.map(dept => {
              const config = DEPT_CONFIG[dept];
              const href = `/forms/${dept === 'brand' ? 'brand-health' : dept}`;
              const isActive = pathname === href;
              return (
                <Link key={`form-${dept}`} href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-[var(--c-hover)] text-[var(--c-fg)]' : 'text-gray-500 hover:text-gray-300 hover:bg-[var(--c-card)]'
                  }`}>
                  <span className="text-xs">📝</span>
                  <span>{config.label} Forms</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-[var(--c-hover)]">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-7 h-7 bg-[#c8a951]/20 rounded-full flex items-center justify-center text-[#c8a951] text-xs font-bold">
            {userName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{userName}</div>
            <div className="text-[0.6rem] text-gray-500 capitalize">{userRole}</div>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full mt-1 text-xs text-gray-500 hover:text-red-400 py-1.5 rounded transition-colors">
          Sign Out
        </button>
      </div>
    </aside>
    </>
  );
}
