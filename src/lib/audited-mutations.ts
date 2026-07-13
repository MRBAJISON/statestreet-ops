import { sql, type SQL } from 'drizzle-orm';
import { db } from './db';

type MutationValue = string | number | boolean | Date | null;

interface MutationOptions {
  table: string;
  entityType: string;
  actorUserId: number;
  values: Record<string, MutationValue>;
  redact?: string[];
  preserveOnUpdate?: string[];
}

function redactedSnapshot(alias: string, columns: readonly string[]): SQL {
  return redactedJson(sql`to_jsonb(${sql.identifier(alias)})`, columns);
}

function redactedJson(snapshot: SQL, columns: readonly string[]): SQL {
  return columns.reduce<SQL>((value, column) => sql`${value} - ${column}`, snapshot);
}

export async function insertAuditedRecord(options: MutationOptions): Promise<Record<string, unknown>> {
  const entries = Object.entries(options.values);
  if (!entries.length) throw new Error('Audited insert requires at least one value');
  const columns = sql.join(entries.map(([column]) => sql.identifier(column)), sql`, `);
  const values = sql.join(entries.map(([, value]) => sql`${value}`), sql`, `);
  const snapshot = redactedSnapshot('created', options.redact ?? []);
  const result = await db.execute(sql`
    with created as (
      insert into ${sql.identifier(options.table)} (${columns})
      values (${values})
      returning *
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, after)
      select ${options.entityType}, created.id, 'create', ${options.actorUserId}, ${snapshot}
      from created
      returning id
    )
    select to_jsonb(created) as record from created
  `);
  const row = result.rows[0] as { record?: Record<string, unknown> } | undefined;
  if (!row?.record) throw new Error(`${options.entityType} was not created`);
  return row.record;
}

export async function updateAuditedRecord(
  options: MutationOptions & { id: number; metadata?: Record<string, unknown> }
): Promise<Record<string, unknown> | null> {
  const entries = Object.entries(options.values);
  if (!entries.length) throw new Error('Audited update requires at least one value');
  const preserved = new Set(options.preserveOnUpdate ?? []);
  const assignments = sql.join(
    entries
      .filter(([column]) => !preserved.has(column))
      .map(([column, value]) => sql`${sql.identifier(column)} = ${value}`),
    sql`, `
  );
  const beforeSnapshot = redactedSnapshot('before_record', options.redact ?? []);
  const afterSnapshot = redactedSnapshot('updated', options.redact ?? []);
  const result = await db.execute(sql`
    with before_record as materialized (
      select * from ${sql.identifier(options.table)} where id = ${options.id} for update
    ), updated as (
      update ${sql.identifier(options.table)} target
      set ${assignments}
      from before_record
      where target.id = before_record.id
      returning target.*
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after, metadata)
      select ${options.entityType}, updated.id, 'update', ${options.actorUserId},
             ${beforeSnapshot}, ${afterSnapshot}, ${options.metadata ? JSON.stringify(options.metadata) : null}::jsonb
      from updated
      join before_record on before_record.id = updated.id
      returning id
    )
    select to_jsonb(updated) as record from updated
  `);
  const row = result.rows[0] as { record?: Record<string, unknown> } | undefined;
  return row?.record ?? null;
}

export async function upsertAuditedRecord(
  options: MutationOptions & { key: Record<string, MutationValue> }
): Promise<Record<string, unknown>> {
  const entries = Object.entries(options.values);
  const keyEntries = Object.entries(options.key);
  if (!entries.length || !keyEntries.length) throw new Error('Audited upsert requires values and a key');
  const columns = sql.join(entries.map(([column]) => sql.identifier(column)), sql`, `);
  const values = sql.join(entries.map(([, value]) => sql`${value}`), sql`, `);
  const preserved = new Set(options.preserveOnUpdate ?? []);
  const keyJson = JSON.stringify(options.key);
  const valuesJson = JSON.stringify(options.values);
  const preservedJson = JSON.stringify([...preserved]);
  const beforeSnapshot = redactedJson(sql`saved.before_snapshot`, options.redact ?? []);
  const afterSnapshot = redactedJson(sql`saved.record`, options.redact ?? []);
  const result = await db.execute(sql`
    with locked_update as materialized (
      select existing.id, existing.before_snapshot, existing.record
      from public.lock_audited_upsert(
        ${options.table}::regclass,
        ${keyJson}::jsonb,
        ${valuesJson}::jsonb,
        ${preservedJson}::jsonb
      ) existing
    ), inserted as (
      insert into ${sql.identifier(options.table)} (${columns})
      select ${values}
      from (select count(*) from locked_update) lock_gate
      where not exists (select 1 from locked_update)
      returning *
    ), saved as (
      select id, before_snapshot, record, false as created
      from locked_update
      union all
      select inserted.id, null::jsonb, to_jsonb(inserted), true
      from inserted
    ), audit as (
      insert into audit_events (entity_type, entity_id, action, actor_user_id, before, after)
      select
        ${options.entityType}, saved.id,
        case when saved.created then 'create' else 'update' end,
        ${options.actorUserId},
        case when saved.created then null else ${beforeSnapshot} end,
        ${afterSnapshot}
      from saved
      returning id
    )
    select saved.record from saved
  `);
  const row = result.rows[0] as { record?: Record<string, unknown> } | undefined;
  if (!row?.record) throw new Error(`${options.entityType} was not saved`);
  return row.record;
}
