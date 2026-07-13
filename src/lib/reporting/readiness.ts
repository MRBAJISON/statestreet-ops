import { sql } from 'drizzle-orm';
import { db } from '../db';

export interface LegacyBackfillStatus {
  ready: boolean;
  remainingEntries: number;
}

export async function getLegacyBackfillStatus(): Promise<LegacyBackfillStatus> {
  const result = await db.execute(sql`
    select count(*)::integer as remaining_entries
    from entries legacy
    where legacy.department = 'finance'
      and legacy.form_type in ('revenue', 'closing')
      and not exists (
        select 1
        from daily_report_legacy_entries migrated
        where migrated.entry_id = legacy.id
      )
  `);
  const remainingEntries = Number((result.rows[0] as { remaining_entries?: number } | undefined)?.remaining_entries ?? 0);
  return { ready: remainingEntries === 0, remainingEntries };
}
