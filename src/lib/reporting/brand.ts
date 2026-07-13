import { sql } from 'drizzle-orm';
import type { BrandDomain } from '../contracts/analytics';
import { db } from '../db';
import type { AnalyticsScope } from './shared';
import { jsonResult } from './shared';

export async function getBrandDomain(scope: AnalyticsScope): Promise<BrandDomain> {
  const feedbackStore = scope.store ? sql`and feedback.store_id = ${scope.store.id}` : sql``;
  const actionStore = scope.store ? sql`and action.store_id = ${scope.store.id}` : sql``;

  const result = await db.execute(sql`
    with assessment_rows as (
      select
        assessment.brand_id,
        avg(coalesce(
          assessment.overall_override,
          (assessment.awareness_score + assessment.consideration_score + assessment.preference_score +
           assessment.satisfaction_score + assessment.loyalty_score + assessment.advocacy_score +
           assessment.momentum_score) / 7.0
        )) as health,
        avg(assessment.awareness_score) as awareness,
        avg(assessment.consideration_score) as consideration,
        avg(assessment.preference_score) as preference,
        avg(assessment.satisfaction_score) as satisfaction,
        avg(assessment.loyalty_score) as loyalty,
        avg(assessment.advocacy_score) as advocacy,
        avg(assessment.momentum_score) as momentum
      from brand_health_assessments assessment
      where assessment.business_date between ${scope.from}::date and ${scope.to}::date
      group by assessment.brand_id
    ), sentiment_rows as (
      select
        sentiment.brand_id,
        sum(sentiment.positive_mentions) as positive_mentions,
        sum(sentiment.neutral_mentions) as neutral_mentions,
        sum(sentiment.negative_mentions) as negative_mentions,
        100.0 * sum(sentiment.positive_mentions) /
          nullif(sum(sentiment.positive_mentions + sentiment.neutral_mentions + sentiment.negative_mentions), 0) as positive
      from brand_sentiment_snapshots sentiment
      where sentiment.business_date between ${scope.from}::date and ${scope.to}::date
      group by sentiment.brand_id
    ), sentiment_trend as (
      select sentiment.business_date,
        sum(sentiment.positive_mentions)::integer as positive,
        sum(sentiment.neutral_mentions)::integer as neutral,
        sum(sentiment.negative_mentions)::integer as negative
      from brand_sentiment_snapshots sentiment
      where sentiment.business_date between ${scope.from}::date and ${scope.to}::date
      group by sentiment.business_date
    ), digital_latest as (
      select distinct on (digital.brand_id)
        digital.brand_id, digital.google_rating, digital.google_review_count,
        digital.trustpilot_rating, digital.response_rate, digital.nps,
        digital.instagram_followers, digital.new_reviews, digital.negative_reviews
      from digital_reputation_snapshots digital
      where digital.business_date <= ${scope.to}::date
      order by digital.brand_id, digital.business_date desc, digital.id desc
    ), brand_rows as (
      select
        brand.id,
        brand.name,
        coalesce(assessment.health, 0) as health,
        coalesce(assessment.awareness, 0) as awareness,
        coalesce(assessment.consideration, 0) as consideration,
        coalesce(assessment.preference, 0) as preference,
        coalesce(assessment.satisfaction, 0) as satisfaction,
        coalesce(assessment.loyalty, 0) as loyalty,
        coalesce(assessment.advocacy, 0) as advocacy,
        coalesce(assessment.momentum, 0) as momentum,
        coalesce(sentiment.positive, 0) as positive_sentiment,
        digital.google_rating
      from brands brand
      left join assessment_rows assessment on assessment.brand_id = brand.id
      left join sentiment_rows sentiment on sentiment.brand_id = brand.id
      left join digital_latest digital on digital.brand_id = brand.id
      where brand.active = true and (assessment.brand_id is not null or sentiment.brand_id is not null or digital.brand_id is not null)
    ), brand_group as (
      select
        avg(health) as health,
        avg(awareness) as awareness,
        avg(consideration) as consideration,
        avg(preference) as preference,
        avg(satisfaction) as satisfaction,
        avg(loyalty) as loyalty,
        avg(advocacy) as advocacy,
        avg(momentum) as momentum,
        avg(positive_sentiment) as positive_sentiment,
        avg(google_rating) as google_rating
      from brand_rows
    ), sentiment_summary as (
      select
        coalesce(sum(positive_mentions), 0) as positive,
        coalesce(sum(neutral_mentions), 0) as neutral,
        coalesce(sum(negative_mentions), 0) as negative
      from sentiment_rows
    ), digital_group as (
      select avg(digital.google_rating) as google_rating,
        sum(digital.google_review_count)::integer as google_review_count,
        avg(digital.trustpilot_rating) as trustpilot_rating,
        avg(digital.response_rate) as response_rate,
        avg(digital.nps) as nps,
        sum(digital.instagram_followers)::integer as instagram_followers,
        sum(digital.new_reviews)::integer as new_reviews,
        sum(digital.negative_reviews)::integer as negative_reviews
      from digital_latest digital
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
    ), competitor_rows as (
      select
        competitor.id,
        competitor.competitor,
        brand.name as brand_name,
        competitor.threat_level,
        competitor.share_of_voice,
        competitor.description,
        competitor.recommended_response
      from competitor_activities competitor
      left join brands brand on brand.id = competitor.brand_id
      where competitor.business_date between ${scope.from}::date and ${scope.to}::date
      order by
        case competitor.threat_level when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
        competitor.business_date desc
      limit 15
    ), attention_rows as (
      select action.id, action.department, action.title, action.detail, action.priority, action.status,
        action.due_date, store.name as store_name,
        coalesce(owner.name, action.owner_name, 'Unassigned') as owner_name
      from action_items action
      left join stores store on store.id = action.store_id
      left join users owner on owner.id = action.owner_user_id
      where action.department = 'brand' and action.status <> 'cancelled' ${actionStore}
      order by case action.priority when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
        action.due_date nulls last, action.id desc
      limit 20
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'healthIndex', coalesce(round(brand.health, 1), 0)::float8,
        'momentum', coalesce(round(brand.momentum, 1), 0)::float8,
        'positiveSentiment', coalesce(round(brand.positive_sentiment, 1), 0)::float8,
        'googleRating', round(brand.google_rating, 2)::float8,
        'nps', (select nps::float8 from feedback_summary),
        'highThreats', (
          select count(*) from competitor_rows where threat_level in ('high', 'critical')
        )
      ),
      'brands', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'name', item.name,
          'health', round(item.health, 1)::float8,
          'awareness', round(item.awareness, 1)::float8,
          'consideration', round(item.consideration, 1)::float8,
          'preference', round(item.preference, 1)::float8,
          'satisfaction', round(item.satisfaction, 1)::float8,
          'loyalty', round(item.loyalty, 1)::float8,
          'advocacy', round(item.advocacy, 1)::float8,
          'momentum', round(item.momentum, 1)::float8,
          'positiveSentiment', round(item.positive_sentiment, 1)::float8,
          'googleRating', item.google_rating::float8
        ) order by item.health desc, item.name)
        from brand_rows item
      ), '[]'::jsonb),
      'competitors', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'competitor', item.competitor,
          'brandName', item.brand_name,
          'threatLevel', item.threat_level,
          'shareOfVoice', item.share_of_voice::float8,
          'description', item.description,
          'recommendedResponse', item.recommended_response
        )) from competitor_rows item
      ), '[]'::jsonb),
      'feedback', coalesce((
        select jsonb_agg(jsonb_build_object('type', item.type, 'count', item.count) order by item.count desc, item.type)
        from feedback_rows item
      ), '[]'::jsonb),
      'equity', jsonb_build_array(
        jsonb_build_object('name', 'Awareness', 'value', coalesce(round(brand.awareness, 1), 0)::float8),
        jsonb_build_object('name', 'Consideration', 'value', coalesce(round(brand.consideration, 1), 0)::float8),
        jsonb_build_object('name', 'Preference', 'value', coalesce(round(brand.preference, 1), 0)::float8),
        jsonb_build_object('name', 'Satisfaction', 'value', coalesce(round(brand.satisfaction, 1), 0)::float8),
        jsonb_build_object('name', 'Loyalty', 'value', coalesce(round(brand.loyalty, 1), 0)::float8),
        jsonb_build_object('name', 'Advocacy', 'value', coalesce(round(brand.advocacy, 1), 0)::float8),
        jsonb_build_object('name', 'Momentum', 'value', coalesce(round(brand.momentum, 1), 0)::float8)
      ),
      'sentiment', jsonb_build_object(
        'positive', sentiment.positive::integer,
        'neutral', sentiment.neutral::integer,
        'negative', sentiment.negative::integer
      ),
      'sentimentTrend', coalesce((
        select jsonb_agg(jsonb_build_object('date', item.business_date, 'positive', item.positive, 'neutral', item.neutral, 'negative', item.negative) order by item.business_date)
        from sentiment_trend item
      ), '[]'::jsonb),
      'shareOfConversation', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', item.name,
          'value', (item.positive_mentions + item.neutral_mentions + item.negative_mentions)::integer
        ) order by (item.positive_mentions + item.neutral_mentions + item.negative_mentions) desc, item.name)
        from (
          select brand.name, sentiment.positive_mentions, sentiment.neutral_mentions, sentiment.negative_mentions
          from sentiment_rows sentiment
          join brands brand on brand.id = sentiment.brand_id
        ) item
      ), '[]'::jsonb),
      'digitalReputation', jsonb_build_object(
        'googleRating', digital.google_rating::float8,
        'googleReviews', coalesce(digital.google_review_count, 0),
        'trustpilotRating', digital.trustpilot_rating::float8,
        'responseRate', digital.response_rate::float8,
        'nps', digital.nps,
        'followers', coalesce(digital.instagram_followers, 0),
        'newReviews', coalesce(digital.new_reviews, 0),
        'negativeReviews', coalesce(digital.negative_reviews, 0)
      ),
      'risks', coalesce((
        select jsonb_agg(jsonb_build_object('text', item.description, 'tag', item.threat_level) order by item.id desc)
        from competitor_rows item where item.threat_level in ('high', 'critical')
      ), '[]'::jsonb),
      'opportunities', coalesce((
        select jsonb_agg(jsonb_build_object('text', item.recommended_response, 'tag', item.threat_level) order by item.id desc)
        from competitor_rows item where item.recommended_response is not null
      ), '[]'::jsonb),
      'attention', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', action.id, 'department', action.department, 'title', action.title, 'detail', action.detail,
          'priority', action.priority, 'status', action.status, 'dueDate', action.due_date,
          'storeName', action.store_name, 'ownerName', action.owner_name
        ) order by action.due_date nulls last, action.id desc)
        from attention_rows action
      ), '[]'::jsonb)
    ) as data
    from brand_group brand
    cross join sentiment_summary sentiment
    cross join digital_group digital
  `);

  return jsonResult<BrandDomain>(result);
}
