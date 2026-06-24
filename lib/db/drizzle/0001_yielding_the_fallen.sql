CREATE TABLE "geo_aeo_action_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"action_plan_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"week_number" integer DEFAULT 1 NOT NULL,
	"owner_role" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"related_finding_id" integer,
	"related_prompt_id" integer,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_action_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"name" text NOT NULL,
	"time_horizon_days" integer DEFAULT 30 NOT NULL,
	"summary" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" integer,
	"updated_by_id" integer,
	"approved_by_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_answer_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"prompt_id" integer NOT NULL,
	"prompt_variant_id" integer,
	"engine" text NOT NULL,
	"engine_mode" text DEFAULT 'consumer_manual' NOT NULL,
	"capture_method" text NOT NULL,
	"answer_text" text NOT NULL,
	"answer_hash" text NOT NULL,
	"location_context" text,
	"client_mentioned" boolean DEFAULT false NOT NULL,
	"client_cited" boolean DEFAULT false NOT NULL,
	"sentiment" text,
	"accuracy_risk_score" real,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" integer,
	"approved_by_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"project_id" integer,
	"audit_name" text NOT NULL,
	"website_url" text NOT NULL,
	"niche" text NOT NULL,
	"services_or_products" jsonb,
	"target_location" text,
	"target_audience" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"business_facts" jsonb,
	"visibility_score" real,
	"visibility_label" text,
	"summary" text,
	"created_by_id" integer,
	"updated_by_id" integer,
	"approved_by_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_citations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"snapshot_id" integer,
	"url" text,
	"source_name" text,
	"source_type" text,
	"is_client_owned" boolean DEFAULT false NOT NULL,
	"is_competitor_owned" boolean DEFAULT false NOT NULL,
	"authority_estimate" real,
	"notes" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_competitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"name" text NOT NULL,
	"website_url" text,
	"aliases" jsonb,
	"notes" text,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_engines" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"engine" text NOT NULL,
	"display_name" text NOT NULL,
	"mode" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_findings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"finding_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"evidence" jsonb,
	"recommendation" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" integer,
	"updated_by_id" integer,
	"approved_by_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"snapshot_id" integer NOT NULL,
	"mentioned_entity_type" text NOT NULL,
	"mentioned_entity_name" text NOT NULL,
	"is_client" boolean DEFAULT false NOT NULL,
	"is_competitor" boolean DEFAULT false NOT NULL,
	"position" integer,
	"sentiment" text,
	"evidence_snippet" text,
	"confidence_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_prompt_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_prompt_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"prompt_id" integer NOT NULL,
	"variant_text" text NOT NULL,
	"variant_type" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"prompt_set_id" integer,
	"prompt_text" text NOT NULL,
	"normalized_prompt" text,
	"intent" text,
	"funnel_stage" text,
	"service_or_product" text,
	"location" text,
	"priority" integer DEFAULT 50 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_schema_findings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"page_url" text,
	"schema_type" text,
	"issue_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"recommendation" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_source_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text,
	"source_type" text,
	"reason" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_id" integer,
	"updated_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_aeo_visibility_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"score" real NOT NULL,
	"label" text NOT NULL,
	"inputs" jsonb,
	"explanations" jsonb,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"override_reason" text,
	"overridden_by_id" integer,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "geo_aeo_action_items" ADD CONSTRAINT "geo_aeo_action_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_action_items" ADD CONSTRAINT "geo_aeo_action_items_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_action_items" ADD CONSTRAINT "geo_aeo_action_items_action_plan_id_geo_aeo_action_plans_id_fk" FOREIGN KEY ("action_plan_id") REFERENCES "public"."geo_aeo_action_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_action_items" ADD CONSTRAINT "geo_aeo_action_items_related_finding_id_geo_aeo_findings_id_fk" FOREIGN KEY ("related_finding_id") REFERENCES "public"."geo_aeo_findings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_action_items" ADD CONSTRAINT "geo_aeo_action_items_related_prompt_id_geo_aeo_prompts_id_fk" FOREIGN KEY ("related_prompt_id") REFERENCES "public"."geo_aeo_prompts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_action_items" ADD CONSTRAINT "geo_aeo_action_items_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_action_items" ADD CONSTRAINT "geo_aeo_action_items_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_action_plans" ADD CONSTRAINT "geo_aeo_action_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_action_plans" ADD CONSTRAINT "geo_aeo_action_plans_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_action_plans" ADD CONSTRAINT "geo_aeo_action_plans_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_action_plans" ADD CONSTRAINT "geo_aeo_action_plans_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_action_plans" ADD CONSTRAINT "geo_aeo_action_plans_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_answer_snapshots" ADD CONSTRAINT "geo_aeo_answer_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_answer_snapshots" ADD CONSTRAINT "geo_aeo_answer_snapshots_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_answer_snapshots" ADD CONSTRAINT "geo_aeo_answer_snapshots_prompt_id_geo_aeo_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."geo_aeo_prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_answer_snapshots" ADD CONSTRAINT "geo_aeo_answer_snapshots_prompt_variant_id_geo_aeo_prompt_variants_id_fk" FOREIGN KEY ("prompt_variant_id") REFERENCES "public"."geo_aeo_prompt_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_answer_snapshots" ADD CONSTRAINT "geo_aeo_answer_snapshots_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_answer_snapshots" ADD CONSTRAINT "geo_aeo_answer_snapshots_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_audits" ADD CONSTRAINT "geo_aeo_audits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_audits" ADD CONSTRAINT "geo_aeo_audits_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_audits" ADD CONSTRAINT "geo_aeo_audits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_audits" ADD CONSTRAINT "geo_aeo_audits_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_audits" ADD CONSTRAINT "geo_aeo_audits_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_audits" ADD CONSTRAINT "geo_aeo_audits_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_citations" ADD CONSTRAINT "geo_aeo_citations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_citations" ADD CONSTRAINT "geo_aeo_citations_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_citations" ADD CONSTRAINT "geo_aeo_citations_snapshot_id_geo_aeo_answer_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."geo_aeo_answer_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_citations" ADD CONSTRAINT "geo_aeo_citations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_competitors" ADD CONSTRAINT "geo_aeo_competitors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_competitors" ADD CONSTRAINT "geo_aeo_competitors_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_competitors" ADD CONSTRAINT "geo_aeo_competitors_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_engines" ADD CONSTRAINT "geo_aeo_engines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_engines" ADD CONSTRAINT "geo_aeo_engines_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_findings" ADD CONSTRAINT "geo_aeo_findings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_findings" ADD CONSTRAINT "geo_aeo_findings_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_findings" ADD CONSTRAINT "geo_aeo_findings_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_findings" ADD CONSTRAINT "geo_aeo_findings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_findings" ADD CONSTRAINT "geo_aeo_findings_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_mentions" ADD CONSTRAINT "geo_aeo_mentions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_mentions" ADD CONSTRAINT "geo_aeo_mentions_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_mentions" ADD CONSTRAINT "geo_aeo_mentions_snapshot_id_geo_aeo_answer_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."geo_aeo_answer_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompt_sets" ADD CONSTRAINT "geo_aeo_prompt_sets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompt_sets" ADD CONSTRAINT "geo_aeo_prompt_sets_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompt_sets" ADD CONSTRAINT "geo_aeo_prompt_sets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompt_variants" ADD CONSTRAINT "geo_aeo_prompt_variants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompt_variants" ADD CONSTRAINT "geo_aeo_prompt_variants_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompt_variants" ADD CONSTRAINT "geo_aeo_prompt_variants_prompt_id_geo_aeo_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."geo_aeo_prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompt_variants" ADD CONSTRAINT "geo_aeo_prompt_variants_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompts" ADD CONSTRAINT "geo_aeo_prompts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompts" ADD CONSTRAINT "geo_aeo_prompts_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompts" ADD CONSTRAINT "geo_aeo_prompts_prompt_set_id_geo_aeo_prompt_sets_id_fk" FOREIGN KEY ("prompt_set_id") REFERENCES "public"."geo_aeo_prompt_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompts" ADD CONSTRAINT "geo_aeo_prompts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_prompts" ADD CONSTRAINT "geo_aeo_prompts_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_schema_findings" ADD CONSTRAINT "geo_aeo_schema_findings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_schema_findings" ADD CONSTRAINT "geo_aeo_schema_findings_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_schema_findings" ADD CONSTRAINT "geo_aeo_schema_findings_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_schema_findings" ADD CONSTRAINT "geo_aeo_schema_findings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_source_recommendations" ADD CONSTRAINT "geo_aeo_source_recommendations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_source_recommendations" ADD CONSTRAINT "geo_aeo_source_recommendations_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_source_recommendations" ADD CONSTRAINT "geo_aeo_source_recommendations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_source_recommendations" ADD CONSTRAINT "geo_aeo_source_recommendations_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_visibility_scores" ADD CONSTRAINT "geo_aeo_visibility_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_visibility_scores" ADD CONSTRAINT "geo_aeo_visibility_scores_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_visibility_scores" ADD CONSTRAINT "geo_aeo_visibility_scores_overridden_by_id_users_id_fk" FOREIGN KEY ("overridden_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_visibility_scores" ADD CONSTRAINT "geo_aeo_visibility_scores_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geo_aeo_action_items_tenant_idx" ON "geo_aeo_action_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_action_items_audit_idx" ON "geo_aeo_action_items" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_action_items_plan_idx" ON "geo_aeo_action_items" USING btree ("action_plan_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_action_items_status_idx" ON "geo_aeo_action_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "geo_aeo_action_plans_tenant_idx" ON "geo_aeo_action_plans" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_action_plans_audit_idx" ON "geo_aeo_action_plans" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_action_plans_status_idx" ON "geo_aeo_action_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "geo_aeo_answer_snapshots_tenant_idx" ON "geo_aeo_answer_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_answer_snapshots_audit_idx" ON "geo_aeo_answer_snapshots" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_answer_snapshots_prompt_idx" ON "geo_aeo_answer_snapshots" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_answer_snapshots_engine_idx" ON "geo_aeo_answer_snapshots" USING btree ("engine");--> statement-breakpoint
CREATE INDEX "geo_aeo_answer_snapshots_capture_idx" ON "geo_aeo_answer_snapshots" USING btree ("capture_method");--> statement-breakpoint
CREATE INDEX "geo_aeo_audits_tenant_idx" ON "geo_aeo_audits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_audits_client_idx" ON "geo_aeo_audits" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_audits_project_idx" ON "geo_aeo_audits" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_audits_status_idx" ON "geo_aeo_audits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "geo_aeo_citations_tenant_idx" ON "geo_aeo_citations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_citations_audit_idx" ON "geo_aeo_citations" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_citations_snapshot_idx" ON "geo_aeo_citations" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_competitors_tenant_idx" ON "geo_aeo_competitors" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_competitors_audit_idx" ON "geo_aeo_competitors" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_engines_tenant_idx" ON "geo_aeo_engines" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_engines_audit_idx" ON "geo_aeo_engines" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_engines_engine_idx" ON "geo_aeo_engines" USING btree ("engine");--> statement-breakpoint
CREATE INDEX "geo_aeo_findings_tenant_idx" ON "geo_aeo_findings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_findings_audit_idx" ON "geo_aeo_findings" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_findings_type_idx" ON "geo_aeo_findings" USING btree ("finding_type");--> statement-breakpoint
CREATE INDEX "geo_aeo_findings_status_idx" ON "geo_aeo_findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "geo_aeo_mentions_tenant_idx" ON "geo_aeo_mentions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_mentions_audit_idx" ON "geo_aeo_mentions" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_mentions_snapshot_idx" ON "geo_aeo_mentions" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_prompt_sets_tenant_idx" ON "geo_aeo_prompt_sets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_prompt_sets_audit_idx" ON "geo_aeo_prompt_sets" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_prompt_sets_status_idx" ON "geo_aeo_prompt_sets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "geo_aeo_prompt_variants_tenant_idx" ON "geo_aeo_prompt_variants" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_prompt_variants_audit_idx" ON "geo_aeo_prompt_variants" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_prompt_variants_prompt_idx" ON "geo_aeo_prompt_variants" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_prompt_variants_status_idx" ON "geo_aeo_prompt_variants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "geo_aeo_prompts_tenant_idx" ON "geo_aeo_prompts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_prompts_audit_idx" ON "geo_aeo_prompts" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_prompts_prompt_set_idx" ON "geo_aeo_prompts" USING btree ("prompt_set_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_prompts_status_idx" ON "geo_aeo_prompts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "geo_aeo_schema_findings_tenant_idx" ON "geo_aeo_schema_findings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_schema_findings_audit_idx" ON "geo_aeo_schema_findings" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_schema_findings_status_idx" ON "geo_aeo_schema_findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "geo_aeo_source_recommendations_tenant_idx" ON "geo_aeo_source_recommendations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_source_recommendations_audit_idx" ON "geo_aeo_source_recommendations" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_source_recommendations_status_idx" ON "geo_aeo_source_recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "geo_aeo_visibility_scores_tenant_idx" ON "geo_aeo_visibility_scores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_visibility_scores_audit_idx" ON "geo_aeo_visibility_scores" USING btree ("audit_id");