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

export default function Sidebar({ userName, userRole, departments }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop icon-rail

  // Close the mobile drawer on navigation.
  useEffect(() => { setOpen(false); }, [pathname]);
  // Collapse the rail to icons whenever a dashboard is opened; expand elsewhere.
  useEffect(() => { setCollapsed(pathname.startsWith('/dashboard')); }, [pathname]);

  // Operations now only enters the Operations form; other roles get their own department(s).
  const formDepts: Department[] = userRole === 'operations' ? ['operations'] : departments.filter((d) => d !== 'executive');

  // Put the user's own department dashboard first (e.g. Operations on top for the ops role).
  const homeDept = (departments as string[]).includes(userRole) ? (userRole as Department) : null;
  const orderedDepts = homeDept ? [homeDept, ...departments.filter((d) => d !== homeDept)] : departments;

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  const hide = collapsed ? 'md:hidden' : '';
  const linkCls = (active: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${collapsed ? 'md:justify-center md:px-2' : ''} ${
      active ? 'bg-[var(--c-hover)] text-[var(--c-fg)]' : 'text-gray-500 hover:text-gray-300 hover:bg-[var(--c-card)]'
    }`;

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

    <aside className={`w-56 ${collapsed ? 'md:w-16' : 'md:w-56'} bg-[var(--c-card2)] border-r border-[var(--c-border)] flex flex-col h-screen fixed inset-y-0 left-0 z-50 transform transition-all md:sticky md:top-0 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-4 border-b border-[var(--c-hover)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#c8a951] rounded flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className={hide}>
            <div className="text-sm font-bold tracking-wider">STATESTREET</div>
            <div className="text-[0.6rem] text-[#c8a951] tracking-widest">RETAIL GROUP</div>
          </div>
        </div>
      </div>

      {/* Desktop collapse toggle */}
      <button onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar"
        className="hidden md:flex items-center justify-center py-1.5 text-gray-500 hover:text-[var(--c-fg)] border-b border-[var(--c-hover)] text-sm">
        {collapsed ? '»' : '«'}
      </button>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
        <div className={`text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 ${hide}`}>Dashboards</div>
        {userRole === 'store-manager' && (
          <Link href="/dashboard/store-manager" title="My Store" className={linkCls(pathname === '/dashboard/store-manager')}>
            <span>🏬</span>
            <span className={hide}>My Store</span>
          </Link>
        )}
        {userRole !== 'store-manager' && orderedDepts.map((dept) => {
          const config = DEPT_CONFIG[dept];
          const href = `/dashboard/${dept === 'brand' ? 'brand-health' : dept}`;
          const isActive = pathname === href;
          return (
            <Link key={dept} href={href} title={config.label} className={linkCls(isActive)}>
              <span>{config.icon}</span>
              <span className={hide}>{config.label}</span>
              {isActive && <div className={`ml-auto w-1.5 h-1.5 rounded-full ${hide}`} style={{ backgroundColor: config.color }} />}
            </Link>
          );
        })}

        {(userRole === 'commercial' || userRole === 'owner') && (
          <Link href="/dashboard/weekly-targets" title="Targets" className={linkCls(pathname === '/dashboard/weekly-targets')}>
            <span>🎯</span>
            <span className={hide}>Targets</span>
          </Link>
        )}

        {(userRole === 'finance' || userRole === 'operations') && (
          <>
            <div className={`text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4 ${hide}`}>Export</div>
            {userRole === 'operations' && (
              <a href="/api/export?scope=all" title="Export All Data" className={linkCls(false)}>
                <span>📊</span>
                <span className={hide}>All Data</span>
              </a>
            )}
            {userRole === 'finance' && (
              <a href="/api/export?scope=finance" title="Export Finance & Stores" className={linkCls(false)}>
                <span>📊</span>
                <span className={hide}>Finance &amp; Stores</span>
              </a>
            )}
          </>
        )}

        {userRole === 'owner' && (
          <>
            <div className={`text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4 ${hide}`}>Administration</div>
            <Link href="/dashboard/admin" title="User Admin" className={linkCls(pathname === '/dashboard/admin')}>
              <span>👤</span>
              <span className={hide}>User Admin</span>
            </Link>
          </>
        )}

        {userRole === 'store-manager' && (
          <>
            <div className={`text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4 ${hide}`}>Data Entry</div>
            <Link href="/forms/store-manager" title="Stores" className={linkCls(pathname === '/forms/store-manager')}>
              <span className="text-xs">📝</span>
              <span className={hide}>Stores</span>
            </Link>
          </>
        )}

        {userRole !== 'owner' && userRole !== 'store-manager' && (
          <>
            <div className={`text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4 ${hide}`}>Data Entry</div>
            {formDepts.map((dept) => {
              const config = DEPT_CONFIG[dept];
              const href = `/forms/${dept === 'brand' ? 'brand-health' : dept}`;
              const isActive = pathname === href;
              return (
                <Link key={`form-${dept}`} href={href} title={`${config.label} Forms`} className={linkCls(isActive)}>
                  <span className="text-xs">📝</span>
                  <span className={hide}>{config.label} Forms</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-[var(--c-hover)]">
        <div className={`flex items-center gap-2 px-3 py-2 ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
          <div className="w-7 h-7 bg-[#c8a951]/20 rounded-full flex items-center justify-center text-[#c8a951] text-xs font-bold shrink-0">
            {userName.charAt(0)}
          </div>
          <div className={`flex-1 min-w-0 ${hide}`}>
            <div className="text-xs font-medium truncate">{userName}</div>
            <div className="text-[0.6rem] text-gray-500 capitalize">{userRole}</div>
          </div>
        </div>
        <button onClick={handleLogout} title="Sign Out"
          className="w-full mt-1 text-xs text-gray-500 hover:text-red-400 py-1.5 rounded transition-colors">
          <span className={hide}>Sign Out</span>
          <span className={collapsed ? 'hidden md:inline' : 'hidden'}>⏻</span>
        </button>
      </div>
    </aside>
    </>
  );
}
