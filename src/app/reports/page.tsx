import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ReportsClient from './ReportsClient';

// Which report scope each role downloads (mirrors /api/export ALLOWED).
const ROLE_SCOPE: Record<string, { scope: string; label: string }> = {
  operations: { scope: 'all', label: 'All Departments' },
  finance: { scope: 'finance', label: 'Finance & Stores' },
  commercial: { scope: 'commercial', label: 'Commercial' },
  marketing: { scope: 'marketing', label: 'Marketing' },
  inventory: { scope: 'inventory', label: 'Inventory' },
  brand: { scope: 'brand', label: 'Brand' },
  'store-manager': { scope: 'store', label: 'My Store' },
};

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const cfg = ROLE_SCOPE[session.user.role];
  if (!cfg) {
    return (
      <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-fg)] p-6">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-xl font-bold">Entry Report</h1>
          <p className="text-sm text-gray-500 mt-2">No downloadable report is configured for your role.</p>
        </div>
      </div>
    );
  }

  return <ReportsClient scope={cfg.scope} label={cfg.label} />;
}
