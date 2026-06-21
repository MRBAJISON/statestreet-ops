import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-server';
import { buildFinanceTemplate } from '@/lib/import-finance';

export const runtime = 'nodejs';

// Download a pre-formatted Expenses + Budget template (with valid category names).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.departments.includes('finance')) {
    return NextResponse.json({ error: 'Finance access required' }, { status: 403 });
  }
  const org = await getOrgSettings();
  const buf = await buildFinanceTemplate(org);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="finance-import-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
