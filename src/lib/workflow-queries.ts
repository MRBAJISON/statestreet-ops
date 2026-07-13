import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { AppUser } from './auth';
import type {
  actionDecisionSchema,
  dispositionDecisionSchema,
  incidentDecisionSchema,
  maintenanceDecisionSchema,
} from './contracts/decisions';
import type { MutableWorkflow } from './contracts/decisions';
import { db } from './db';
import { products, stores } from './db/foundation-schema';
import {
  actionItems,
  incidents,
  inventoryDispositions,
  maintenanceRequests,
  workingCapitalItems,
} from './db/operational-schema';
import { HttpError, sessionUserId } from './server-errors';
import type { UserRole } from './types';

type ActionStatus = z.infer<typeof actionDecisionSchema>['status'];
type MaintenanceStatus = z.infer<typeof maintenanceDecisionSchema>['status'];
type IncidentStatus = z.infer<typeof incidentDecisionSchema>['status'];
type DispositionStatus = z.infer<typeof dispositionDecisionSchema>['status'];

interface WorkflowRecordBase {
  id: number;
}

export interface ActionWorkflowRecord extends WorkflowRecordBase {
  workflow: 'action';
  status: ActionStatus;
  title: string;
  department: string;
  priority: string;
  dueDate: string | null;
  storeName: string | null;
}

export interface MaintenanceWorkflowRecord extends WorkflowRecordBase {
  workflow: 'maintenance';
  status: MaintenanceStatus;
  category: string;
  priority: string;
  businessDate: string;
  dueDate: string | null;
  storeName: string;
}

export interface IncidentWorkflowRecord extends WorkflowRecordBase {
  workflow: 'incident';
  status: IncidentStatus;
  type: string;
  severity: string;
  occurredAt: string;
  followUpRequired: boolean;
  storeName: string;
}

export interface DispositionWorkflowRecord extends WorkflowRecordBase {
  workflow: 'inventory-disposition';
  status: DispositionStatus;
  action: string;
  reviewDate: string;
  productName: string;
  productSku: string;
  storeName: string;
}

export interface WorkingCapitalWorkflowRecord extends WorkflowRecordBase {
  workflow: 'working-capital';
  status: 'open' | 'partial';
  type: 'debtor' | 'creditor';
  counterparty: string;
  openAmount: string;
  dueDate: string | null;
}

export type MutableWorkflowRecord =
  | ActionWorkflowRecord
  | MaintenanceWorkflowRecord
  | IncidentWorkflowRecord
  | DispositionWorkflowRecord
  | WorkingCapitalWorkflowRecord;

const RECORD_LIMIT = 8;
const ACTION_READERS = new Set<UserRole>([
  'owner',
  'finance',
  'commercial',
  'marketing',
  'operations',
  'inventory',
  'brand',
]);

type ActionDepartment = 'finance' | 'commercial' | 'marketing' | 'operations' | 'inventory' | 'brand';

export interface MutableWorkflowReadScope {
  actorUserId: number;
  allActions: boolean;
  actionDepartments: ActionDepartment[];
}

export function getMutableWorkflowReadScope(
  workflow: MutableWorkflow,
  user: AppUser
): MutableWorkflowReadScope {
  const actorUserId = sessionUserId(user.id);

  if (workflow === 'action') {
    if (!ACTION_READERS.has(user.role)) throw new HttpError(403, 'Forbidden');
    if (user.role === 'owner' || user.role === 'operations') {
      return { actorUserId, allActions: true, actionDepartments: [] };
    }
    const actionDepartments: ActionDepartment[] =
      user.role === 'marketing' ? ['marketing', 'brand'] : [user.role as ActionDepartment];
    return { actorUserId, allActions: false, actionDepartments };
  }

  const requiredRole: Partial<Record<MutableWorkflow, UserRole>> = {
    maintenance: 'operations',
    incident: 'operations',
    'inventory-disposition': 'inventory',
    'working-capital': 'finance',
  };
  if (user.role !== 'operations' && user.role !== requiredRole[workflow]) {
    throw new HttpError(403, 'Forbidden');
  }
  return { actorUserId, allActions: false, actionDepartments: [] };
}

async function recentActions(scope: MutableWorkflowReadScope): Promise<ActionWorkflowRecord[]> {
  const conditions = [ne(actionItems.status, 'cancelled')];
  if (!scope.allActions) {
    conditions.push(
      or(
        eq(actionItems.ownerUserId, scope.actorUserId),
        inArray(actionItems.department, scope.actionDepartments)
      )!
    );
  }
  const rows = await db
    .select({
      id: actionItems.id,
      status: actionItems.status,
      title: actionItems.title,
      department: actionItems.department,
      priority: actionItems.priority,
      dueDate: actionItems.dueDate,
      storeName: stores.name,
    })
    .from(actionItems)
    .leftJoin(stores, eq(actionItems.storeId, stores.id))
    .where(and(...conditions))
    .orderBy(
      sql`case when ${actionItems.status} = 'completed' then 1 else 0 end`,
      asc(actionItems.dueDate),
      desc(actionItems.updatedAt)
    )
    .limit(RECORD_LIMIT);

  return rows.map((row) => ({
    workflow: 'action',
    ...row,
    status: row.status as ActionStatus,
  }));
}

async function recentMaintenance(): Promise<MaintenanceWorkflowRecord[]> {
  const rows = await db
    .select({
      id: maintenanceRequests.id,
      status: maintenanceRequests.status,
      category: maintenanceRequests.category,
      priority: maintenanceRequests.priority,
      businessDate: maintenanceRequests.businessDate,
      dueDate: maintenanceRequests.dueDate,
      storeName: stores.name,
    })
    .from(maintenanceRequests)
    .innerJoin(stores, eq(maintenanceRequests.storeId, stores.id))
    .where(ne(maintenanceRequests.status, 'cancelled'))
    .orderBy(
      sql`case when ${maintenanceRequests.status} = 'completed' then 1 else 0 end`,
      asc(maintenanceRequests.dueDate),
      desc(maintenanceRequests.updatedAt)
    )
    .limit(RECORD_LIMIT);

  return rows.map((row) => ({
    workflow: 'maintenance',
    ...row,
    status: row.status as MaintenanceStatus,
  }));
}

async function recentIncidents(): Promise<IncidentWorkflowRecord[]> {
  const rows = await db
    .select({
      id: incidents.id,
      status: incidents.status,
      type: incidents.type,
      severity: incidents.severity,
      occurredAt: incidents.occurredAt,
      followUpRequired: incidents.followUpRequired,
      storeName: stores.name,
    })
    .from(incidents)
    .innerJoin(stores, eq(incidents.storeId, stores.id))
    .where(ne(incidents.status, 'closed'))
    .orderBy(
      sql`case when ${incidents.status} = 'resolved' then 1 else 0 end`,
      desc(incidents.occurredAt),
      desc(incidents.updatedAt)
    )
    .limit(RECORD_LIMIT);

  return rows.map((row) => ({
    workflow: 'incident',
    ...row,
    status: row.status as IncidentStatus,
    occurredAt: row.occurredAt.toISOString(),
  }));
}

async function recentDispositions(): Promise<DispositionWorkflowRecord[]> {
  const rows = await db
    .select({
      id: inventoryDispositions.id,
      status: inventoryDispositions.status,
      action: inventoryDispositions.action,
      reviewDate: inventoryDispositions.reviewDate,
      productName: products.name,
      productSku: products.sku,
      storeName: stores.name,
    })
    .from(inventoryDispositions)
    .innerJoin(products, eq(inventoryDispositions.productId, products.id))
    .innerJoin(stores, eq(inventoryDispositions.storeId, stores.id))
    .where(and(ne(inventoryDispositions.status, 'completed'), ne(inventoryDispositions.status, 'cancelled')))
    .orderBy(
      sql`case when ${inventoryDispositions.status} = 'rejected' then 1 else 0 end`,
      desc(inventoryDispositions.reviewDate),
      desc(inventoryDispositions.updatedAt)
    )
    .limit(RECORD_LIMIT);

  return rows.map((row) => ({
    workflow: 'inventory-disposition',
    ...row,
    status: row.status as DispositionStatus,
  }));
}

async function recentWorkingCapital(): Promise<WorkingCapitalWorkflowRecord[]> {
  const rows = await db
    .select({
      id: workingCapitalItems.id,
      status: workingCapitalItems.status,
      type: workingCapitalItems.type,
      counterparty: workingCapitalItems.entity,
      openAmount: workingCapitalItems.openAmount,
      dueDate: workingCapitalItems.dueDate,
    })
    .from(workingCapitalItems)
    .where(inArray(workingCapitalItems.status, ['open', 'partial']))
    .orderBy(asc(workingCapitalItems.dueDate), desc(workingCapitalItems.updatedAt))
    .limit(RECORD_LIMIT);

  return rows.map((row) => ({
    workflow: 'working-capital',
    ...row,
    status: row.status as 'open' | 'partial',
    type: row.type as 'debtor' | 'creditor',
  }));
}

export async function getRecentWorkflowRecords(
  workflow: MutableWorkflow,
  user: AppUser
): Promise<MutableWorkflowRecord[]> {
  const scope = getMutableWorkflowReadScope(workflow, user);
  if (workflow === 'action') return recentActions(scope);
  if (workflow === 'maintenance') return recentMaintenance();
  if (workflow === 'incident') return recentIncidents();
  if (workflow === 'inventory-disposition') return recentDispositions();
  return recentWorkingCapital();
}
