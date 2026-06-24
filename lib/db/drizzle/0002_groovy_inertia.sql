CREATE TABLE "geo_aeo_monitoring_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"run_month" text NOT NULL,
	"baseline_month" text,
	"comparison_month" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"baseline_score" real,
	"current_score" real,
	"score_delta" real,
	"baseline_snapshot_count" integer DEFAULT 0 NOT NULL,
	"current_snapshot_count" integer DEFAULT 0 NOT NULL,
	"action_plan_template" jsonb,
	"report_template" jsonb,
	"summary" text,
	"notes" text,
	"created_by_id" integer,
	"updated_by_id" integer,
	"approved_by_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "geo_aeo_audits" ADD COLUMN "monitoring_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "geo_aeo_audits" ADD COLUMN "monitoring_cadence" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "geo_aeo_audits" ADD COLUMN "next_monitoring_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "geo_aeo_monitoring_runs" ADD CONSTRAINT "geo_aeo_monitoring_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_monitoring_runs" ADD CONSTRAINT "geo_aeo_monitoring_runs_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_monitoring_runs" ADD CONSTRAINT "geo_aeo_monitoring_runs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_monitoring_runs" ADD CONSTRAINT "geo_aeo_monitoring_runs_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_monitoring_runs" ADD CONSTRAINT "geo_aeo_monitoring_runs_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geo_aeo_monitoring_runs_tenant_idx" ON "geo_aeo_monitoring_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_monitoring_runs_audit_idx" ON "geo_aeo_monitoring_runs" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_monitoring_runs_month_idx" ON "geo_aeo_monitoring_runs" USING btree ("run_month");--> statement-breakpoint
CREATE INDEX "geo_aeo_monitoring_runs_status_idx" ON "geo_aeo_monitoring_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "geo_aeo_audits_monitoring_idx" ON "geo_aeo_audits" USING btree ("monitoring_enabled","next_monitoring_run_at");