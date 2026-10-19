import { sql } from 'drizzle-orm';
import type { MarketingDomain } from '../contracts/analytics';
import { db } from '../db';
import type { AnalyticsScope } from './shared';
import { jsonResult } from './shared';
import { leadPeriodFilter } from './lead-period-filter';

export async function getMarketingDomain(scope: AnalyticsScope): Promise<MarketingDomain> {
  const activityStore = scope.store ? sql`and activity.store_id = ${scope.store.id}` : sql``;
  const feedbackStore = scope.store ? sql`and feedback.store_id = ${scope.store.id}` : sql``;
  const actionStore = scope.store ? sql`and action.store_id = ${scope.store.id}` : sql``;
  const interactionStore = scope.store ? sql`and interaction.store_id = ${scope.store.id}` : sql``;

  const result = await db.execute(sql`
    with campaigns as (
      select
        campaign.id,
        campaign.period_start,
        campaign.period_end,
        campaign.name,
        brand.name as brand_name,
        campaign.platform,
        campaign.spend,
        campaign.revenue_influenced,
        campaign.reach,
        campaign.engagement,
        campaign.store_visits,
        campaign.status
      from marketing_campaign_reports campaign
      join brands brand on brand.id = campaign.brand_id
      where ${leadPeriodFilter(sql`campaign.period_start`, sql`campaign.period_end`, scope)}
    ), campaign_summary as (
      select
        coalesce(sum(spend), 0) as spend,
        coalesce(sum(revenue_influenced), 0) as revenue
      from campaigns
    ), lead_summary as (
      select
        coalesce(sum(metric.lead_count), 0)::integer as leads,
        coalesce(sum(metric.qualified_count), 0)::integer as qualified,
        coalesce(sum(metric.converted_count), 0)::integer as converted
      from lead_metrics metric
      where ${leadPeriodFilter(sql`metric.period_start`, sql`metric.period_end`, scope)}
    ), lead_channels as (
      select
        metric.channel,
        sum(metric.lead_count)::integer as leads,
        sum(metric.qualified_count)::integer as qualified,
        sum(metric.converted_count)::integer as converted
      from lead_metrics metric
      where ${leadPeriodFilter(sql`metric.period_start`, sql`metric.period_end`, scope)}
      group by metric.channel
    ), campaign_brands as (
      select
        campaign.brand_name,
        sum(campaign.spend) as spend,
        sum(campaign.revenue_influenced) as revenue
      from campaigns campaign
      group by campaign.brand_name
    ), social_period as (
      select
        metric.platform,
        sum(metric.reach)::integer as reach,
        sum(metric.impressions)::integer as impressions,
        sum(metric.engagement)::integer as engagement,
        -- Do not present partially reported optional/legacy metrics as totals.
        case when count(metric.follows) = count(*) then sum(metric.follows)::integer end as follows,
        case when count(metric.profile_activity) = count(*) then sum(metric.profile_activity)::integer end as profile_activity,
        case when count(metric.clicks) = count(*) then sum(metric.clicks)::integer end as clicks,
        case when count(metric.posts) = count(*) then sum(metric.posts)::integer end as posts,
        case when count(metric.reels) = count(*) then sum(metric.reels)::integer end as reels,
        case when count(metric.stories) = count(*) then sum(metric.stories)::integer end as stories,
        case when count(metric.website_visits) = count(*) then sum(metric.website_visits)::integer end as website_visits
      from social_metrics metric
      where ${leadPeriodFilter(sql`metric.period_start`, sql`metric.period_end`, scope)}
      group by metric.platform
    ), social_latest as (
      select distinct on (metric.platform) metric.platform, metric.followers
      from social_metrics metric
      where metric.period_end <= ${scope.to}::date
        and metric.followers is not null
      order by metric.platform, metric.period_end desc, metric.id desc
    ), clienteling as (
      select
        activity.type,
        sum(activity.contacted)::integer as contacted,
        sum(activity.responses)::integer as responses,
        sum(activity.appointments)::integer as appointments,
        sum(activity.estimated_revenue) as revenue
      from clienteling_activities activity
      where ${leadPeriodFilter(sql`activity.period_start`, sql`activity.period_end`, scope)} ${activityStore}
      group by activity.type
    ), feedback_summary as (
      select case when count(feedback.nps_score) = 0 then null else
        round(
          100.0 * (
            count(*) filter (where feedback.nps_score >= 9) -
            count(*) filter (where feedback.nps_score <= 6)
          ) / count(feedback.nps_score),
          1
        )
      end as nps
      from customer_feedback feedback
      where feedback.business_date between ${scope.from}::date and ${scope.to}::date
        and feedback.nps_score is not null ${feedbackStore}
    ), feedback_rows as (
      select feedback.type, count(*)::integer as count
      from customer_feedback feedback
      where feedback.business_date between ${scope.from}::date and ${scope.to}::date ${feedbackStore}
      group by feedback.type
    ), feedback_detail as (
      select feedback.id, feedback.type, feedback.detail, feedback.frequency, store.name as store_name, feedback.source
      from customer_feedback feedback
      left join stores store on store.id = feedback.store_id
      where feedback.business_date between ${scope.from}::date and ${scope.to}::date ${feedbackStore}
      order by feedback.business_date desc, feedback.id desc
      limit 20
    ), action_rows as (
      select
        action.id,
        action.department,
        action.title,
        action.detail,
        action.priority,
        action.status,
        action.due_date,
        store.name as store_name,
        coalesce(owner.name, action.owner_name, 'Unassigned') as owner_name
      from action_items action
      left join stores store on store.id = action.store_id
      left join users owner on owner.id = action.owner_user_id
      where action.department = 'marketing' and action.status <> 'cancelled' ${actionStore}
      order by action.due_date nulls last, action.id desc
      limit 20
    ), customer_summary as (
      select
        count(*)::integer as captured,
        count(*) filter (where interaction.lifecycle = 'buyer')::integer as buyers
      from customer_interactions interaction
      where interaction.business_date between ${scope.from}::date and ${scope.to}::date ${interactionStore}
    ), customer_sources as (
      select interaction.source as name, count(*)::integer as value
      from customer_interactions interaction
      where interaction.business_date between ${scope.from}::date and ${scope.to}::date ${interactionStore}
      group by interaction.source
    ), stock_gap_summary as (
      select coalesce(sum(interaction.stock_gap_value), 0) as missed_sales_value
      from customer_interactions interaction
      where interaction.business_date between ${scope.from}::date and ${scope.to}::date
        and interaction.fulfillment_status = 'stock_gap' ${interactionStore}
    ), customer_interests as (
      select coalesce(product.name, interaction.interest_text, 'Not specified') as name, count(*)::integer as value
      from customer_interactions interaction
      left join products product on product.id = interaction.product_id
      where interaction.business_date between ${scope.from}::date and ${scope.to}::date ${interactionStore}
      group by coalesce(product.name, interaction.interest_text, 'Not specified')
    ), customer_sizes as (
      select coalesce(customer.size_preference, 'Not specified') as name, count(*)::integer as value
      from customer_interactions interaction
      join customers customer on customer.id = interaction.customer_id
      where interaction.business_date between ${scope.from}::date and ${scope.to}::date ${interactionStore}
      group by coalesce(customer.size_preference, 'Not specified')
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'spend', campaign.spend::float8,
        'influencedRevenue', campaign.revenue::float8,
        'roas', coalesce(round(campaign.revenue / nullif(campaign.spend, 0), 2), 0)::float8,
        'leads', lead.leads,
        'qualified', lead.qualified,
        'converted', lead.converted,
        'costPerLead', coalesce(round(campaign.spend / nullif(lead.leads, 0), 2), 0)::float8,
        'missedSalesValue', gaps.missed_sales_value::float8,
        'nps', feedback.nps::float8
      ),
      'funnel', jsonb_build_object(
        'reach', coalesce((select sum(reach) from campaigns), 0)::integer,
        'engagement', coalesce((select sum(engagement) from campaigns), 0)::integer,
        'leads', lead.leads,
        'storeVisits', coalesce((select sum(store_visits) from campaigns), 0)::integer,
        'revenueInfluenced', campaign.revenue::float8
      ),
      'contentCadence', jsonb_build_object(
        'posts', (select case when count(posts) = count(*) then coalesce(sum(posts), 0)::integer end from social_period),
        'reels', (select case when count(reels) = count(*) then coalesce(sum(reels), 0)::integer end from social_period),
        'stories', (select case when count(stories) = count(*) then coalesce(sum(stories), 0)::integer end from social_period)
      ),
      'campaigns', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'periodStart', item.period_start,
          'periodEnd', item.period_end,
          'name', item.name,
          'brandName', item.brand_name,
          'platform', item.platform,
          'spend', item.spend::float8,
          'revenue', item.revenue_influenced::float8,
          'roas', coalesce(round(item.revenue_influenced / nullif(item.spend, 0), 2), 0)::float8,
          'reach', item.reach,
          'engagementRate', coalesce(round(100.0 * item.engagement / nullif(item.reach, 0), 1), 0)::float8,
          'status', item.status
        ) order by item.revenue_influenced desc, item.name)
        from campaigns item
      ), '[]'::jsonb),
      'leadChannels', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', channel.channel,
          'leads', channel.leads,
          'qualified', channel.qualified,
          'converted', channel.converted
        ) order by channel.leads desc, channel.channel)
        from lead_channels channel
      ), '[]'::jsonb),
      'partialLeadSummaries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', metric.id, 'channel', metric.channel, 'periodStart', metric.period_start, 'periodEnd', metric.period_end,
          'leads', metric.lead_count, 'qualified', metric.qualified_count, 'converted', metric.converted_count
        ) order by metric.period_start, metric.id)
        from lead_metrics metric
        where ${leadPeriodFilter(sql`metric.period_start`, sql`metric.period_end`, scope, true)}
      ), '[]'::jsonb),
      'partialMarketingSummaries', coalesce((
        select jsonb_agg(to_jsonb(partial) order by partial."periodStart", partial.kind, partial.id)
        from (
          select campaign.id, 'Campaign'::text as kind,
            concat(campaign.name, ' / ', campaign.platform, ' / ', brand.name) as label,
            campaign.period_start as "periodStart", campaign.period_end as "periodEnd"
          from marketing_campaign_reports campaign join brands brand on brand.id = campaign.brand_id
          where ${leadPeriodFilter(sql`campaign.period_start`, sql`campaign.period_end`, scope, true)}
          union all
          select metric.id, 'Social', concat(metric.platform, ' / ', coalesce(brand.name, 'Group')),
            metric.period_start, metric.period_end
          from social_metrics metric left join brands brand on brand.id = metric.brand_id
          where ${leadPeriodFilter(sql`metric.period_start`, sql`metric.period_end`, scope, true)}
          union all
          select activity.id, 'Clienteling', concat(activity.type, ' / ', coalesce(store.name, 'Group')),
            activity.period_start, activity.period_end
          from clienteling_activities activity left join stores store on store.id = activity.store_id
          where ${leadPeriodFilter(sql`activity.period_start`, sql`activity.period_end`, scope, true)} ${activityStore}
        ) partial
      ), '[]'::jsonb),
      'social', coalesce((
        select jsonb_agg(jsonb_build_object(
          'platform', period.platform,
          'reach', period.reach,
          'impressions', period.impressions,
          'engagement', period.engagement,
          'follows', period.follows,
          'profileActivity', period.profile_activity,
          'clicks', period.clicks,
          'followers', latest.followers,
          'websiteVisits', period.website_visits
        ) order by period.reach desc, period.platform)
        from social_period period
        left join social_latest latest on latest.platform = period.platform
      ), '[]'::jsonb),
      'campaignBrands', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', item.brand_name,
          'spend', item.spend::float8,
          'revenue', item.revenue::float8,
          'roas', coalesce(round(item.revenue / nullif(item.spend, 0), 2), 0)::float8
        ) order by item.revenue desc, item.brand_name)
        from campaign_brands item
      ), '[]'::jsonb),
      'clienteling', coalesce((
        select jsonb_agg(jsonb_build_object(
          'type', activity.type,
          'contacted', activity.contacted,
          'responses', activity.responses,
          'appointments', activity.appointments,
          'revenue', activity.revenue::float8
        ) order by activity.contacted desc, activity.type)
        from clienteling activity
      ), '[]'::jsonb),
      'feedback', coalesce((
        select jsonb_agg(jsonb_build_object('type', item.type, 'count', item.count) order by item.count desc, item.type)
        from feedback_rows item
      ), '[]'::jsonb),
      'feedbackDetail', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'type', item.type,
          'detail', item.detail,
          'frequency', item.frequency,
          'storeName', item.store_name,
          'source', item.source
        ) order by item.id desc)
        from feedback_detail item
      ), '[]'::jsonb),
      'actions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', action.id,
          'department', action.department,
          'title', action.title,
          'detail', action.detail,
          'priority', action.priority,
          'status', action.status,
          'dueDate', action.due_date,
          'storeName', action.store_name,
          'ownerName', action.owner_name
        ) order by action.due_date nulls last, action.id desc)
        from action_rows action
      ), '[]'::jsonb),
      'customerInsights', jsonb_build_object(
        'captured', customer.captured,
        'buyers', customer.buyers,
        'sources', coalesce((
          select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value) order by item.value desc, item.name)
          from customer_sources item
        ), '[]'::jsonb),
        'interests', coalesce((
          select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value) order by item.value desc, item.name)
          from customer_interests item
        ), '[]'::jsonb),
        'sizes', coalesce((
          select jsonb_agg(jsonb_build_object('name', item.name, 'value', item.value) order by item.value desc, item.name)
          from customer_sizes item
        ), '[]'::jsonb)
      )
    ) as data
    from campaign_summary campaign
    cross join lead_summary lead
    cross join feedback_summary feedback
    cross join customer_summary customer
    cross join stock_gap_summary gaps
  `);

  return jsonResult<MarketingDomain>(result);
}
