import { sql } from 'drizzle-orm';
import type { ActivityItem } from '../contracts/analytics';
import { db } from '../db';
import type { AnalyticsScope } from './shared';

export async function getActivityFeed(scope: AnalyticsScope): Promise<ActivityItem[]> {
  const storeId = scope.store?.id ?? null;
  const result = await db.execute(sql`
    select
      event.id,
      event.entity_type as "entityType",
      event.entity_id as "entityId",
      event.action,
      coalesce(actor.name, 'System') as "actorName",
      event.created_at as "createdAt"
    from audit_events event
    left join users actor on actor.id = event.actor_user_id
    where event.created_at::date between ${scope.from}::date and ${scope.to}::date
      and (
        ${storeId}::bigint is null
        or jsonb_path_exists(
          jsonb_build_array(event.before, event.after),
          '$.** ? (@.store_id == $storeId || @.receiving_store_id == $storeId || @.from_store_id == $storeId || @.to_store_id == $storeId)',
          jsonb_build_object('storeId', to_jsonb(${storeId}::bigint))
        )
      )
    order by event.created_at desc, event.id desc
    limit 12
  `);

  return result.rows.map((row) => {
    const activity = row as Record<string, unknown>;
    return {
      id: Number(activity.id),
      entityType: String(activity.entityType),
      entityId: Number(activity.entityId),
      action: String(activity.action),
      actorName: String(activity.actorName),
      createdAt: new Date(String(activity.createdAt)).toISOString(),
    };
  });
}
