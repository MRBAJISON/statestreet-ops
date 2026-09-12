import { sql } from 'drizzle-orm';
import { db } from '../db';
import type { WeeklyReviewRecord } from '../contracts/documents';
import { resolveStorePeriod, tradingDaysBetween } from './store-period';

export function weeksOverlappingMonth(month: string) {
  const range = resolveStorePeriod('month', month).range;
  const weeks = new Map<string, { from: string; to: string }>();
  for (const day of tradingDaysBetween(range.from, range.to)) {
    const week = resolveStorePeriod('week', day).range;
    weeks.set(week.from, { from: week.from, to: week.to });
  }
  return [...weeks.values()];
}
export interface WeeklyReviewContext extends WeeklyReviewRecord {
  weekFrom: string;
  weekTo: string;
}
export async function getWeeklyReviewContext(
  storeIds: number[],
  from: string,
  to: string
): Promise<WeeklyReviewContext[]> {
  if (!storeIds.length) return [];
  const ids = sql`array[${sql.join(
    storeIds.map((id) => sql`${id}::bigint`),
    sql`, `
  )}]`;
  const result = await db.execute(sql`
    select distinct on (review.store_id,date_trunc('week',review.week_end)) jsonb_build_object(
      'id',review.id,'storeId',review.store_id,'storeName',store.name,'weekEnd',review.week_end,'status',review.status,
      'weekFrom',date_trunc('week',review.week_end)::date,'weekTo',date_trunc('week',review.week_end)::date+5,
      'summary',review.summary,'risks',review.risks,'opportunities',review.opportunities,'differentThisWeek',review.different_this_week,
      'firstThreeActions',review.first_three_actions,'marketingAmplifyCategoryId',review.marketing_amplify_category_id,
      'lockVersion',review.lock_version,'updatedAt',review.updated_at,
      'categoryNotes',coalesce((select jsonb_agg(jsonb_build_object('id',note.id,'categoryId',note.category_id,'performanceComment',note.performance_comment,
        'overstocked',note.overstocked,'slowMoving',note.slow_moving,'weeksWithoutMovement',note.weeks_without_movement,'valueAtRisk',note.value_at_risk::text,
        'correctiveAction',note.corrective_action,'managerComment',note.manager_comment) order by note.category_id) from weekly_review_category_notes note where note.weekly_review_id=review.id),'[]'::jsonb),
      'actions',coalesce((select jsonb_agg(jsonb_build_object('id',action.id,'categoryId',action.category_id,'productId',action.product_id,'action',action.action,
        'ownerUserId',action.owner_user_id,'ownerName',action.owner_name,'targetUnits',action.target_units,'targetRevenue',action.target_revenue::text,
        'dueDate',action.due_date,'status',action.status,'managerComment',action.manager_comment) order by action.id) from weekly_review_actions action where action.weekly_review_id=review.id),'[]'::jsonb)
    ) as record from weekly_reviews review join stores store on store.id=review.store_id
    where review.store_id=any(${ids}) and date_trunc('week',review.week_end)::date<=${to}::date
      and date_trunc('week',review.week_end)::date+5>=${from}::date
    order by review.store_id,date_trunc('week',review.week_end),review.updated_at desc,review.id desc`);
  return result.rows.map(
    (row) => (row as { record: WeeklyReviewContext }).record
  );
}
