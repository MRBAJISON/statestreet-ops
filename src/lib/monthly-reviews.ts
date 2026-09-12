import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { AppUser } from './auth';
import { db } from './db';
import { categories } from './db/foundation-schema';
import type {
  MonthlyScopeInput,
  SaveMonthlyReviewInput,
  MonthlyActionInput,
} from './contracts/monthly-review';
import {
  accessibleStores,
  allTradingStores,
  groupsForStores,
} from './store-access';
import { HttpError, sessionUserId } from './server-errors';
import {
  getStorePeriodReport,
  targetForRange,
} from './reporting/store-period-report';
import { getProductPerformance } from './reporting/product-performance';
import {
  getWeeklyReviewContext,
  weeksOverlappingMonth,
} from './reporting/weekly-review-context';
import {
  generateMonthlySummary,
  type SummaryEvidence,
} from './reporting/monthly-summary';
import {
  resolveStorePeriod,
  tradingDaysBetween,
} from './reporting/store-period';
import { getOrgSettings } from './org-server';

export const PERFORMANCE_READERS = new Set([
  'owner',
  'finance',
  'commercial',
  'operations',
  'inventory',
  'store-manager',
]);
export interface MonthlyReviewRecord {
  id: number;
  status: 'draft' | 'submitted';
  lockVersion: number;
  executiveSummary: string;
  generatedSummary: string;
  sourceHash: string | null;
  sourceReferences: { id: string; hash?: string }[];
  confirmedAt: string | null;
  managementOutcomes: string;
  operationalAssessment: string;
  conclusion: string;
  storeComments: Record<string, string>;
  advisors: SaveMonthlyReviewInput['advisors'];
  actions: MonthlyActionInput[];
}
export async function monthlyScopeOptions(user: AppUser) {
  if (!PERFORMANCE_READERS.has(user.role))
    throw new HttpError(403, 'Forbidden');
  const options =
    user.role === 'store-manager'
      ? await accessibleStores(user)
      : await allTradingStores();
  return {
    stores: options,
    groups: await groupsForStores(options.map((s) => s.id)),
  };
}
export async function authorizeMonthlyScope(
  user: AppUser,
  scope: MonthlyScopeInput,
  write = false
) {
  if (user.role === 'inventory')
    throw new HttpError(
      403,
      'Monthly financial reviews are outside this department'
    );
  if (write && user.role !== 'store-manager')
    throw new HttpError(403, 'Only store managers can write monthly reviews');
  if (!PERFORMANCE_READERS.has(user.role))
    throw new HttpError(403, 'Forbidden');
  const options = await monthlyScopeOptions(user);
  if (
    write &&
    scope.storeId &&
    options.groups.some((group) => group.storeIds.includes(scope.storeId!))
  )
    throw new HttpError(
      403,
      'Use the combined monthly review for this configured cluster'
    );
  if (scope.groupId) {
    const group = options.groups.find((g) => g.id === scope.groupId);
    if (!group)
      throw new HttpError(403, 'This cluster is not available to this account');
    const members = options.stores.filter((s) => group.storeIds.includes(s.id));
    return {
      name: group.name,
      storeIds: members.map((s) => s.id),
      stores: members,
    };
  }
  const store = options.stores.find((s) => s.id === scope.storeId);
  if (!store)
    throw new HttpError(403, 'This store is not available to this account');
  return { name: store.name, storeIds: [store.id], stores: [store] };
}
function scopeCondition(scope: MonthlyScopeInput) {
  return scope.groupId
    ? sql`review.group_id=${scope.groupId}`
    : sql`review.store_id=${scope.storeId}`;
}
export async function readMonthlyRecord(
  scope: MonthlyScopeInput
): Promise<MonthlyReviewRecord | null> {
  const result =
    await db.execute(sql`select jsonb_build_object('id',review.id,'status',review.status,'lockVersion',review.lock_version,
    'executiveSummary',review.executive_summary,'generatedSummary',review.generated_summary,'sourceHash',review.source_hash,'sourceReferences',review.source_references,'confirmedAt',review.confirmed_at,
    'managementOutcomes',review.management_outcomes,'operationalAssessment',review.operational_assessment,'conclusion',review.conclusion,'storeComments',review.store_comments,
    'advisors',coalesce((select jsonb_agg(jsonb_build_object('storeId',store_id,'name',name,'actualSales',actual_sales::text,'target',target::text) order by id) from monthly_review_advisors where monthly_review_id=review.id),'[]'::jsonb),
    'actions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'storeId',store_id,'action',action,'outcome',outcome,'ownerName',owner_name,'dueDate',due_date,'goal',goal,'status',status,'progress',progress) order by due_date,id) from monthly_review_actions where monthly_review_id=review.id),'[]'::jsonb)) as record
    from monthly_reviews review where ${scopeCondition(scope)} and month=${scope.month}::date`);
  return (
    (result.rows[0] as { record: MonthlyReviewRecord } | undefined)?.record ??
    null
  );
}

function actionEvidenceHash(actions: MonthlyActionInput[]) {
  const values = actions
    .map((a) => ({
      id: a.id,
      storeId: a.storeId ?? null,
      action: a.action,
      outcome: a.outcome,
      ownerName: a.ownerName,
      dueDate: a.dueDate,
      goal: a.goal,
      status: a.status,
      progress: a.progress,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

export async function getMonthlyReviewContext(
  user: AppUser,
  scope: MonthlyScopeInput
) {
  const authorized = await authorizeMonthlyScope(user, scope);
  const range = resolveStorePeriod('month', scope.month).range;
  const weeks = weeksOverlappingMonth(scope.month);
  const nextDate = new Date(`${scope.month}T00:00:00Z`);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
  const nextRange = resolveStorePeriod(
    'month',
    nextDate.toISOString().slice(0, 10)
  ).range;
  const [
    reports,
    performance,
    weeklyReviews,
    review,
    categoryRows,
    nextTargets,
    carryResult,
    org,
  ] = await Promise.all([
    Promise.all(
      authorized.storeIds.map((id) =>
        getStorePeriodReport(id, 'month', scope.month, { includeEmpty: true })
      )
    ),
    getProductPerformance(authorized.storeIds, range.from, range.to),
    getWeeklyReviewContext(authorized.storeIds, range.from, range.to),
    readMonthlyRecord(scope),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(categories.id),
    Promise.all(
      authorized.storeIds.map(async (storeId) => ({
        storeId,
        target: await targetForRange(storeId, nextRange.from, nextRange.to),
      }))
    ),
    db.execute(sql`select action.id,action.store_id::integer as "storeId",action.action,action.outcome,action.owner_name as "ownerName",action.due_date::text as "dueDate",
      action.goal,action.status,action.progress,review.month::text as "originMonth" from monthly_review_actions action join monthly_reviews review on review.id=action.monthly_review_id
      where ${scopeCondition(scope)} and review.month<${scope.month}::date and (
        (review.status='submitted' and action.status in ('open','in-progress')) or exists(
          select 1 from monthly_review_action_links link join monthly_reviews linked on linked.id=link.monthly_review_id
          where link.action_id=action.id and linked.month=${scope.month}::date
            and ${scope.groupId ? sql`linked.group_id=${scope.groupId}` : sql`linked.store_id=${scope.storeId}`}
        )) order by action.due_date,action.id`),
    getOrgSettings(),
  ]);
  const missing: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const [index, store] of authorized.stores.entries()) {
    const report = reports[index];
    for (const day of report?.outstanding ??
      tradingDaysBetween(range.from, range.to).map((date) => ({
        date,
        reason: 'missing',
      })))
      missing.push(`${store.name}: daily report ${day.date} (${day.reason})`);
    for (const week of weeks) {
      const found = weeklyReviews.find(
        (r) =>
          r.storeId === store.id &&
          r.weekFrom === week.from &&
          r.status !== 'draft'
      );
      if (week.to > today || !found)
        missing.push(
          `${store.name}: weekly review ${week.from} - ${week.to}${week.to > today ? ' (week not finished)' : ''}`
        );
    }
  }
  const storeResults = authorized.stores.map((store, index) => ({
    store,
    report: reports[index],
  }));
  const totalSales = reports.reduce(
    (sum, r) => sum + (r?.totals.netRevenue ?? 0),
    0
  );
  const totalTarget = reports.reduce((sum, r) => sum + (r?.target ?? 0), 0);
  const evidence: SummaryEvidence[] = weeklyReviews
    .filter((w) => w.status !== 'draft')
    .flatMap((w) => [
      ...(w.summary
        ? [
            {
              id: `weekly:${w.id}:summary`,
              label: `${w.storeName}, ${w.weekFrom} - ${w.weekTo}`,
              text: w.summary,
            },
          ]
        : []),
      ...(w.risks
        ? [
            {
              id: `weekly:${w.id}:risks`,
              label: `${w.storeName}, weekly risks`,
              text: w.risks,
            },
          ]
        : []),
      ...w.categoryNotes
        .filter((n) => n.performanceComment)
        .map((n) => ({
          id: `weekly:${w.id}:category:${n.categoryId}`,
          label: `${w.storeName}, ${w.weekFrom}, ${categoryRows.find((c) => c.id === n.categoryId)?.name ?? 'Category review'}`,
          text: n.performanceComment!,
        })),
    ]);
  const riskIncomplete = performance.rows.some(
    (r) => r.riskValue === null || (r.quantity > 0 && !r.historyComplete)
  );
  const riskValue = riskIncomplete
    ? null
    : performance.rows
        .reduce((sum, r) => sum + Number(r.riskValue ?? 0), 0)
        .toFixed(2);
  const summary = generateMonthlySummary({
    currency: org.currency,
    label: range.label,
    stores: storeResults.map(({ store, report }) => ({
      name: store.name,
      netRevenue: report?.totals.netRevenue ?? 0,
      target: report?.target ?? 0,
      units: report?.totals.unitsSold ?? 0,
      transactions: report?.totals.transactions ?? 0,
      footfall: report?.totals.footfall ?? 0,
    })),
    evidence,
    bestProduct: performance.rows.find((r) => r.unitsSold > 0)?.name,
    lowProduct: [...performance.rows]
      .filter((r) => r.unitsSold > 0)
      .sort(
        (a, b) =>
          a.unitsSold - b.unitsSold ||
          Number(a.salesValue) - Number(b.salesValue)
      )
      .map(
        (r) =>
          `${r.name} at ${r.storeName} (${r.unitsSold} unit(s), ${org.currency} ${Number(r.salesValue).toFixed(2)} recorded sales${r.observationDays < 30 ? '; under 30 observed days' : ''}${!r.historyComplete ? '; limited history' : ''})`
      )[0],
    nonMovingCount: performance.rows.filter((r) => r.nonMoving).length,
    riskValue,
    weeks: weeks.map((week) => ({
      label: `${week.from} - ${week.to}`,
      sales: reports.reduce(
        (sum, r) =>
          sum +
          (r?.days
            .filter((d) => d.date >= week.from && d.date <= week.to)
            .reduce((s, d) => s + d.netRevenue, 0) ?? 0),
        0
      ),
    })),
    categories: categoryRows.map((c) => ({
      name: c.name,
      sales: reports.reduce(
        (sum, r) =>
          sum +
          (r?.categories.find((v) => v.categoryId === c.id)?.netRevenue ?? 0),
        0
      ),
    })),
    customerRequests: reports.reduce(
      (sum, r) => sum + (r?.customerRequests.length ?? 0),
      0
    ),
    actions: weeklyReviews
      .filter((w) => w.status !== 'draft')
      .flatMap((w) => w.actions).length,
  });
  const sources = {
    // Approval alone must not revoke an otherwise eligible submitted report.
    // Also exclude today's debtor balance: a later collection is not a correction
    // of the selected month's sales or supporting narrative.
    storeResults: storeResults.map(({ store, report }) => ({
      store,
      report: report
        ? {
            ...report,
            days: report.days.map((day) => ({
              ...day,
              status:
                day.status === 'draft'
                  ? 'draft'
                  : day.status
                    ? 'eligible'
                    : null,
            })),
            transactionSummary: {
              ...report.transactionSummary,
              openCreditBalance: undefined,
            },
          }
        : null,
    })),
    performance,
    weeklyReviews: weeklyReviews.map((review) => ({
      ...review,
      status: review.status === 'draft' ? 'draft' : 'eligible',
      lockVersion: undefined,
      updatedAt: undefined,
    })),
    nextTargets,
    categoryRows,
    currency: org.currency,
  };
  const sourceHash = createHash('sha256')
    .update(JSON.stringify(sources))
    .digest('hex');
  const narrativeCurrent = Boolean(
    review?.confirmedAt &&
      review.sourceHash === sourceHash &&
      review.sourceReferences.find(
        (source) => source.id === 'monthly-action-check'
      )?.hash ===
        actionEvidenceHash([
          ...review.actions,
          ...(carryResult.rows as MonthlyActionInput[]),
        ])
  );
  return {
    scope,
    name: authorized.name,
    currency: org.currency,
    range,
    nextRange,
    stores: storeResults,
    weeks,
    weeklyReviews,
    performance,
    review,
    categories: categoryRows,
    nextTargets,
    carriedActions: carryResult.rows as (MonthlyActionInput & {
      originMonth: string;
    })[],
    summary,
    sourceHash,
    missing,
    narrativeCurrent,
    ready:
      missing.length === 0 &&
      review?.status === 'submitted' &&
      narrativeCurrent,
    totalSales,
    totalTarget,
  };
}
export type MonthlyReviewContext = Awaited<
  ReturnType<typeof getMonthlyReviewContext>
>;

export async function saveMonthlyReview(
  user: AppUser,
  input: SaveMonthlyReviewInput
) {
  const scope = await authorizeMonthlyScope(user, input.scope, true);
  const context = await getMonthlyReviewContext(user, input.scope);
  if (context.review?.status === 'submitted')
    throw new HttpError(
      409,
      'Reopen the submitted monthly review before editing'
    );
  if (input.status === 'submitted' && context.missing.length)
    throw new HttpError(409, context.missing.join('; '));
  if (
    (input.confirmNarrative || input.status === 'submitted') &&
    input.sourceHash !== context.sourceHash
  )
    throw new HttpError(
      409,
      'Source records changed. Refresh and check the summary again.'
    );
  if (
    input.advisors.some((a) => !scope.storeIds.includes(a.storeId)) ||
    input.actions.some(
      (a) => a.storeId !== null && !scope.storeIds.includes(a.storeId)
    ) ||
    Object.keys(input.storeComments).some(
      (id) => !scope.storeIds.includes(Number(id))
    )
  )
    throw new HttpError(403, 'A selected store is outside this report');
  if (
    input.carriedActions.some(
      (a) => !context.carriedActions.some((c) => c.id === a.id)
    )
  )
    throw new HttpError(
      409,
      'A carried action changed or is outside this review'
    );
  const currentIds = new Set(context.review?.actions.map((a) => a.id));
  const removedIds = [...currentIds].filter(
    (id) => !input.actions.some((action) => action.id === id)
  );
  if (removedIds.length) {
    const linked = await db.execute(
      sql`select action_id from monthly_review_action_links where action_id in(select value::uuid from jsonb_array_elements_text(${JSON.stringify(removedIds)}::jsonb)) limit 1`
    );
    if (linked.rows.length)
      throw new HttpError(
        409,
        'A priority has been carried into another review. Mark it cancelled instead of removing its history.'
      );
  }
  const otherIds = input.actions
    .filter((a) => !currentIds.has(a.id))
    .map((a) => a.id);
  if (otherIds.length) {
    const collisions = await db.execute(
      sql`select id from monthly_review_actions where id in(select value::uuid from jsonb_array_elements_text(${JSON.stringify(otherIds)}::jsonb))`
    );
    if (collisions.rows.length)
      throw new HttpError(409, 'An action identifier is already in use');
  }
  const actor = sessionUserId(user.id);
  const sourceReferences = [
    ...context.summary.evidence,
    {
      id: 'monthly-action-check',
      hash: actionEvidenceHash([
        ...input.actions,
        ...context.carriedActions.map((action) => {
          const edit = input.carriedActions.find((a) => a.id === action.id);
          return edit
            ? { ...action, status: edit.status, progress: edit.progress }
            : action;
        }),
      ]),
    },
  ];
  // Keep a link even if an earlier action is later completed or cancelled.
  const carriedLinks = JSON.stringify(
    context.carriedActions.map((action) => ({ id: action.id }))
  );
  const advisors = JSON.stringify(input.advisors),
    actions = JSON.stringify(input.actions),
    carried = JSON.stringify(input.carriedActions);
  const result = await db.execute(sql`
    with carried_before as materialized (select action.* from monthly_review_actions action
      join jsonb_to_recordset(${carried}::jsonb) as item(id uuid) on item.id=action.id order by action.id for update of action),
    carry_guard as(select count(*)=jsonb_array_length(${carried}::jsonb) as valid from carried_before action
      join jsonb_to_recordset(${carried}::jsonb) as item(id uuid,"expectedStatus" text,"expectedProgress" text) on item.id=action.id
      where action.status=item."expectedStatus" and action.progress=item."expectedProgress"),
    before_review as materialized (select * from monthly_reviews review where ${scopeCondition(input.scope)} and month=${input.scope.month}::date for update),
    inserted as (insert into monthly_reviews(store_id,group_id,month,created_by_user_id,updated_by_user_id,executive_summary,generated_summary,management_outcomes,operational_assessment,conclusion,store_comments,source_hash,source_references,confirmed_at,status,submitted_at)
      select ${input.scope.storeId ?? null},${input.scope.groupId ?? null},${input.scope.month},${actor},${actor},${input.executiveSummary},${JSON.stringify(context.summary)},${input.managementOutcomes},${input.operationalAssessment},${input.conclusion},${JSON.stringify(input.storeComments)}::jsonb,
        ${input.confirmNarrative ? context.sourceHash : null},${JSON.stringify(sourceReferences)}::jsonb,case when ${input.confirmNarrative} then now() else null end,${input.status},case when ${input.status}='submitted' then now() else null end
      where not exists(select 1 from before_review) and (select valid from carry_guard)
      on conflict do nothing returning *),
    selected as (select * from before_review where status='draft' and lock_version=${input.lockVersion ?? null} and (select valid from carry_guard)),
    changed as (update monthly_reviews review set executive_summary=${input.executiveSummary},generated_summary=${JSON.stringify(context.summary)},
      management_outcomes=${input.managementOutcomes},operational_assessment=${input.operationalAssessment},conclusion=${input.conclusion},store_comments=${JSON.stringify(input.storeComments)}::jsonb,
      source_hash=${input.confirmNarrative ? context.sourceHash : null},source_references=${JSON.stringify(sourceReferences)}::jsonb,
      confirmed_at=case when ${input.confirmNarrative} then now() else null end,status=${input.status},submitted_at=case when ${input.status}='submitted' then now() else null end,
      updated_by_user_id=${actor},updated_at=now(),lock_version=review.lock_version+1 from selected where review.id=selected.id returning review.*),
    updated as(select * from inserted union all select * from changed),
    removed_advisors as (delete from monthly_review_advisors where monthly_review_id in (select id from updated) returning id),
    advisor_marker as (select count(*) from removed_advisors),
    added_advisors as (insert into monthly_review_advisors(monthly_review_id,store_id,name,actual_sales,target)
      select review.id,item."storeId",item.name,item."actualSales",item.target from updated review cross join advisor_marker cross join jsonb_to_recordset(${advisors}::jsonb) as item("storeId" bigint,name text,"actualSales" numeric,target numeric)),
    removed_actions as (delete from monthly_review_actions where monthly_review_id in(select id from updated) and id not in(select (value->>'id')::uuid from jsonb_array_elements(${actions}::jsonb))),
    added_actions as (insert into monthly_review_actions(id,monthly_review_id,store_id,action,outcome,owner_name,due_date,goal,status,progress)
      select item.id,review.id,item."storeId",item.action,item.outcome,item."ownerName",item."dueDate",item.goal,item.status,item.progress
      from updated review cross join jsonb_to_recordset(${actions}::jsonb) as item(id uuid,"storeId" bigint,action text,outcome text,"ownerName" text,"dueDate" date,goal text,status text,progress text)
      on conflict(id) do update set store_id=excluded.store_id,action=excluded.action,outcome=excluded.outcome,owner_name=excluded.owner_name,due_date=excluded.due_date,goal=excluded.goal,status=excluded.status,progress=excluded.progress,updated_at=now()
      where monthly_review_actions.monthly_review_id=excluded.monthly_review_id),
    carried_updates as (update monthly_review_actions action set status=item.status,progress=item.progress,updated_at=now()
      from jsonb_to_recordset(${carried}::jsonb) as item(id uuid,status text,progress text) where action.id=item.id and exists(select 1 from updated)),
    linked_actions as (insert into monthly_review_action_links(monthly_review_id,action_id)
      select review.id,item.id from updated review cross join jsonb_to_recordset(${carriedLinks}::jsonb) as item(id uuid)
      on conflict do nothing),
    audit as (insert into audit_events(entity_type,entity_id,action,actor_user_id,before,after)
      select 'monthly-review',review.id,${input.status === 'submitted' ? 'submit' : 'update'},${actor},${JSON.stringify(context.review)}::jsonb,
        jsonb_build_object('review',to_jsonb(review),'advisors',${advisors}::jsonb,'actions',${actions}::jsonb,'carriedActions',${carried}::jsonb) from updated review)
    select id,lock_version as "lockVersion" from updated`);
  if (!result.rows.length)
    throw new HttpError(409, 'Monthly review changed; reload before saving');
  return result.rows[0];
}

export async function reopenMonthlyReview(
  user: AppUser,
  scope: MonthlyScopeInput,
  lockVersion: number,
  reason: string
) {
  await authorizeMonthlyScope(user, scope, true);
  if (!reason.trim()) throw new HttpError(400, 'Give a reason for reopening');
  const result =
    await db.execute(sql`with before_review as materialized(select * from monthly_reviews review where ${scopeCondition(scope)} and month=${scope.month}::date and status='submitted' and lock_version=${lockVersion} for update),
    updated as(update monthly_reviews review set status='draft',confirmed_at=null,updated_at=now(),updated_by_user_id=${sessionUserId(user.id)},lock_version=review.lock_version+1 from before_review before where review.id=before.id returning review.*),
    audit as(insert into audit_events(entity_type,entity_id,action,actor_user_id,before,after,metadata) select 'monthly-review',updated.id,'reopen',${sessionUserId(user.id)},to_jsonb(before),to_jsonb(updated),jsonb_build_object('reason',${reason}::text) from updated join before_review before using(id)) select id from updated`);
  if (!result.rows.length)
    throw new HttpError(409, 'Review changed or is not submitted');
}
