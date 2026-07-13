import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { budgets, importBatches } from '@/lib/db/foundation-schema';
import {
  buildCommitFinanceImportQuery,
  buildUndoFinanceImportQuery,
  FinanceImportFileError,
  loadFinanceImportReferences,
  parseFinanceFile,
  planBudgetImport,
  staleAllowedBudgetDecisions,
  type ExistingBudgetForImport,
} from '@/lib/import-finance';

export const runtime = 'nodejs';

const MAX_BYTES = 5_000_000;

async function requireFinance() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!session.departments.includes('finance')) {
    return { error: NextResponse.json({ error: 'Finance access required' }, { status: 403 }) };
  }
  return { session };
}

function safeFilename(value: unknown): string {
  const lastSegment = String(value ?? 'import.xlsx').split(/[\\/]/).pop()?.trim() || 'import.xlsx';
  return lastSegment.slice(0, 255);
}

function decisionsFrom(value: unknown): Record<string, 'allow' | 'deny'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, 'allow' | 'deny'] => {
      return entry[1] === 'allow' || entry[1] === 'deny';
    })
  );
}

function postgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code ?? candidate.cause?.code;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasImportIssue(issues: unknown, reason: string): boolean {
  return (
    Array.isArray(issues) &&
    issues.some(
      (issue) =>
        issue &&
        typeof issue === 'object' &&
        (issue as { reason?: unknown }).reason === reason
    )
  );
}

// GET: typed import history for the current or redesigned Finance import client.
export async function GET() {
  const gate = await requireFinance();
  if (gate.error) return gate.error;

  const rows = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.type, 'finance'))
    .orderBy(desc(importBatches.createdAt))
    .limit(50);
  const batches = rows.map((row) => {
    const summary = record(row.summary);
    return {
      id: row.id,
      batchId: String(row.id),
      filename: row.filename,
      status: row.status,
      uploadedBy: summary.uploadedBy ?? '',
      uploadedAt: row.createdAt,
      undoneAt: row.undoneAt,
      canUndo: row.status === 'completed',
      expensesAdded: Number(summary.expensesAdded ?? 0),
      budgetAdded: Number(summary.budgetAdded ?? 0),
      budgetUpdated: Number(summary.budgetUpdated ?? 0),
      budgetSkipped: Number(summary.budgetSkipped ?? 0),
      expenseErrors: Number(summary.expenseErrors ?? 0),
      budgetErrors: Number(summary.budgetErrors ?? 0),
    };
  });

  return NextResponse.json({
    ok: true,
    batches,
    // Entry-like records ease the transition for clients that already render payload summaries.
    entries: batches.map((batch) => ({ id: batch.id, payload: batch })),
  });
}

// POST: confirm:false previews; confirm:true atomically writes typed Finance records.
export async function POST(request: NextRequest) {
  try {
    const gate = await requireFinance();
    if (gate.error) return gate.error;
    const { session } = gate;

    const body = await request.json().catch(() => null);
    const fileBase64 = typeof body?.fileBase64 === 'string' ? body.fileBase64 : '';
    const confirm = body?.confirm === true;
    const decisions = decisionsFrom(body?.decisions);
    const filename = safeFilename(body?.filename);
    if (!fileBase64) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (fileBase64.length > Math.ceil((MAX_BYTES * 4) / 3) + 8) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    if (!buffer.byteLength) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 });
    }

    const references = await loadFinanceImportReferences();
    let parsed;
    try {
      parsed = await parseFinanceFile(buffer, references);
    } catch (error) {
      if (error instanceof FinanceImportFileError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json(
        { error: 'Could not read the file - make sure it is a valid .xlsx' },
        { status: 400 }
      );
    }

    const existingBudgets = (await db
      .select()
      .from(budgets)
      .where(isNull(budgets.storeId))) as ExistingBudgetForImport[];
    const budgetPlan = planBudgetImport(parsed.budget.valid, existingBudgets, confirm ? decisions : {});
    if (confirm && staleAllowedBudgetDecisions(decisions, budgetPlan.conflicts).length) {
      return NextResponse.json(
        { error: 'An allowed budget overwrite changed after preview. Preview the file again.' },
        { status: 409 }
      );
    }

    if (!confirm) {
      return NextResponse.json({
        ok: true,
        preview: true,
        expenses: parsed.expenses,
        budget: {
          newRows: budgetPlan.newRows,
          conflicts: budgetPlan.conflicts,
          errors: parsed.budget.errors,
        },
      });
    }

    const actorUserId = Number(session.user.id);
    if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
      return NextResponse.json({ error: 'Invalid session user' }, { status: 401 });
    }
    const appliedRows = parsed.expenses.valid.length + budgetPlan.writes.length;
    if (!appliedRows) {
      return NextResponse.json({ error: 'No valid rows selected for import' }, { status: 400 });
    }

    const query = buildCommitFinanceImportQuery({
      filename,
      actorUserId,
      actorName: session.user.name || session.user.role || 'unknown',
      parsed,
      budgetWrites: budgetPlan.writes,
      budgetSkipped: budgetPlan.skipped,
    });
    const queryResult = await db.execute(query);
    const row = queryResult.rows[0] as
      | {
          issue_count?: number | string;
          issues?: unknown;
          batch_id?: string | null;
          uploaded_at?: Date | string | null;
          summary?: unknown;
          ledger_rows?: number | string;
          row_audit_rows?: number | string;
          batch_audit_rows?: number | string;
        }
      | undefined;
    if (!row) throw new Error('Finance import returned no result');
    if (Number(row.issue_count ?? 0) > 0 || !row.batch_id) {
      const overspendReasonRequired = hasImportIssue(row.issues, 'overspend-reason-required');
      return NextResponse.json(
        {
          error: overspendReasonRequired
            ? 'One or more expenses exceed their annual budget. Add an Overspend Reason to those workbook rows and preview again.'
            : 'Reference data or budgets changed while the import was being confirmed. Preview the file again.',
          conflicts: row.issues ?? [],
        },
        { status: 409 }
      );
    }
    if (
      Number(row.ledger_rows ?? 0) !== appliedRows ||
      Number(row.row_audit_rows ?? 0) !== appliedRows ||
      Number(row.batch_audit_rows ?? 0) !== 1
    ) {
      throw new Error('Finance import audit verification failed');
    }

    const summary = record(row.summary);
    const result = {
      batchId: row.batch_id,
      filename,
      uploadedBy: summary.uploadedBy ?? session.user.name,
      uploadedAt: row.uploaded_at,
      expensesAdded: Number(summary.expensesAdded ?? 0),
      budgetAdded: Number(summary.budgetAdded ?? 0),
      budgetUpdated: Number(summary.budgetUpdated ?? 0),
      budgetSkipped: Number(summary.budgetSkipped ?? 0),
      expenseErrors: Number(summary.expenseErrors ?? 0),
      budgetErrors: Number(summary.budgetErrors ?? 0),
    };
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const code = postgresCode(error);
    if (code === '23505' || code === '23503') {
      return NextResponse.json(
        { error: 'Reference data or budgets changed while the import was being confirmed. Preview the file again.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Finance import failed without saving any rows' }, { status: 500 });
  }
}

// DELETE: undo the complete batch only when every typed row still matches its import snapshot.
export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireFinance();
    if (gate.error) return gate.error;
    const { session } = gate;

    const batchId = Number(request.nextUrl.searchParams.get('batchId'));
    if (!Number.isSafeInteger(batchId) || batchId <= 0) {
      return NextResponse.json({ error: 'A numeric typed batchId is required' }, { status: 400 });
    }
    const actorUserId = Number(session.user.id);
    if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
      return NextResponse.json({ error: 'Invalid session user' }, { status: 401 });
    }

    const queryResult = await db.execute(buildUndoFinanceImportQuery(batchId, actorUserId));
    const row = queryResult.rows[0] as
      | {
          batch_found?: boolean;
          status?: string | null;
          expected_rows?: number | string;
          ledger_rows?: number | string;
          unsafe_rows?: number | string;
          conflicts?: unknown;
          deleted_rows?: number | string;
          restored_rows?: number | string;
          updated_batches?: number | string;
          batch_audit_rows?: number | string;
        }
      | undefined;
    if (!row?.batch_found) {
      return NextResponse.json({ error: 'Finance import batch not found' }, { status: 404 });
    }
    if (row.status === 'undone') {
      return NextResponse.json({ error: 'This import batch has already been undone' }, { status: 409 });
    }
    if (row.status !== 'completed') {
      return NextResponse.json({ error: `Import batch cannot be undone from status ${row.status}` }, { status: 409 });
    }
    if (
      Number(row.unsafe_rows ?? 0) > 0 ||
      Number(row.expected_rows ?? 0) !== Number(row.ledger_rows ?? 0)
    ) {
      return NextResponse.json(
        {
          error: 'Undo refused because one or more imported rows were changed or removed after the import.',
          conflicts: row.conflicts ?? [],
        },
        { status: 409 }
      );
    }
    if (Number(row.updated_batches ?? 0) !== 1 || Number(row.batch_audit_rows ?? 0) !== 1) {
      throw new Error('Finance import undo audit verification failed');
    }

    const deleted = Number(row.deleted_rows ?? 0);
    const restored = Number(row.restored_rows ?? 0);
    return NextResponse.json({ ok: true, deleted, restored, affected: deleted + restored });
  } catch {
    return NextResponse.json({ error: 'Finance import undo failed without making a partial change' }, { status: 500 });
  }
}
