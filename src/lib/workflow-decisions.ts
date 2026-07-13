import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { AppUser } from './auth';
import type {
  actionDecisionSchema,
  dispositionDecisionSchema,
  incidentDecisionSchema,
  maintenanceDecisionSchema,
  workingCapitalSettlementSchema,
} from './contracts/decisions';
import { db } from './db';
import { HttpError, sessionUserId } from './server-errors';

type ActionDecision = z.infer<typeof actionDecisionSchema>;
type MaintenanceDecision = z.infer<typeof maintenanceDecisionSchema>;
type IncidentDecision = z.infer<typeof incidentDecisionSchema>;
type DispositionDecision = z.infer<typeof dispositionDecisionSchema>;
type Settlement = z.infer<typeof workingCapitalSettlementSchema>;

function resultRecord(result: { rows: unknown[] }, message: string) {
  const record = (result.rows[0] as { record?: Record<string, unknown> } | undefined)?.record;
  if (!record) throw new HttpError(409, message);
  return record;
}

export async function decideAction(user: AppUser, id: number, input: ActionDecision) {
  if (user.role === 'store-manager') throw new HttpError(403, 'Forbidden');
  const actorUserId = sessionUserId(user.id);
  const roleDepartment = user.role;
  const result = await db.execute(sql`
    with before_record as materialized (
      select * from action_items action
      where action.id = ${id}
        and action.status <> 'cancelled'
        and (
          ${user.role === 'owner' || user.role === 'operations'}::boolean
          or action.owner_user_id = ${actorUserId}
          or action.department = ${roleDepartment}
          or (${user.role === 'marketing'}::boolean and action.department = 'brand')
        )
      for update
    ), updated as (
      update action_items action
      set status = ${input.status},
          detail = case when ${input.note ?? null}::text is null then action.detail
                        else concat_ws(E'\n', action.detail, ${input.note ?? null}::text) end,
          completed_at = case when ${input.status}::text = 'completed' then now() else null end,
          updated_by_user_id = ${actorUserId},
          updated_at = now()
      from before_record before
      where action.id = before.id
      returning action.*
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select 'action-item', updated.id,
             case when ${input.status}::text = 'completed' then 'complete'
                  when ${input.status}::text = 'cancelled' then 'cancel'
                  else 'update' end,
             ${actorUserId}, to_jsonb(before_record), to_jsonb(updated),
             jsonb_build_object('note', ${input.note ?? null}::text)
      from updated join before_record on before_record.id = updated.id
      returning id
    )
    select jsonb_build_object('id', updated.id, 'status', updated.status) as record from updated
  `);
  return resultRecord(result, 'Action is unavailable or access is restricted');
}

export async function decideMaintenance(user: AppUser, id: number, input: MaintenanceDecision) {
  if (user.role !== 'operations') throw new HttpError(403, 'Forbidden');
  const actorUserId = sessionUserId(user.id);
  const result = await db.execute(sql`
    with before_record as materialized (
      select * from maintenance_requests where id = ${id} and status <> 'cancelled' for update
    ), updated as (
      update maintenance_requests request
      set status = ${input.status},
          description = case when ${input.note ?? null}::text is null then request.description
                             else concat_ws(E'\n', request.description, ${input.note ?? null}::text) end,
          resolved_at = case when ${input.status}::text = 'completed' then now() else null end,
          updated_by_user_id = ${actorUserId}, updated_at = now()
      from before_record before where request.id = before.id
      returning request.*
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select 'maintenance-request', updated.id,
             case when ${input.status}::text = 'completed' then 'complete'
                  when ${input.status}::text = 'cancelled' then 'cancel' else 'update' end,
             ${actorUserId}, to_jsonb(before_record), to_jsonb(updated),
             jsonb_build_object('note', ${input.note ?? null}::text)
      from updated join before_record on before_record.id = updated.id returning id
    )
    select jsonb_build_object('id', updated.id, 'status', updated.status) as record from updated
  `);
  return resultRecord(result, 'Maintenance request is unavailable');
}

export async function decideIncident(user: AppUser, id: number, input: IncidentDecision) {
  if (user.role !== 'operations') throw new HttpError(403, 'Forbidden');
  const actorUserId = sessionUserId(user.id);
  const result = await db.execute(sql`
    with before_record as materialized (
      select * from incidents where id = ${id} and status <> 'closed' for update
    ), updated as (
      update incidents incident
      set status = ${input.status},
          immediate_action = case when ${input.note ?? null}::text is null then incident.immediate_action
                                  else concat_ws(E'\n', incident.immediate_action, ${input.note ?? null}::text) end,
          resolved_at = case when ${input.status}::text in ('resolved', 'closed') then now() else null end,
          updated_by_user_id = ${actorUserId}, updated_at = now()
      from before_record before where incident.id = before.id
      returning incident.*
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select 'incident', updated.id,
             case when ${input.status}::text in ('resolved', 'closed') then 'complete' else 'update' end,
             ${actorUserId}, to_jsonb(before_record), to_jsonb(updated),
             jsonb_build_object('note', ${input.note ?? null}::text)
      from updated join before_record on before_record.id = updated.id returning id
    )
    select jsonb_build_object('id', updated.id, 'status', updated.status) as record from updated
  `);
  return resultRecord(result, 'Incident is unavailable');
}

export async function decideDisposition(user: AppUser, id: number, input: DispositionDecision) {
  if (!['inventory', 'operations'].includes(user.role)) throw new HttpError(403, 'Forbidden');
  const actorUserId = sessionUserId(user.id);
  const result = await db.execute(sql`
    with before_record as materialized (
      select * from inventory_dispositions where id = ${id} and status not in ('completed', 'cancelled') for update
    ), updated as (
      update inventory_dispositions disposition
      set status = ${input.status},
          justification = case when ${input.note ?? null}::text is null then disposition.justification
                               else concat_ws(E'\n', disposition.justification, ${input.note ?? null}::text) end,
          updated_by_user_id = ${actorUserId}, updated_at = now()
      from before_record before where disposition.id = before.id
      returning disposition.*
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select 'inventory-disposition', updated.id,
             case when ${input.status}::text = 'completed' then 'complete'
                  when ${input.status}::text in ('rejected', 'cancelled') then 'cancel' else 'update' end,
             ${actorUserId}, to_jsonb(before_record), to_jsonb(updated),
             jsonb_build_object('note', ${input.note ?? null}::text)
      from updated join before_record on before_record.id = updated.id returning id
    )
    select jsonb_build_object('id', updated.id, 'status', updated.status) as record from updated
  `);
  return resultRecord(result, 'Inventory disposition is unavailable');
}

export async function settleWorkingCapital(user: AppUser, id: number, input: Settlement) {
  if (!['finance', 'operations'].includes(user.role)) throw new HttpError(403, 'Forbidden');
  const actorUserId = sessionUserId(user.id);
  const result = await db.execute(sql`
    with before_record as materialized (
      select * from working_capital_items item
      where item.id = ${id} and item.status in ('open', 'partial') and item.open_amount >= ${input.amount}::numeric
      for update
    ), settlement as (
      insert into working_capital_settlements (
        working_capital_item_id, business_date, amount, cash_account_id, reference, created_by_user_id
      )
      select before.id, ${input.businessDate}, ${input.amount}, ${input.cashAccountId ?? null},
             ${input.reference ?? null}, ${actorUserId}
      from before_record before
      returning *
    ), updated as (
      update working_capital_items item
      set open_amount = item.open_amount - ${input.amount}::numeric,
          status = case when item.open_amount - ${input.amount}::numeric = 0 then 'settled' else 'partial' end,
          updated_by_user_id = ${actorUserId}, updated_at = now()
      from before_record before where item.id = before.id
      returning item.*
    ), cash as (
      insert into cash_transactions (
        business_date, direction, category, amount, cash_account_id, reference,
        description, source_type, source_id, created_by_user_id, updated_by_user_id
      )
      select settlement.business_date,
             case when before.type = 'debtor' then 'inflow' else 'outflow' end,
             'working-capital', settlement.amount, settlement.cash_account_id, settlement.reference,
             concat('Settlement for ', before.entity), 'working-capital-settlement', settlement.id,
             ${actorUserId}, ${actorUserId}
      from settlement join before_record before on before.id = settlement.working_capital_item_id
      returning id
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select 'working-capital-item', updated.id, 'settle', ${actorUserId},
             to_jsonb(before_record), to_jsonb(updated),
             jsonb_build_object('amount', ${input.amount}::numeric, 'settlementId', settlement.id)
      from updated
      join before_record on before_record.id = updated.id
      join settlement on settlement.working_capital_item_id = updated.id
      returning id
    )
    select jsonb_build_object(
      'id', updated.id,
      'status', updated.status,
      'openAmount', updated.open_amount::float8,
      'settlementId', settlement.id,
      'cashTransactionCount', (select count(*) from cash)
    ) as record
    from updated join settlement on settlement.working_capital_item_id = updated.id
  `);
  return resultRecord(result, 'Settlement exceeds the open amount or the item is already closed');
}
