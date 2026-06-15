// Server-only helpers to read/locate the org-settings record (keeps db out of client bundles).
import { db } from './db';
import { entries } from './db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { mergeOrg, type OrgSettings } from './org';

const COND = and(eq(entries.department, 'admin'), eq(entries.formType, 'org-settings'));

export async function getOrgRow() {
  const rows = await db.select().from(entries).where(COND).orderBy(desc(entries.id)).limit(1);
  return rows[0] ?? null;
}

export async function getOrgSettings(): Promise<OrgSettings> {
  const row = await getOrgRow();
  return mergeOrg((row?.payload as Partial<OrgSettings>) ?? null);
}
