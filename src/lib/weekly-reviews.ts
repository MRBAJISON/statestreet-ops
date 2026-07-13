import { and, desc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { AppUser } from './auth';
import type { weeklyReviewSchema } from './contracts/documents';
import { db } from './db';
import { stores, weeklyReviewActions, weeklyReviews } from './db/foundation-schema';
import { weeklyReviewCategoryNotes } from './db/operational-schema';
import { HttpError, sessionUserId } from './server-errors';

type WeeklyReviewInput = z.infer<typeof weeklyReviewSchema>;

async function assignedStore(user: AppUser) {
  if (user.role !== 'store-manager' || !user.store) throw new HttpError(403, 'A store manager account is required');
  const [store] = await db
    .select({ id: stores.id, name: stores.name })
    .from(stores)
    .where(and(eq(stores.code, user.store), eq(stores.active, true), eq(stores.type, 'store')))
    .limit(1);
  if (!store) throw new HttpError(409, 'The assigned store is not active');
  return store;
}

export async function getWeeklyReview(user: AppUser, weekEnd?: string) {
  const store = await assignedStore(user);
  const conditions = [eq(weeklyReviews.storeId, store.id)];
  if (weekEnd) conditions.push(eq(weeklyReviews.weekEnd, weekEnd));
  const [review] = await db
    .select({
      id: weeklyReviews.id,
      storeId: weeklyReviews.storeId,
      weekEnd: weeklyReviews.weekEnd,
      status: weeklyReviews.status,
      summary: weeklyReviews.summary,
      risks: weeklyReviews.risks,
      opportunities: weeklyReviews.opportunities,
      marketingAmplifyCategoryId: weeklyReviews.marketingAmplifyCategoryId,
      differentThisWeek: weeklyReviews.differentThisWeek,
      firstThreeActions: weeklyReviews.firstThreeActions,
      lockVersion: weeklyReviews.lockVersion,
      updatedAt: weeklyReviews.updatedAt,
    })
    .from(weeklyReviews)
    .where(and(...conditions))
    .orderBy(desc(weeklyReviews.weekEnd), desc(weeklyReviews.updatedAt))
    .limit(1);
  if (!review) return null;

  const [categoryNotes, actions] = await Promise.all([
    db
      .select({
        id: weeklyReviewCategoryNotes.id,
        categoryId: weeklyReviewCategoryNotes.categoryId,
        performanceComment: weeklyReviewCategoryNotes.performanceComment,
        overstocked: weeklyReviewCategoryNotes.overstocked,
        slowMoving: weeklyReviewCategoryNotes.slowMoving,
        weeksWithoutMovement: weeklyReviewCategoryNotes.weeksWithoutMovement,
        valueAtRisk: weeklyReviewCategoryNotes.valueAtRisk,
        correctiveAction: weeklyReviewCategoryNotes.correctiveAction,
        managerComment: weeklyReviewCategoryNotes.managerComment,
      })
      .from(weeklyReviewCategoryNotes)
      .where(eq(weeklyReviewCategoryNotes.weeklyReviewId, review.id))
      .orderBy(weeklyReviewCategoryNotes.id),
    db
      .select({
        id: weeklyReviewActions.id,
        categoryId: weeklyReviewActions.categoryId,
        productId: weeklyReviewActions.productId,
        action: weeklyReviewActions.action,
        ownerUserId: weeklyReviewActions.ownerUserId,
        ownerName: weeklyReviewActions.ownerName,
        targetUnits: weeklyReviewActions.targetUnits,
        targetRevenue: weeklyReviewActions.targetRevenue,
        dueDate: weeklyReviewActions.dueDate,
        status: weeklyReviewActions.status,
        managerComment: weeklyReviewActions.managerComment,
      })
      .from(weeklyReviewActions)
      .where(eq(weeklyReviewActions.weeklyReviewId, review.id))
      .orderBy(weeklyReviewActions.id),
  ]);

  return {
    ...review,
    storeName: store.name,
    status: review.status as 'draft' | 'submitted' | 'approved',
    updatedAt: review.updatedAt.toISOString(),
    categoryNotes,
    actions,
  };
}

export async function saveWeeklyReview(user: AppUser, input: WeeklyReviewInput) {
  const store = await assignedStore(user);
  const actorUserId = sessionUserId(user.id);
  const categoryNotes = JSON.stringify(input.categoryNotes);
  const actions = JSON.stringify(input.actions);
  const result = await db.execute(sql`
    with before_review as materialized (
      select
        review.*,
        jsonb_build_object(
          'review', to_jsonb(review),
          'categoryNotes', coalesce((
            select jsonb_agg(to_jsonb(note) order by note.id)
            from weekly_review_category_notes note where note.weekly_review_id = review.id
          ), '[]'::jsonb),
          'actions', coalesce((
            select jsonb_agg(to_jsonb(action) order by action.id)
            from weekly_review_actions action where action.weekly_review_id = review.id
          ), '[]'::jsonb)
        ) as snapshot
      from weekly_reviews review
      where review.store_id = ${store.id} and review.week_end = ${input.weekEnd}
      for update
    ), updated as (
      update weekly_reviews review
      set status = ${input.status},
          summary = ${input.summary ?? null},
          risks = ${input.risks ?? null},
          opportunities = ${input.opportunities ?? null},
          marketing_amplify_category_id = ${input.marketingAmplifyCategoryId ?? null},
          different_this_week = ${input.differentThisWeek ?? null},
          first_three_actions = ${input.firstThreeActions ?? null},
          submitted_by_user_id = ${actorUserId},
          lock_version = review.lock_version + 1,
          updated_at = now()
      from before_review before
      where review.id = before.id
        and review.status <> 'approved'
        and ${input.lockVersion ?? null}::integer is not null
        and before.lock_version = ${input.lockVersion ?? null}
      returning review.*
    ), inserted as (
      insert into weekly_reviews (
        store_id, week_end, status, summary, risks, opportunities,
        marketing_amplify_category_id, different_this_week, first_three_actions,
        submitted_by_user_id
      )
      select
        ${store.id}, ${input.weekEnd}, ${input.status}, ${input.summary ?? null},
        ${input.risks ?? null}, ${input.opportunities ?? null},
        ${input.marketingAmplifyCategoryId ?? null}, ${input.differentThisWeek ?? null},
        ${input.firstThreeActions ?? null}, ${actorUserId}
      where not exists (select 1 from before_review)
      on conflict (store_id, week_end) do nothing
      returning *
    ), review_record as (
      select * from updated
      union all
      select * from inserted
    ), deleted_notes as (
      delete from weekly_review_category_notes note
      using review_record review
      where note.weekly_review_id = review.id
      returning note.id
    ), note_delete_marker as (
      select count(*) as count from deleted_notes
    ), inserted_notes as (
      insert into weekly_review_category_notes (
        weekly_review_id, category_id, performance_comment, overstocked, slow_moving,
        weeks_without_movement, value_at_risk, corrective_action, manager_comment
      )
      select
        review.id, note."categoryId", note."performanceComment", note.overstocked,
        note."slowMoving", note."weeksWithoutMovement", note."valueAtRisk",
        note."correctiveAction", note."managerComment"
      from review_record review
      cross join note_delete_marker
      cross join jsonb_to_recordset(${categoryNotes}::jsonb) as note(
        "categoryId" bigint,
        "performanceComment" text,
        overstocked boolean,
        "slowMoving" boolean,
        "weeksWithoutMovement" integer,
        "valueAtRisk" numeric(14,2),
        "correctiveAction" text,
        "managerComment" text
      )
      returning id
    ), deleted_actions as (
      delete from weekly_review_actions action
      using review_record review
      where action.weekly_review_id = review.id
      returning action.id
    ), action_delete_marker as (
      select count(*) as count from deleted_actions
    ), inserted_actions as (
      insert into weekly_review_actions (
        weekly_review_id, category_id, product_id, action, owner_user_id, owner_name,
        target_units, target_revenue, due_date, status, manager_comment
      )
      select
        review.id, action."categoryId", action."productId", action.action,
        action."ownerUserId", action."ownerName", action."targetUnits",
        action."targetRevenue", action."dueDate", action.status, action."managerComment"
      from review_record review
      cross join action_delete_marker
      cross join jsonb_to_recordset(${actions}::jsonb) as action(
        "categoryId" bigint,
        "productId" bigint,
        action text,
        "ownerUserId" integer,
        "ownerName" text,
        "targetUnits" integer,
        "targetRevenue" numeric(14,2),
        "dueDate" date,
        status text,
        "managerComment" text
      )
      returning id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after)
      select
        'weekly-review', review.id,
        case when before.id is null then ${input.status === 'submitted' ? 'submit' : 'create'}
             when ${input.status}::text = 'submitted' and before.status = 'draft' then 'submit'
             else 'update' end,
        ${actorUserId},
        before.snapshot,
        jsonb_build_object(
          'review', to_jsonb(review),
          'categoryNotes', ${categoryNotes}::jsonb,
          'actions', ${actions}::jsonb
        )
      from review_record review
      left join before_review before on before.id = review.id
      returning id
    )
    select jsonb_build_object(
      'id', review.id,
      'status', review.status,
      'lockVersion', review.lock_version,
      'categoryNoteCount', (select count(*) from inserted_notes),
      'actionCount', (select count(*) from inserted_actions)
    ) as record
    from review_record review
  `);
  const record = (result.rows[0] as { record?: Record<string, unknown> } | undefined)?.record;
  if (!record) throw new HttpError(409, 'Review changed, is approved, or requires the latest lock version');
  return record;
}

export async function decideWeeklyReview(
  user: AppUser,
  id: number,
  input: { action: 'approve' | 'reopen'; lockVersion: number; reason?: string }
) {
  if (user.role !== 'commercial') throw new HttpError(403, 'Only Commercial can approve or reopen weekly reviews');
  if (input.action === 'reopen' && !input.reason) throw new HttpError(400, 'A reason is required to reopen a review');
  const actorUserId = sessionUserId(user.id);
  const result = await db.execute(sql`
    with before_review as materialized (
      select * from weekly_reviews
      where id = ${id}
        and lock_version = ${input.lockVersion}
        and (
          (${input.action}::text = 'approve' and status = 'submitted')
          or (${input.action}::text = 'reopen' and status = 'approved')
        )
      for update
    ), updated as (
      update weekly_reviews review
      set status = case when ${input.action}::text = 'approve' then 'approved' else 'draft' end,
          approved_by_user_id = case
            when ${input.action}::text = 'approve' then ${actorUserId}::integer
            else null::integer
          end,
          approved_at = case
            when ${input.action}::text = 'approve' then now()
            else null::timestamptz
          end,
          lock_version = review.lock_version + 1,
          updated_at = now()
      from before_review before
      where review.id = before.id
      returning review.*
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select 'weekly-review', updated.id, ${input.action}, ${actorUserId},
             to_jsonb(before_review), to_jsonb(updated),
             case when ${input.reason ?? null}::text is null then null
                  else jsonb_build_object('reason', ${input.reason ?? null}::text) end
      from updated join before_review on before_review.id = updated.id
      returning id
    )
    select jsonb_build_object('id', updated.id, 'status', updated.status, 'lockVersion', updated.lock_version) as record
    from updated
  `);
  const record = (result.rows[0] as { record?: Record<string, unknown> } | undefined)?.record;
  if (!record) throw new HttpError(409, 'Review changed or is not in the required state');
  return record;
}
