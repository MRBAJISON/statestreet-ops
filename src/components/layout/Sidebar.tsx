'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Department } from '@/lib/types';
import { useOrg } from '@/components/providers/OrgProvider';

interface SidebarProps {
  userName: string;
  userRole: string;
  departments: Department[];
}

// Per-role entry-report export (mirrors /api/export scopes). Owner sees full data
// elsewhere; each department/store pulls only its own.
const REPORT_LINK: Record<string, { scope: string; label: string }> = {
  operations: { scope: 'all', label: 'All Data' },
  finance: { scope: 'finance', label: 'Finance & Stores' },
  commercial: { scope: 'commercial', label: 'Commercial Report' },
  marketing: { scope: 'marketing', label: 'Marketing Report' },
  inventory: { scope: 'inventory', label: 'Inventory Report' },
  brand: { scope: 'brand', label: 'Brand Report' },
  'store-manager': { scope: 'store', label: 'My Store Report' },
};

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
  const { org } = useOrg();
  const [open, setOpen] = useState(false); // off-canvas drawer (all screen sizes)

  // Close the drawer on navigation — so it collapses as soon as a dashboard is opened.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Operations enters only the Operations form; finance only the Finance form (its
  // dashboard access is wide, but data entry stays scoped). Others get their own dept(s).
  const formDepts: Department[] =
    userRole === 'operations' ? ['operations']
    : userRole === 'finance' ? ['finance']
    : departments.filter((d) => d !== 'executive');

  // Put the user's own department dashboard first (e.g. Operations on top for the ops role).
  const homeDept = (departments as string[]).includes(userRole) ? (userRole as Department) : null;
  const orderedDepts = homeDept ? [homeDept, ...departments.filter((d) => d !== homeDept)] : departments;

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  const linkCls = (active: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
      active ? 'bg-[var(--c-hover)] text-[var(--c-fg)]' : 'text-gray-500 hover:text-gray-300 hover:bg-[var(--c-card)]'
    }`;

  return (
    <>
    {/* Top bar (all sizes): menu button + business name. Stays visible when the drawer is closed. */}
    <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[var(--c-card2)] border-b border-[var(--c-border)]">
      <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-2xl leading-none">☰</button>
      <div className="flex items-center gap-2">
        {org.logo ? (
          <img src={org.logo} alt="" className="w-7 h-7 rounded object-contain" />
        ) : (
          <div className="w-7 h-7 bg-[#c8a951] rounded flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-wider">{org.companyName.toUpperCase()}</span>
          <span className="text-[0.6rem] text-[#c8a951] tracking-widest">{org.tagline.toUpperCase()}</span>
        </div>
      </div>
    </div>

    {/* Overlay */}
    {open && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />}

    <aside className={`w-64 bg-[var(--c-card2)] border-r border-[var(--c-border)] flex flex-col h-screen fixed inset-y-0 left-0 z-50 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-4 border-b border-[var(--c-hover)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {org.logo ? (
            <img src={org.logo} alt="" className="w-8 h-8 rounded object-contain shrink-0" />
          ) : (
            <div className="w-8 h-8 bg-[#c8a951] rounded flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          )}
          <div>
            <div className="text-sm font-bold tracking-wider">{org.companyName.toUpperCase()}</div>
            <div className="text-[0.6rem] text-[#c8a951] tracking-widest">{org.tagline.toUpperCase()}</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-xl text-gray-500 hover:text-[var(--c-fg)] leading-none">✕</button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2">Dashboards</div>
        {userRole === 'store-manager' && (
          <Link href="/dashboard/store-manager" className={linkCls(pathname === '/dashboard/store-manager')}>
            <span>🏬</span>
            <span>My Store</span>
          </Link>
        )}
        {userRole !== 'store-manager' && orderedDepts.map((dept) => {
          const config = DEPT_CONFIG[dept];
          const href = `/dashboard/${dept === 'brand' ? 'brand-health' : dept}`;
          const isActive = pathname === href;
          return (
            <Link key={dept} href={href} className={linkCls(isActive)}>
              <span>{config.icon}</span>
              <span>{config.label}</span>
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />}
            </Link>
          );
        })}

        {(userRole === 'commercial' || userRole === 'owner') && (
          <Link href="/dashboard/weekly-targets" className={linkCls(pathname === '/dashboard/weekly-targets')}>
            <span>🎯</span>
            <span>Targets</span>
          </Link>
        )}

        {REPORT_LINK[userRole] && (
          <>
            <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4">Entry Report</div>
            <Link href="/reports" className={linkCls(pathname === '/reports')}>
              <span>📊</span>
              <span>{REPORT_LINK[userRole].label}</span>
            </Link>
          </>
        )}

        {userRole === 'owner' && (
          <>
            <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4">Administration</div>
            <Link href="/dashboard/admin" className={linkCls(pathname === '/dashboard/admin')}>
              <span>👤</span>
              <span>User Admin</span>
            </Link>
          </>
        )}

        {userRole === 'store-manager' && (
          <>
            <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4">Data Entry</div>
            <Link href="/forms/store-manager" className={linkCls(pathname === '/forms/store-manager')}>
              <span className="text-xs">📝</span>
              <span>Stores</span>
            </Link>
          </>
        )}

        {userRole !== 'owner' && userRole !== 'store-manager' && (
          <>
            <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4">Data Entry</div>
            {formDepts.map((dept) => {
              const config = DEPT_CONFIG[dept];
              const href = `/forms/${dept === 'brand' ? 'brand-health' : dept}`;
              const isActive = pathname === href;
              return (
                <Link key={`form-${dept}`} href={href} className={linkCls(isActive)}>
                  <span className="text-xs">📝</span>
                  <span>{config.label} Forms</span>
                </Link>
              );
            })}
          </>
        )}

        <div className="text-[0.6rem] text-gray-600 uppercase tracking-wider px-3 py-2 mt-4">Account</div>
        <Link href="/settings" className={linkCls(pathname === '/settings')}>
          <span>⚙️</span>
          <span>Settings</span>
        </Link>
      </nav>

      <div className="p-3 border-t border-[var(--c-hover)]">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-7 h-7 bg-[#c8a951]/20 rounded-full flex items-center justify-center text-[#c8a951] text-xs font-bold shrink-0">
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
