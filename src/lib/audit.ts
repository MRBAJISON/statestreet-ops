import { db } from './db';
import { auditLog } from './db/schema';
import { getSession } from './auth';

// Audit is currently scoped to daily-sales records (finance/revenue).
export function isAudited(department: string, formType: string) {
  return department === 'finance' && formType === 'revenue';
}

// Field-level before/after diff (only changed keys).
export function diffPayload(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    const a = before?.[k];
    const b = after?.[k];
    if (String(a ?? '') !== String(b ?? '')) changes[k] = { from: a ?? null, to: b ?? null };
  }
  return changes;
}

// Record an activity row. Never throws — auditing must not block the main write.
export async function recordAudit(entryId: number, action: 'create' | 'update' | 'delete', changes?: Record<string, unknown>) {
  try {
    const session = await getSession();
    await db.insert(auditLog).values({
      entryId,
      action,
      userId: session?.user.id ?? null,
      userName: session?.user.name ?? null,
      changes: changes ?? null,
    });
  } catch {
    /* swallow — audit failures must not break the user's save */
  }
}
