import { sql } from 'drizzle-orm';
import type { OperationsDomain } from '../contracts/analytics';
import { db } from '../db';
import type { AnalyticsScope } from './shared';
import { jsonResult } from './shared';

export async function getOperationsDomain(scope: AnalyticsScope): Promise<OperationsDomain> {
  const storeFilter = scope.store ? sql`and store.id = ${scope.store.id}` : sql``;
  const reviewStore = scope.store ? sql`and review.store_id = ${scope.store.id}` : sql``;
  const requestStore = scope.store ? sql`and request.store_id = ${scope.store.id}` : sql``;
  const incidentStore = scope.store ? sql`and incident.store_id = ${scope.store.id}` : sql``;
  const peopleStore = scope.store ? sql`and snapshot.store_id = ${scope.store.id}` : sql``;
  const sopStore = scope.store ? sql`and review.store_id = ${scope.store.id}` : sql``;
  const vmStore = scope.store ? sql`and review.store_id = ${scope.store.id}` : sql``;
  const experienceStore = scope.store ? sql`and review.store_id = ${scope.store.id}` : sql``;
  const actionStore = scope.store ? sql`and action.store_id = ${scope.store.id}` : sql``;

  const result = await db.execute(sql`
    with eligible_stores as (
      select store.id, store.name
      from stores store
      where store.active = true and store.type = 'store' ${storeFilter}
    ), standards as (
      select
        review.store_id,
        avg(review.operations_score) as operations,
        avg(review.vm_score) as vm,
        avg(review.readiness_score) as readiness,
        avg(review.customer_experience_score) as customer_experience,
        avg(review.cleanliness_score) as cleanliness,
        avg(review.safety_score) as safety,
        avg((review.operations_score + review.vm_score + review.readiness_score +
             review.customer_experience_score + review.cleanliness_score + review.safety_score) / 6.0) as overall
      from store_standard_reviews review
      where review.business_date between ${scope.from}::date and ${scope.to}::date ${reviewStore}
      group by review.store_id
    ), maintenance_counts as (
      select request.store_id, count(*)::integer as count
      from maintenance_requests request
      where request.status in ('open', 'in-progress', 'blocked') ${requestStore}
      group by request.store_id
    ), incident_counts as (
      select incident.store_id, count(*)::integer as count
      from incidents incident
      where incident.status in ('open', 'investigating') ${incidentStore}
      group by incident.store_id
    ), latest_people as (
      select distinct on (snapshot.store_id)
        snapshot.store_id, snapshot.staff_total, snapshot.staff_present,
        snapshot.punctuality_score, snapshot.training_completion_score
      from people_snapshots snapshot
      where snapshot.business_date <= ${scope.to}::date ${peopleStore}
      order by snapshot.store_id, snapshot.business_date desc, snapshot.id desc
    ), sop_scores as (
      select review.store_id, avg(review.compliance_score) as score
      from sop_reviews review
      where review.business_date between ${scope.from}::date and ${scope.to}::date ${sopStore}
      group by review.store_id
    ), store_rows as (
      select
        store.id,
        store.name,
        coalesce(standard.overall, 0) as overall,
        coalesce(standard.operations, 0) as operations,
        coalesce(standard.vm, 0) as vm,
        coalesce(standard.readiness, 0) as readiness,
        coalesce(standard.customer_experience, 0) as customer_experience,
        coalesce(standard.cleanliness, 0) as cleanliness,
        coalesce(standard.safety, 0) as safety,
        coalesce(maintenance.count, 0) as maintenance,
        coalesce(incident.count, 0) as incidents,
        coalesce(100.0 * people.staff_present / nullif(people.staff_total, 0), 0) as attendance,
        coalesce(sop.score, 0) as sop
      from eligible_stores store
      left join standards standard on standard.store_id = store.id
      left join maintenance_counts maintenance on maintenance.store_id = store.id
      left join incident_counts incident on incident.store_id = store.id
      left join latest_people people on people.store_id = store.id
      left join sop_scores sop on sop.store_id = store.id
    ), maintenance_queue as (
      select request.id, store.name as store_name, request.category, request.priority,
             request.status, request.due_date, coalesce(request.estimated_cost, 0) as cost
      from maintenance_requests request
      join stores store on store.id = request.store_id
      where request.status in ('open', 'in-progress', 'blocked') ${requestStore}
      order by
        case request.priority when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
        request.due_date nulls last
      limit 15
    ), incident_queue as (
      select incident.id, store.name as store_name, incident.type, incident.severity,
             incident.status, incident.occurred_at
      from incidents incident
      join stores store on store.id = incident.store_id
      where incident.status in ('open', 'investigating') ${incidentStore}
      order by
        case incident.severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
        incident.occurred_at desc
      limit 15
    ), vm_summary as (
      select
        avg(review.window_display_score) as window_display,
        avg(review.mannequin_score) as mannequin,
        avg(review.product_presentation_score) as presentation,
        avg(review.size_arrangement_score) as size_arrangement
      from visual_merchandising_reviews review
      where review.business_date between ${scope.from}::date and ${scope.to}::date ${vmStore}
    ), issue_rows as (
      select review.id, store.name as store_name, review.business_date, review.issues
      from store_standard_reviews review
      join stores store on store.id = review.store_id
      where review.business_date between ${scope.from}::date and ${scope.to}::date
        and review.issues is not null ${reviewStore}
      order by review.business_date desc, review.id desc
      limit 20
    ), experience_summary as (
      select
        coalesce(avg(review.rating), 0) as rating,
        case when count(review.nps_score) = 0 then null else round(
          100.0 * (count(*) filter (where review.nps_score >= 9) - count(*) filter (where review.nps_score <= 6)) /
          count(review.nps_score), 1
        ) end as nps,
        coalesce(100.0 * count(*) filter (where review.recommendation in ('yes', 'likely')) / nullif(count(review.recommendation), 0), 0) as recommend_rate,
        count(*)::integer as responses
      from store_experience_reviews review
      where review.business_date between ${scope.from}::date and ${scope.to}::date ${experienceStore}
    ), people_period as (
      select
        count(*)::integer as snapshots,
        coalesce(100.0 * sum(snapshot.staff_present) / nullif(sum(snapshot.staff_total), 0), 0) as attendance,
        coalesce(avg(snapshot.punctuality_score), 0) as punctuality,
        coalesce(avg(snapshot.training_completion_score), 0) as training,
        coalesce(sum(snapshot.staff_total - snapshot.staff_present), 0)::integer as absences
      from people_snapshots snapshot
      where snapshot.business_date between ${scope.from}::date and ${scope.to}::date ${peopleStore}
    ), absence_reasons as (
      select coalesce(snapshot.absence_reason, 'Not specified') as name,
        sum(snapshot.staff_total - snapshot.staff_present)::integer as value
      from people_snapshots snapshot
      where snapshot.business_date between ${scope.from}::date and ${scope.to}::date
        and snapshot.staff_total > snapshot.staff_present ${peopleStore}
      group by coalesce(snapshot.absence_reason, 'Not specified')
    ), staffing_summary as (
      select coalesce(sum(staff_total), 0)::integer as total,
        coalesce(sum(staff_present), 0)::integer as present
      from latest_people
    ), maintenance_summary as (
      select
        coalesce(sum(request.estimated_cost), 0) as total_cost,
        coalesce(sum(request.estimated_cost) filter (where request.status in ('open', 'in-progress', 'blocked')), 0) as open_cost,
        count(*) filter (where request.status in ('open', 'in-progress', 'blocked') and request.due_date < ${scope.to}::date)::integer as overdue
      from maintenance_requests request
      where request.business_date <= ${scope.to}::date ${requestStore}
    ), maintenance_categories as (
      select request.category as name,
        count(*)::integer as count,
        count(*) filter (where request.status in ('open', 'in-progress', 'blocked'))::integer as open,
        coalesce(sum(request.estimated_cost), 0) as cost,
        coalesce(sum(request.estimated_cost) filter (where request.status in ('open', 'in-progress', 'blocked')), 0) as open_cost
      from maintenance_requests request
      where request.business_date <= ${scope.to}::date ${requestStore}
      group by request.category
    ), maintenance_assignees as (
      select coalesce(owner.name, request.assigned_to_name, 'Unassigned') as name,
        count(*)::integer as count,
        count(*) filter (where request.status in ('open', 'in-progress', 'blocked'))::integer as open,
        coalesce(sum(request.estimated_cost) filter (where request.status in ('open', 'in-progress', 'blocked')), 0) as open_cost
      from maintenance_requests request
      left join users owner on owner.id = request.assigned_to_user_id
      where request.business_date <= ${scope.to}::date ${requestStore}
      group by coalesce(owner.name, request.assigned_to_name, 'Unassigned')
    ), sop_areas as (
      select review.area as name, avg(review.compliance_score) as value
      from sop_reviews review
      where review.business_date between ${scope.from}::date and ${scope.to}::date ${sopStore}
      group by review.area
    ), sop_deviations as (
      select review.id, store.name as store_name, review.area, review.deviations, review.corrective_action
      from sop_reviews review
      join stores store on store.id = review.store_id
      where review.business_date between ${scope.from}::date and ${scope.to}::date
        and review.deviations is not null ${sopStore}
      order by review.business_date desc, review.id desc
      limit 20
    ), incident_levels as (
      select incident.severity as name, count(*)::integer as value
      from incidents incident
      where incident.occurred_at::date between ${scope.from}::date and ${scope.to}::date ${incidentStore}
      group by incident.severity
    ), incident_types as (
      select incident.type as name, count(*)::integer as value
      from incidents incident
      where incident.occurred_at::date between ${scope.from}::date and ${scope.to}::date ${incidentStore}
      group by incident.type
    ), incidents_by_store as (
      select store.name, count(*)::integer as value
      from incidents incident
      join stores store on store.id = incident.store_id
      where incident.occurred_at::date between ${scope.from}::date and ${scope.to}::date ${incidentStore}
      group by store.id, store.name
    ), corrective_actions as (
      select action.id, action.department, action.title, action.detail, action.priority, action.status,
        action.due_date, store.name as store_name,
        coalesce(owner.name, action.owner_name, 'Unassigned') as owner_name
      from action_items action
      left join stores store on store.id = action.store_id
      left join users owner on owner.id = action.owner_user_id
      where action.department = 'operations' and action.status <> 'cancelled' ${actionStore}
      order by action.due_date nulls last, action.id desc
      limit 25
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'storeScore', coalesce(round(avg(store.overall), 1), 0)::float8,
        'operationsScore', coalesce(round(avg(store.operations), 1), 0)::float8,
        'visualMerchandisingScore', coalesce(round(avg(store.vm), 1), 0)::float8,
        'readinessScore', coalesce(round(avg(store.readiness), 1), 0)::float8,
        'customerExperienceScore', coalesce(round(avg(store.customer_experience), 1), 0)::float8,
        'maintenanceCompliance', coalesce(round(100.0 * count(*) filter (where store.maintenance = 0) / nullif(count(*), 0), 1), 0)::float8,
        'openMaintenance', coalesce(sum(store.maintenance), 0)::integer,
        'openIncidents', coalesce(sum(store.incidents), 0)::integer,
        'openIssues', (coalesce(sum(store.maintenance), 0) + coalesce(sum(store.incidents), 0))::integer,
        'attendance', coalesce(round(avg(store.attendance), 1), 0)::float8,
        'sopCompliance', coalesce(round(avg(store.sop), 1), 0)::float8
      ),
      'stores', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'name', item.name,
          'overall', round(item.overall, 1)::float8,
          'operations', round(item.operations, 1)::float8,
          'visualMerchandising', round(item.vm, 1)::float8,
          'readiness', round(item.readiness, 1)::float8,
          'customerExperience', round(item.customer_experience, 1)::float8,
          'cleanliness', round(item.cleanliness, 1)::float8,
          'safety', round(item.safety, 1)::float8,
          'maintenance', item.maintenance,
          'incidents', item.incidents,
          'attendance', round(item.attendance, 1)::float8
        ) order by item.overall desc, item.name)
        from store_rows item
      ), '[]'::jsonb),
      'maintenance', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'storeName', item.store_name,
          'category', item.category,
          'priority', item.priority,
          'status', item.status,
          'dueDate', item.due_date,
          'cost', item.cost::float8
        )) from maintenance_queue item
      ), '[]'::jsonb),
      'incidents', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'storeName', item.store_name,
          'type', item.type,
          'severity', item.severity,
          'status', item.status,
          'occurredAt', item.occurred_at
        )) from incident_queue item
      ), '[]'::jsonb),
      'riskLevels', coalesce((select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value) order by item.value desc) from incident_levels item), '[]'::jsonb),
      'incidentTypes', coalesce((select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value) order by item.value desc) from incident_types item), '[]'::jsonb),
      'incidentsByStore', coalesce((select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value) order by item.value desc) from incidents_by_store item), '[]'::jsonb),
      'visualMerchandising', jsonb_build_array(
        jsonb_build_object('name', 'Window Display', 'value', coalesce(round(vm.window_display, 1), 0)::float8),
        jsonb_build_object('name', 'Mannequin', 'value', coalesce(round(vm.mannequin, 1), 0)::float8),
        jsonb_build_object('name', 'Product Presentation', 'value', coalesce(round(vm.presentation, 1), 0)::float8),
        jsonb_build_object('name', 'Size Arrangement', 'value', coalesce(round(vm.size_arrangement, 1), 0)::float8)
      ),
      'keyIssues', coalesce((
        select jsonb_agg(jsonb_build_object('id', item.id, 'storeName', item.store_name, 'date', item.business_date, 'issues', item.issues) order by item.business_date desc, item.id desc)
        from issue_rows item
      ), '[]'::jsonb),
      'customerExperience', jsonb_build_object(
        'rating', round(experience.rating, 2)::float8,
        'nps', experience.nps::float8,
        'recommendRate', round(experience.recommend_rate, 1)::float8,
        'responses', experience.responses
      ),
      'peopleHealth', jsonb_build_object(
        'score', round((people.attendance + people.punctuality + people.training) / 3.0, 1)::float8,
        'attendance', round(people.attendance, 1)::float8,
        'punctuality', round(people.punctuality, 1)::float8,
        'training', round(people.training, 1)::float8,
        'absences', people.absences,
        'snapshots', people.snapshots,
        'reasons', coalesce((select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value) order by item.value desc) from absence_reasons item), '[]'::jsonb)
      ),
      'staffing', jsonb_build_object('total', staffing.total, 'present', staffing.present, 'absent', greatest(staffing.total - staffing.present, 0)),
      'maintenanceSummary', jsonb_build_object(
        'totalCost', maintenance.total_cost::float8,
        'openCost', maintenance.open_cost::float8,
        'overdue', maintenance.overdue
      ),
      'maintenanceByCategory', coalesce((
        select jsonb_agg(jsonb_build_object('name', item.name, 'count', item.count, 'open', item.open, 'cost', item.cost::float8, 'openCost', item.open_cost::float8) order by item.open desc, item.name)
        from maintenance_categories item
      ), '[]'::jsonb),
      'maintenanceByAssignee', coalesce((
        select jsonb_agg(jsonb_build_object('name', item.name, 'count', item.count, 'open', item.open, 'openCost', item.open_cost::float8) order by item.open desc, item.name)
        from maintenance_assignees item
      ), '[]'::jsonb),
      'sopByArea', coalesce((select jsonb_agg(jsonb_build_object('name', item.name, 'value', round(item.value, 1)::float8) order by item.value, item.name) from sop_areas item), '[]'::jsonb),
      'sopDeviations', coalesce((
        select jsonb_agg(jsonb_build_object('id', item.id, 'storeName', item.store_name, 'area', item.area, 'deviations', item.deviations, 'correctiveAction', item.corrective_action) order by item.id desc)
        from sop_deviations item
      ), '[]'::jsonb),
      'correctiveActions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', action.id, 'department', action.department, 'title', action.title, 'detail', action.detail,
          'priority', action.priority, 'status', action.status, 'dueDate', action.due_date,
          'storeName', action.store_name, 'ownerName', action.owner_name
        ) order by action.due_date nulls last, action.id desc)
        from corrective_actions action
      ), '[]'::jsonb)
    ) as data
    from store_rows store
    cross join vm_summary vm
    cross join experience_summary experience
    cross join people_period people
    cross join staffing_summary staffing
    cross join maintenance_summary maintenance
    group by
      vm.window_display, vm.mannequin, vm.presentation, vm.size_arrangement,
      experience.rating, experience.nps, experience.recommend_rate, experience.responses,
      people.attendance, people.punctuality, people.training, people.absences, people.snapshots,
      staffing.total, staffing.present,
      maintenance.total_cost, maintenance.open_cost, maintenance.overdue
  `);

  return jsonResult<OperationsDomain>(result);
}
