CREATE TABLE "action_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "action_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"department" text NOT NULL,
	"source_type" text,
	"source_id" bigint,
	"store_id" bigint,
	"brand_id" bigint,
	"category_id" bigint,
	"title" text NOT NULL,
	"detail" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"owner_user_id" integer,
	"owner_name" text,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_items_priority_check" CHECK ("action_items"."priority" in ('low', 'medium', 'high', 'critical')),
	CONSTRAINT "action_items_status_check" CHECK ("action_items"."status" in ('open', 'in-progress', 'blocked', 'completed', 'cancelled')),
	CONSTRAINT "action_items_owner_check" CHECK ("action_items"."owner_user_id" is not null or "action_items"."owner_name" is not null)
);
--> statement-breakpoint
CREATE TABLE "brand_health_assessments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "brand_health_assessments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"brand_id" bigint NOT NULL,
	"type" text NOT NULL,
	"awareness_score" integer NOT NULL,
	"consideration_score" integer NOT NULL,
	"preference_score" integer NOT NULL,
	"satisfaction_score" integer NOT NULL,
	"loyalty_score" integer NOT NULL,
	"advocacy_score" integer NOT NULL,
	"momentum_score" integer NOT NULL,
	"overall_override" integer,
	"override_reason" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_health_scores_check" CHECK ("brand_health_assessments"."awareness_score" between 0 and 100 and "brand_health_assessments"."consideration_score" between 0 and 100 and "brand_health_assessments"."preference_score" between 0 and 100 and "brand_health_assessments"."satisfaction_score" between 0 and 100 and "brand_health_assessments"."loyalty_score" between 0 and 100 and "brand_health_assessments"."advocacy_score" between 0 and 100 and "brand_health_assessments"."momentum_score" between 0 and 100 and ("brand_health_assessments"."overall_override" is null or "brand_health_assessments"."overall_override" between 0 and 100)),
	CONSTRAINT "brand_health_override_reason_check" CHECK ("brand_health_assessments"."overall_override" is null or "brand_health_assessments"."override_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "brand_sentiment_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "brand_sentiment_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"brand_id" bigint NOT NULL,
	"source" text NOT NULL,
	"positive_mentions" integer DEFAULT 0 NOT NULL,
	"neutral_mentions" integer DEFAULT 0 NOT NULL,
	"negative_mentions" integer DEFAULT 0 NOT NULL,
	"positive_theme" text,
	"negative_theme" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_sentiment_counts_check" CHECK ("brand_sentiment_snapshots"."positive_mentions" >= 0 and "brand_sentiment_snapshots"."neutral_mentions" >= 0 and "brand_sentiment_snapshots"."negative_mentions" >= 0)
);
--> statement-breakpoint
CREATE TABLE "capital_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "capital_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"year" integer NOT NULL,
	"capital_employed" numeric(14, 2) NOT NULL,
	"total_investment" numeric(14, 2) NOT NULL,
	"notes" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capital_snapshots_year_check" CHECK ("capital_snapshots"."year" between 2000 and 2200),
	CONSTRAINT "capital_snapshots_amounts_check" CHECK ("capital_snapshots"."capital_employed" >= 0 and "capital_snapshots"."total_investment" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cash_accounts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_accounts_type_check" CHECK ("cash_accounts"."type" in ('bank', 'cash', 'mobile-money', 'other'))
);
--> statement-breakpoint
CREATE TABLE "cash_transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"direction" text NOT NULL,
	"category" text NOT NULL,
	"expense_category_id" bigint,
	"amount" numeric(14, 2) NOT NULL,
	"cash_account_id" bigint,
	"reference" text,
	"description" text,
	"source_type" text,
	"source_id" bigint,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_transactions_direction_check" CHECK ("cash_transactions"."direction" in ('inflow', 'outflow')),
	CONSTRAINT "cash_transactions_amount_check" CHECK ("cash_transactions"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "clienteling_activities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clienteling_activities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"type" text NOT NULL,
	"store_id" bigint,
	"contacted" integer NOT NULL,
	"responses" integer DEFAULT 0 NOT NULL,
	"appointments" integer DEFAULT 0 NOT NULL,
	"estimated_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clienteling_counts_check" CHECK ("clienteling_activities"."contacted" >= 0 and "clienteling_activities"."responses" >= 0 and "clienteling_activities"."appointments" >= 0 and "clienteling_activities"."responses" <= "clienteling_activities"."contacted" and "clienteling_activities"."appointments" <= "clienteling_activities"."responses"),
	CONSTRAINT "clienteling_revenue_check" CHECK ("clienteling_activities"."estimated_revenue" >= 0)
);
--> statement-breakpoint
CREATE TABLE "competitor_activities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "competitor_activities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"competitor" text NOT NULL,
	"brand_id" bigint,
	"share_of_voice" numeric(6, 2),
	"activity_type" text,
	"description" text NOT NULL,
	"threat_level" text DEFAULT 'medium' NOT NULL,
	"recommended_response" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitor_share_of_voice_check" CHECK ("competitor_activities"."share_of_voice" is null or "competitor_activities"."share_of_voice" between 0 and 100),
	CONSTRAINT "competitor_threat_level_check" CHECK ("competitor_activities"."threat_level" in ('low', 'medium', 'high', 'critical'))
);
--> statement-breakpoint
CREATE TABLE "customer_feedback" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"source" text NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"nps_score" integer,
	"recommendation" text,
	"frequency" text,
	"detail" text NOT NULL,
	"store_id" bigint,
	"brand_id" bigint,
	"contact_name" text,
	"contact_value" text,
	"contact_consent" boolean DEFAULT false NOT NULL,
	"retention_until" date,
	"captured_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_feedback_nps_score_check" CHECK ("customer_feedback"."nps_score" is null or "customer_feedback"."nps_score" between 0 and 10),
	CONSTRAINT "customer_feedback_recommendation_check" CHECK ("customer_feedback"."recommendation" is null or "customer_feedback"."recommendation" in ('yes', 'likely', 'no')),
	CONSTRAINT "customer_feedback_contact_consent_check" CHECK ("customer_feedback"."contact_value" is null or ("customer_feedback"."contact_consent" = true and "customer_feedback"."retention_until" is not null))
);
--> statement-breakpoint
CREATE TABLE "digital_reputation_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "digital_reputation_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"brand_id" bigint,
	"google_rating" numeric(3, 2),
	"google_review_count" integer DEFAULT 0 NOT NULL,
	"instagram_sentiment" numeric(6, 2),
	"instagram_followers" integer DEFAULT 0 NOT NULL,
	"response_rate" numeric(6, 2),
	"average_response_hours" numeric(8, 2),
	"nps" integer,
	"trustpilot_rating" numeric(3, 2),
	"new_reviews" integer DEFAULT 0 NOT NULL,
	"negative_reviews" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digital_reputation_ratings_check" CHECK (("digital_reputation_snapshots"."google_rating" is null or "digital_reputation_snapshots"."google_rating" between 0 and 5) and ("digital_reputation_snapshots"."trustpilot_rating" is null or "digital_reputation_snapshots"."trustpilot_rating" between 0 and 5)),
	CONSTRAINT "digital_reputation_percentages_check" CHECK (("digital_reputation_snapshots"."instagram_sentiment" is null or "digital_reputation_snapshots"."instagram_sentiment" between 0 and 100) and ("digital_reputation_snapshots"."response_rate" is null or "digital_reputation_snapshots"."response_rate" between 0 and 100)),
	CONSTRAINT "digital_reputation_nps_check" CHECK ("digital_reputation_snapshots"."nps" is null or "digital_reputation_snapshots"."nps" between -100 and 100),
	CONSTRAINT "digital_reputation_counts_check" CHECK ("digital_reputation_snapshots"."google_review_count" >= 0 and "digital_reputation_snapshots"."instagram_followers" >= 0 and "digital_reputation_snapshots"."new_reviews" >= 0 and "digital_reputation_snapshots"."negative_reviews" >= 0),
	CONSTRAINT "digital_reputation_response_time_check" CHECK ("digital_reputation_snapshots"."average_response_hours" is null or "digital_reputation_snapshots"."average_response_hours" >= 0)
);
--> statement-breakpoint
CREATE TABLE "financial_forecasts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "financial_forecasts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"revenue" numeric(14, 2) NOT NULL,
	"gross_profit" numeric(14, 2) NOT NULL,
	"net_profit" numeric(14, 2) NOT NULL,
	"cash_balance" numeric(14, 2) NOT NULL,
	"confidence" text DEFAULT 'medium' NOT NULL,
	"assumptions" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_forecasts_period_check" CHECK ("financial_forecasts"."period_end" >= "financial_forecasts"."period_start"),
	CONSTRAINT "financial_forecasts_confidence_check" CHECK ("financial_forecasts"."confidence" in ('low', 'medium', 'high'))
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "incidents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone NOT NULL,
	"store_id" bigint NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"immediate_action" text,
	"follow_up_required" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"reported_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incidents_severity_check" CHECK ("incidents"."severity" in ('low', 'medium', 'high', 'critical')),
	CONSTRAINT "incidents_status_check" CHECK ("incidents"."status" in ('open', 'investigating', 'resolved', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "inventory_dispositions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_dispositions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"review_date" date NOT NULL,
	"product_id" bigint NOT NULL,
	"store_id" bigint NOT NULL,
	"action" text NOT NULL,
	"justification" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"action_item_id" bigint,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_dispositions_action_check" CHECK ("inventory_dispositions"."action" in ('markdown-20', 'markdown-40', 'markdown-60', 'transfer', 'donate', 'write-off')),
	CONSTRAINT "inventory_dispositions_status_check" CHECK ("inventory_dispositions"."status" in ('proposed', 'approved', 'in-progress', 'completed', 'rejected', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"product_id" bigint NOT NULL,
	"store_id" bigint NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(14, 2),
	"source_type" text NOT NULL,
	"source_id" bigint,
	"source_line_id" bigint,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_movements_type_check" CHECK ("inventory_movements"."movement_type" in ('opening-balance', 'receipt', 'transfer-in', 'transfer-out', 'count-adjustment', 'sale', 'return', 'write-off')),
	CONSTRAINT "inventory_movements_quantity_check" CHECK ("inventory_movements"."quantity" <> 0),
	CONSTRAINT "inventory_movements_unit_cost_check" CHECK ("inventory_movements"."unit_cost" is null or "inventory_movements"."unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lead_metrics" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lead_metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"channel" text NOT NULL,
	"campaign_report_id" bigint,
	"lead_count" integer NOT NULL,
	"qualified_count" integer DEFAULT 0 NOT NULL,
	"converted_count" integer DEFAULT 0 NOT NULL,
	"average_value" numeric(14, 2),
	"notes" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_metrics_counts_check" CHECK ("lead_metrics"."lead_count" >= 0 and "lead_metrics"."qualified_count" >= 0 and "lead_metrics"."converted_count" >= 0 and "lead_metrics"."qualified_count" <= "lead_metrics"."lead_count" and "lead_metrics"."converted_count" <= "lead_metrics"."qualified_count"),
	CONSTRAINT "lead_metrics_average_value_check" CHECK ("lead_metrics"."average_value" is null or "lead_metrics"."average_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "maintenance_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "maintenance_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"store_id" bigint NOT NULL,
	"category" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"assigned_to_user_id" integer,
	"assigned_to_name" text,
	"estimated_cost" numeric(14, 2),
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"reported_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_priority_check" CHECK ("maintenance_requests"."priority" in ('low', 'medium', 'high', 'critical')),
	CONSTRAINT "maintenance_status_check" CHECK ("maintenance_requests"."status" in ('open', 'in-progress', 'blocked', 'completed', 'cancelled')),
	CONSTRAINT "maintenance_cost_check" CHECK ("maintenance_requests"."estimated_cost" is null or "maintenance_requests"."estimated_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "marketing_campaign_reports" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "marketing_campaign_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"name" text NOT NULL,
	"brand_id" bigint NOT NULL,
	"platform" text NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"engagement" integer DEFAULT 0 NOT NULL,
	"store_visits" integer DEFAULT 0 NOT NULL,
	"revenue_influenced" numeric(14, 2) DEFAULT '0' NOT NULL,
	"spend" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_campaigns_counts_check" CHECK ("marketing_campaign_reports"."reach" >= 0 and "marketing_campaign_reports"."engagement" >= 0 and "marketing_campaign_reports"."store_visits" >= 0),
	CONSTRAINT "marketing_campaigns_amounts_check" CHECK ("marketing_campaign_reports"."revenue_influenced" >= 0 and "marketing_campaign_reports"."spend" >= 0),
	CONSTRAINT "marketing_campaigns_status_check" CHECK ("marketing_campaign_reports"."status" in ('planned', 'active', 'paused', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"company_name" text DEFAULT 'StateStreet' NOT NULL,
	"tagline" text DEFAULT 'Retail Group' NOT NULL,
	"currency" text DEFAULT 'GHS' NOT NULL,
	"logo" text,
	"week_start" text DEFAULT 'monday' NOT NULL,
	"minimum_password_length" integer DEFAULT 8 NOT NULL,
	"session_days" integer DEFAULT 7 NOT NULL,
	"updated_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_settings_singleton_check" CHECK ("organization_settings"."id" = 1),
	CONSTRAINT "org_settings_week_start_check" CHECK ("organization_settings"."week_start" in ('monday', 'sunday')),
	CONSTRAINT "org_settings_password_length_check" CHECK ("organization_settings"."minimum_password_length" between 8 and 128),
	CONSTRAINT "org_settings_session_days_check" CHECK ("organization_settings"."session_days" between 1 and 90)
);
--> statement-breakpoint
CREATE TABLE "people_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "people_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"store_id" bigint NOT NULL,
	"staff_total" integer NOT NULL,
	"staff_present" integer NOT NULL,
	"punctuality_score" integer NOT NULL,
	"training_completion_score" integer NOT NULL,
	"absence_reason" text,
	"notes" text,
	"recorded_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_snapshots_counts_check" CHECK ("people_snapshots"."staff_total" >= 0 and "people_snapshots"."staff_present" >= 0 and "people_snapshots"."staff_present" <= "people_snapshots"."staff_total"),
	CONSTRAINT "people_snapshots_scores_check" CHECK ("people_snapshots"."punctuality_score" between 0 and 100 and "people_snapshots"."training_completion_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "performance_targets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "performance_targets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"metric" text NOT NULL,
	"scope_type" text NOT NULL,
	"store_id" bigint,
	"brand_id" bigint,
	"category_id" bigint,
	"period_type" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"unit" text NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "targets_scope_check" CHECK ("performance_targets"."scope_type" in ('group', 'store', 'brand', 'category')),
	CONSTRAINT "targets_period_type_check" CHECK ("performance_targets"."period_type" in ('week', 'month', 'quarter', 'year')),
	CONSTRAINT "targets_period_range_check" CHECK ("performance_targets"."period_end" >= "performance_targets"."period_start"),
	CONSTRAINT "targets_value_check" CHECK ("performance_targets"."value" >= 0),
	CONSTRAINT "targets_unit_check" CHECK ("performance_targets"."unit" in ('money', 'percent', 'count', 'ratio')),
	CONSTRAINT "targets_scope_reference_check" CHECK ((
        ("performance_targets"."scope_type" = 'group' and "performance_targets"."store_id" is null and "performance_targets"."brand_id" is null and "performance_targets"."category_id" is null) or
        ("performance_targets"."scope_type" = 'store' and "performance_targets"."store_id" is not null and "performance_targets"."brand_id" is null and "performance_targets"."category_id" is null) or
        ("performance_targets"."scope_type" = 'brand' and "performance_targets"."store_id" is null and "performance_targets"."brand_id" is not null and "performance_targets"."category_id" is null) or
        ("performance_targets"."scope_type" = 'category' and "performance_targets"."store_id" is null and "performance_targets"."brand_id" is null and "performance_targets"."category_id" is not null)
      ))
);
--> statement-breakpoint
CREATE TABLE "product_insights" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_insights_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"product_id" bigint NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"performance" text,
	"campaign" text,
	"insight" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_insights_period_check" CHECK ("product_insights"."period_end" >= "product_insights"."period_start"),
	CONSTRAINT "product_insights_status_check" CHECK ("product_insights"."status" in ('active', 'slow', 'dead', 'out-of-stock')),
	CONSTRAINT "product_insights_performance_check" CHECK ("product_insights"."performance" is null or "product_insights"."performance" in ('strong', 'steady', 'underperforming'))
);
--> statement-breakpoint
CREATE TABLE "social_metrics" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "social_metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"platform" text NOT NULL,
	"brand_id" bigint,
	"followers" integer DEFAULT 0 NOT NULL,
	"posts" integer DEFAULT 0 NOT NULL,
	"reels" integer DEFAULT 0 NOT NULL,
	"stories" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"engagement" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"website_visits" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_metrics_counts_check" CHECK ("social_metrics"."followers" >= 0 and "social_metrics"."posts" >= 0 and "social_metrics"."reels" >= 0 and "social_metrics"."stories" >= 0 and "social_metrics"."reach" >= 0 and "social_metrics"."impressions" >= 0 and "social_metrics"."engagement" >= 0 and "social_metrics"."clicks" >= 0 and "social_metrics"."website_visits" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sop_reviews" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sop_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"store_id" bigint NOT NULL,
	"area" text NOT NULL,
	"compliance_score" integer NOT NULL,
	"deviations" text,
	"corrective_action" text,
	"reviewed_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sop_reviews_score_check" CHECK ("sop_reviews"."compliance_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "store_experience_reviews" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "store_experience_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"store_id" bigint NOT NULL,
	"category" text NOT NULL,
	"rating" integer NOT NULL,
	"nps_score" integer,
	"recommendation" text,
	"comments" text,
	"reviewed_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_experience_reviews_rating_check" CHECK ("store_experience_reviews"."rating" between 1 and 5),
	CONSTRAINT "store_experience_reviews_nps_check" CHECK ("store_experience_reviews"."nps_score" is null or "store_experience_reviews"."nps_score" between 0 and 10),
	CONSTRAINT "store_experience_reviews_recommendation_check" CHECK ("store_experience_reviews"."recommendation" is null or "store_experience_reviews"."recommendation" in ('yes', 'likely', 'no'))
);
--> statement-breakpoint
CREATE TABLE "store_standard_reviews" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "store_standard_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"store_id" bigint NOT NULL,
	"operations_score" integer NOT NULL,
	"vm_score" integer NOT NULL,
	"readiness_score" integer NOT NULL,
	"customer_experience_score" integer NOT NULL,
	"cleanliness_score" integer NOT NULL,
	"safety_score" integer NOT NULL,
	"issues" text,
	"reviewed_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_standard_reviews_scores_check" CHECK ("store_standard_reviews"."operations_score" between 0 and 100 and "store_standard_reviews"."vm_score" between 0 and 100 and "store_standard_reviews"."readiness_score" between 0 and 100 and "store_standard_reviews"."customer_experience_score" between 0 and 100 and "store_standard_reviews"."cleanliness_score" between 0 and 100 and "store_standard_reviews"."safety_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "visual_merchandising_reviews" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "visual_merchandising_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_date" date NOT NULL,
	"store_id" bigint NOT NULL,
	"window_display_score" integer NOT NULL,
	"mannequin_score" integer NOT NULL,
	"product_presentation_score" integer NOT NULL,
	"size_arrangement_score" integer NOT NULL,
	"improvements" text,
	"reviewed_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vm_reviews_scores_check" CHECK ("visual_merchandising_reviews"."window_display_score" between 0 and 100 and "visual_merchandising_reviews"."mannequin_score" between 0 and 100 and "visual_merchandising_reviews"."product_presentation_score" between 0 and 100 and "visual_merchandising_reviews"."size_arrangement_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "weekly_review_category_notes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "weekly_review_category_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"weekly_review_id" bigint NOT NULL,
	"category_id" bigint NOT NULL,
	"performance_comment" text,
	"overstocked" boolean DEFAULT false NOT NULL,
	"slow_moving" boolean DEFAULT false NOT NULL,
	"weeks_without_movement" integer,
	"value_at_risk" numeric(14, 2),
	"corrective_action" text,
	"manager_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_review_category_notes_risk_check" CHECK (("weekly_review_category_notes"."weeks_without_movement" is null or "weekly_review_category_notes"."weeks_without_movement" >= 0) and ("weekly_review_category_notes"."value_at_risk" is null or "weekly_review_category_notes"."value_at_risk" >= 0))
);
--> statement-breakpoint
CREATE TABLE "working_capital_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "working_capital_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"type" text NOT NULL,
	"entity" text NOT NULL,
	"original_amount" numeric(14, 2) NOT NULL,
	"open_amount" numeric(14, 2) NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_by_user_id" integer NOT NULL,
	"updated_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "working_capital_type_check" CHECK ("working_capital_items"."type" in ('debtor', 'creditor')),
	CONSTRAINT "working_capital_amounts_check" CHECK ("working_capital_items"."original_amount" > 0 and "working_capital_items"."open_amount" >= 0 and "working_capital_items"."open_amount" <= "working_capital_items"."original_amount"),
	CONSTRAINT "working_capital_status_check" CHECK ("working_capital_items"."status" in ('open', 'partial', 'settled', 'written-off'))
);
--> statement-breakpoint
CREATE TABLE "working_capital_settlements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "working_capital_settlements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"working_capital_item_id" bigint NOT NULL,
	"business_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"cash_account_id" bigint,
	"reference" text,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "working_capital_settlements_amount_check" CHECK ("working_capital_settlements"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check";--> statement-breakpoint
ALTER TABLE "daily_sales_lines" DROP CONSTRAINT "daily_sales_lines_discount_check";--> statement-breakpoint
ALTER TABLE "daily_sales_lines" DROP CONSTRAINT "daily_sales_lines_amounts_check";--> statement-breakpoint
ALTER TABLE "daily_sales_lines" DROP CONSTRAINT "daily_sales_lines_credit_check";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_sales_lines" ADD COLUMN "returns" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "type" text DEFAULT 'store' NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD COLUMN "marketing_amplify_category_id" bigint;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD COLUMN "different_this_week" text;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD COLUMN "first_three_actions" text;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD COLUMN "lock_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_health_assessments" ADD CONSTRAINT "brand_health_assessments_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_health_assessments" ADD CONSTRAINT "brand_health_assessments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_health_assessments" ADD CONSTRAINT "brand_health_assessments_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_sentiment_snapshots" ADD CONSTRAINT "brand_sentiment_snapshots_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_sentiment_snapshots" ADD CONSTRAINT "brand_sentiment_snapshots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_sentiment_snapshots" ADD CONSTRAINT "brand_sentiment_snapshots_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_snapshots" ADD CONSTRAINT "capital_snapshots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_snapshots" ADD CONSTRAINT "capital_snapshots_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_expense_category_id_expense_categories_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_cash_account_id_cash_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."cash_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clienteling_activities" ADD CONSTRAINT "clienteling_activities_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clienteling_activities" ADD CONSTRAINT "clienteling_activities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clienteling_activities" ADD CONSTRAINT "clienteling_activities_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_activities" ADD CONSTRAINT "competitor_activities_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_activities" ADD CONSTRAINT "competitor_activities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_activities" ADD CONSTRAINT "competitor_activities_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_captured_by_user_id_users_id_fk" FOREIGN KEY ("captured_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_reputation_snapshots" ADD CONSTRAINT "digital_reputation_snapshots_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_reputation_snapshots" ADD CONSTRAINT "digital_reputation_snapshots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_reputation_snapshots" ADD CONSTRAINT "digital_reputation_snapshots_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_forecasts" ADD CONSTRAINT "financial_forecasts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_forecasts" ADD CONSTRAINT "financial_forecasts_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_dispositions" ADD CONSTRAINT "inventory_dispositions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_dispositions" ADD CONSTRAINT "inventory_dispositions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_dispositions" ADD CONSTRAINT "inventory_dispositions_action_item_id_action_items_id_fk" FOREIGN KEY ("action_item_id") REFERENCES "public"."action_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_dispositions" ADD CONSTRAINT "inventory_dispositions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_dispositions" ADD CONSTRAINT "inventory_dispositions_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_metrics" ADD CONSTRAINT "lead_metrics_campaign_report_id_marketing_campaign_reports_id_fk" FOREIGN KEY ("campaign_report_id") REFERENCES "public"."marketing_campaign_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_metrics" ADD CONSTRAINT "lead_metrics_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_metrics" ADD CONSTRAINT "lead_metrics_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaign_reports" ADD CONSTRAINT "marketing_campaign_reports_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaign_reports" ADD CONSTRAINT "marketing_campaign_reports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaign_reports" ADD CONSTRAINT "marketing_campaign_reports_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_snapshots" ADD CONSTRAINT "people_snapshots_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_snapshots" ADD CONSTRAINT "people_snapshots_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_targets" ADD CONSTRAINT "performance_targets_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_targets" ADD CONSTRAINT "performance_targets_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_targets" ADD CONSTRAINT "performance_targets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_targets" ADD CONSTRAINT "performance_targets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_targets" ADD CONSTRAINT "performance_targets_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insights" ADD CONSTRAINT "product_insights_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insights" ADD CONSTRAINT "product_insights_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_insights" ADD CONSTRAINT "product_insights_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_metrics" ADD CONSTRAINT "social_metrics_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_metrics" ADD CONSTRAINT "social_metrics_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_metrics" ADD CONSTRAINT "social_metrics_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_reviews" ADD CONSTRAINT "sop_reviews_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sop_reviews" ADD CONSTRAINT "sop_reviews_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_experience_reviews" ADD CONSTRAINT "store_experience_reviews_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_experience_reviews" ADD CONSTRAINT "store_experience_reviews_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_standard_reviews" ADD CONSTRAINT "store_standard_reviews_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_standard_reviews" ADD CONSTRAINT "store_standard_reviews_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_merchandising_reviews" ADD CONSTRAINT "visual_merchandising_reviews_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_merchandising_reviews" ADD CONSTRAINT "visual_merchandising_reviews_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_review_category_notes" ADD CONSTRAINT "weekly_review_category_notes_weekly_review_id_weekly_reviews_id_fk" FOREIGN KEY ("weekly_review_id") REFERENCES "public"."weekly_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_review_category_notes" ADD CONSTRAINT "weekly_review_category_notes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_capital_items" ADD CONSTRAINT "working_capital_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_capital_items" ADD CONSTRAINT "working_capital_items_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_capital_settlements" ADD CONSTRAINT "working_capital_settlements_working_capital_item_id_working_capital_items_id_fk" FOREIGN KEY ("working_capital_item_id") REFERENCES "public"."working_capital_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_capital_settlements" ADD CONSTRAINT "working_capital_settlements_cash_account_id_cash_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."cash_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_capital_settlements" ADD CONSTRAINT "working_capital_settlements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_department_status_idx" ON "action_items" USING btree ("department","status","due_date");--> statement-breakpoint
CREATE INDEX "action_items_owner_status_idx" ON "action_items" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "action_items_store_idx" ON "action_items" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "action_items_source_idx" ON "action_items" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_health_brand_date_type_uidx" ON "brand_health_assessments" USING btree ("brand_id","business_date","type");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_sentiment_brand_date_source_uidx" ON "brand_sentiment_snapshots" USING btree ("brand_id","business_date","source");--> statement-breakpoint
CREATE UNIQUE INDEX "capital_snapshots_year_uidx" ON "capital_snapshots" USING btree ("year");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_accounts_code_lower_uidx" ON "cash_accounts" USING btree (lower("code"));--> statement-breakpoint
CREATE INDEX "cash_transactions_date_direction_idx" ON "cash_transactions" USING btree ("business_date","direction");--> statement-breakpoint
CREATE INDEX "cash_transactions_account_idx" ON "cash_transactions" USING btree ("cash_account_id","business_date");--> statement-breakpoint
CREATE INDEX "cash_transactions_source_idx" ON "cash_transactions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "clienteling_store_date_idx" ON "clienteling_activities" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE INDEX "competitor_activities_date_threat_idx" ON "competitor_activities" USING btree ("business_date","threat_level");--> statement-breakpoint
CREATE INDEX "competitor_activities_brand_idx" ON "competitor_activities" USING btree ("brand_id","business_date");--> statement-breakpoint
CREATE INDEX "customer_feedback_date_store_idx" ON "customer_feedback" USING btree ("business_date","store_id");--> statement-breakpoint
CREATE INDEX "customer_feedback_brand_idx" ON "customer_feedback" USING btree ("brand_id","business_date");--> statement-breakpoint
CREATE INDEX "customer_feedback_type_idx" ON "customer_feedback" USING btree ("type","business_date");--> statement-breakpoint
CREATE INDEX "digital_reputation_brand_date_idx" ON "digital_reputation_snapshots" USING btree ("brand_id","business_date");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_forecasts_period_uidx" ON "financial_forecasts" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "incidents_store_status_idx" ON "incidents" USING btree ("store_id","status","occurred_at");--> statement-breakpoint
CREATE INDEX "incidents_severity_status_idx" ON "incidents" USING btree ("severity","status");--> statement-breakpoint
CREATE INDEX "inventory_dispositions_store_status_idx" ON "inventory_dispositions" USING btree ("store_id","status","review_date");--> statement-breakpoint
CREATE INDEX "inventory_dispositions_product_idx" ON "inventory_dispositions" USING btree ("product_id","review_date");--> statement-breakpoint
CREATE INDEX "inventory_movements_product_store_date_idx" ON "inventory_movements" USING btree ("product_id","store_id","business_date");--> statement-breakpoint
CREATE INDEX "inventory_movements_store_date_idx" ON "inventory_movements" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE INDEX "inventory_movements_source_idx" ON "inventory_movements" USING btree ("source_type","source_id","source_line_id");--> statement-breakpoint
CREATE INDEX "lead_metrics_date_channel_idx" ON "lead_metrics" USING btree ("business_date","channel");--> statement-breakpoint
CREATE INDEX "lead_metrics_campaign_idx" ON "lead_metrics" USING btree ("campaign_report_id");--> statement-breakpoint
CREATE INDEX "maintenance_store_status_idx" ON "maintenance_requests" USING btree ("store_id","status","due_date");--> statement-breakpoint
CREATE INDEX "maintenance_assignee_status_idx" ON "maintenance_requests" USING btree ("assigned_to_user_id","status");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_brand_date_idx" ON "marketing_campaign_reports" USING btree ("brand_id","business_date");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_status_idx" ON "marketing_campaign_reports" USING btree ("status","business_date");--> statement-breakpoint
CREATE UNIQUE INDEX "people_snapshots_store_date_uidx" ON "people_snapshots" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE INDEX "targets_metric_period_idx" ON "performance_targets" USING btree ("metric","period_start","period_end");--> statement-breakpoint
CREATE INDEX "targets_store_idx" ON "performance_targets" USING btree ("store_id","period_start");--> statement-breakpoint
CREATE INDEX "targets_brand_idx" ON "performance_targets" USING btree ("brand_id","period_start");--> statement-breakpoint
CREATE INDEX "targets_category_idx" ON "performance_targets" USING btree ("category_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "product_insights_product_period_uidx" ON "product_insights" USING btree ("product_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "product_insights_status_idx" ON "product_insights" USING btree ("status","period_end");--> statement-breakpoint
CREATE INDEX "social_metrics_date_platform_idx" ON "social_metrics" USING btree ("business_date","platform");--> statement-breakpoint
CREATE INDEX "social_metrics_brand_idx" ON "social_metrics" USING btree ("brand_id","business_date");--> statement-breakpoint
CREATE INDEX "sop_reviews_store_date_idx" ON "sop_reviews" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE INDEX "sop_reviews_area_date_idx" ON "sop_reviews" USING btree ("area","business_date");--> statement-breakpoint
CREATE INDEX "store_experience_reviews_store_date_idx" ON "store_experience_reviews" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE INDEX "store_standard_reviews_store_date_idx" ON "store_standard_reviews" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE INDEX "vm_reviews_store_date_idx" ON "visual_merchandising_reviews" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_review_category_notes_review_category_uidx" ON "weekly_review_category_notes" USING btree ("weekly_review_id","category_id");--> statement-breakpoint
CREATE INDEX "weekly_review_category_notes_category_idx" ON "weekly_review_category_notes" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "working_capital_type_status_due_idx" ON "working_capital_items" USING btree ("type","status","due_date");--> statement-breakpoint
CREATE INDEX "working_capital_settlements_item_idx" ON "working_capital_settlements" USING btree ("working_capital_item_id","business_date");--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_marketing_amplify_category_id_categories_id_fk" FOREIGN KEY ("marketing_amplify_category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "weekly_reviews_amplify_category_idx" ON "weekly_reviews" USING btree ("marketing_amplify_category_id");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("audit_events"."action" in ('create', 'update', 'submit', 'approve', 'reopen', 'cancel', 'complete', 'archive', 'restore', 'import', 'settle', 'authorize', 'receive'));--> statement-breakpoint
ALTER TABLE "daily_sales_lines" ADD CONSTRAINT "daily_sales_lines_deductions_check" CHECK ("daily_sales_lines"."discounts" + "daily_sales_lines"."returns" <= "daily_sales_lines"."gross_revenue");--> statement-breakpoint
ALTER TABLE "daily_sales_lines" ADD CONSTRAINT "daily_sales_lines_amounts_check" CHECK ("daily_sales_lines"."gross_revenue" >= 0 and "daily_sales_lines"."cogs" >= 0 and "daily_sales_lines"."discounts" >= 0 and "daily_sales_lines"."returns" >= 0 and "daily_sales_lines"."credit_sales" >= 0);--> statement-breakpoint
ALTER TABLE "daily_sales_lines" ADD CONSTRAINT "daily_sales_lines_credit_check" CHECK ("daily_sales_lines"."credit_sales" <= "daily_sales_lines"."gross_revenue" - "daily_sales_lines"."discounts" - "daily_sales_lines"."returns");--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_type_check" CHECK ("stores"."type" in ('store', 'warehouse', 'office'));--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_lock_version_check" CHECK ("weekly_reviews"."lock_version" > 0);