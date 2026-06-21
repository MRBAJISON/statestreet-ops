import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { getSession } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-server';
import { parseFinanceFile } from '@/lib/import-finance';

export const runtime = 'nodejs';

const MAX_BYTES = 5_000_000;
const num = (v: unknown) => Number(String(v ?? '').replace(/[,\s]/g, '')) || 0;

// Drop empty fields so we never persist blank values (matches the normal entry POST).
function clean(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== '' && v !== null && v !== undefined) out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

// year::item key used to detect duplicate budgets (budgets are one figure per item/year).
const budKey = (year: unknown, item: unknown) => `${String(year ?? '')}::${String(item ?? '')}`;

async function requireFinance() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.departments.includes('finance')) {
    return { error: NextResponse.json({ error: 'Finance access required' }, { status: 403 }) };
  }
  return { session };
}

// POST: validate an uploaded workbook. confirm:false -> preview only; confirm:true -> import.
export async function POST(req: NextRequest) {
  try {
    const gate = await requireFinance();
    if (gate.error) return gate.error;
    const { session } = gate;

    const body = await req.json().catch(() => null);
    const fileBase64: string = body?.fileBase64 ?? '';
    const confirm: boolean = body?.confirm === true;
    const decisions: Record<string, 'allow' | 'deny'> = body?.decisions ?? {};
    const filename: string = String(body?.filename ?? 'import.xlsx');
    if (!fileBase64) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buf = Buffer.from(fileBase64, 'base64');
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 });
    }

    const org = await getOrgSettings();
    let parsed;
    try {
      parsed = await parseFinanceFile(buf, org);
    } catch {
      return NextResponse.json({ error: 'Could not read the file — make sure it is a valid .xlsx' }, { status: 400 });
    }

    // Existing budgets, grouped by year::item, to detect conflicts.
    const existing = await db
      .select()
      .from(entries)
      .where(and(eq(entries.department, 'finance'), eq(entries.formType, 'budget')));
    const existingByKey = new Map<string, { ids: number[]; amount: number }>();
    for (const r of existing) {
      const p = r.payload as Record<string, unknown>;
      const key = budKey(p.year, p.item);
      const e = existingByKey.get(key) ?? { ids: [], amount: 0 };
      e.ids.push(r.id);
      e.amount += num(p.amount);
      existingByKey.set(key, e);
    }

    const budgetNew = parsed.budget.valid.filter((b) => !existingByKey.has(budKey(b.data.year, b.data.item)));
    const budgetConflicts = parsed.budget.valid
      .filter((b) => existingByKey.has(budKey(b.data.year, b.data.item)))
      .map((b) => ({
        rowNum: b.rowNum,
        data: b.data,
        key: budKey(b.data.year, b.data.item),
        existingAmount: existingByKey.get(budKey(b.data.year, b.data.item))!.amount,
      }));

    // ---- Preview ----
    if (!confirm) {
      return NextResponse.json({
        ok: true,
        preview: true,
        expenses: { valid: parsed.expenses.valid, errors: parsed.expenses.errors },
        budget: { newRows: budgetNew, conflicts: budgetConflicts, errors: parsed.budget.errors },
      });
    }

    // ---- Commit ----
    const batchId = randomUUID();
    const uploadedAt = new Date().toISOString();
    const uploadedBy = session.user.name || session.user.role || 'unknown';
    const tag = { source: 'import', batchId };

    const toInsert: { department: string; formType: string; payload: Record<string, unknown> }[] = [];
    for (const e of parsed.expenses.valid) {
      toInsert.push({ department: 'finance', formType: 'expenses', payload: clean({ ...e.data, ...tag }) });
    }

    let budgetAdded = 0;
    let budgetUpdated = 0;
    let budgetSkipped = 0;
    const idsToDelete: number[] = [];
    for (const b of parsed.budget.valid) {
      const key = budKey(b.data.year, b.data.item);
      if (existingByKey.has(key)) {
        if ((decisions[key] ?? 'deny') === 'allow') {
          idsToDelete.push(...existingByKey.get(key)!.ids);
          toInsert.push({ department: 'finance', formType: 'budget', payload: clean({ ...b.data, ...tag, replaced: true }) });
          budgetUpdated++;
        } else {
          budgetSkipped++;
        }
      } else {
        toInsert.push({ department: 'finance', formType: 'budget', payload: clean({ ...b.data, ...tag }) });
        budgetAdded++;
      }
    }

    if (idsToDelete.length) await db.delete(entries).where(inArray(entries.id, idsToDelete));
    if (toInsert.length) await db.insert(entries).values(toInsert);

    const result = {
      batchId,
      filename,
      uploadedBy,
      uploadedAt,
      expensesAdded: parsed.expenses.valid.length,
      budgetAdded,
      budgetUpdated,
      budgetSkipped,
      expenseErrors: parsed.expenses.errors.length,
      budgetErrors: parsed.budget.errors.length,
    };
    await db.insert(entries).values({ department: 'finance', formType: 'import-log', payload: result });

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE: undo an import — removes the rows it inserted (and its log) by batchId.
// Note: budget figures overwritten during that import are not restored.
export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireFinance();
    if (gate.error) return gate.error;
    const batchId = req.nextUrl.searchParams.get('batchId');
    if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 });
    const deleted = await db
      .delete(entries)
      .where(and(eq(entries.department, 'finance'), sql`(${entries.payload} ->> 'batchId') = ${batchId}`))
      .returning({ id: entries.id });
    return NextResponse.json({ ok: true, deleted: deleted.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
