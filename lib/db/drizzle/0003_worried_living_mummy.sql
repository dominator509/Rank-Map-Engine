CREATE TABLE "geo_aeo_import_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"audit_id" integer NOT NULL,
	"import_type" text NOT NULL,
	"source" text DEFAULT 'csv' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"invalid_rows" integer DEFAULT 0 NOT NULL,
	"duplicate_rows" integer DEFAULT 0 NOT NULL,
	"created_by_id" integer,
	"deleted_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "geo_aeo_answer_snapshots" ADD COLUMN "import_batch_id" integer;--> statement-breakpoint
ALTER TABLE "geo_aeo_mentions" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "geo_aeo_import_batches" ADD CONSTRAINT "geo_aeo_import_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_import_batches" ADD CONSTRAINT "geo_aeo_import_batches_audit_id_geo_aeo_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."geo_aeo_audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_import_batches" ADD CONSTRAINT "geo_aeo_import_batches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_aeo_import_batches" ADD CONSTRAINT "geo_aeo_import_batches_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geo_aeo_import_batches_tenant_idx" ON "geo_aeo_import_batches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_import_batches_audit_idx" ON "geo_aeo_import_batches" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "geo_aeo_import_batches_type_idx" ON "geo_aeo_import_batches" USING btree ("import_type");--> statement-breakpoint
CREATE INDEX "geo_aeo_import_batches_status_idx" ON "geo_aeo_import_batches" USING btree ("status");--> statement-breakpoint
ALTER TABLE "geo_aeo_answer_snapshots" ADD CONSTRAINT "geo_aeo_answer_snapshots_import_batch_id_geo_aeo_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."geo_aeo_import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geo_aeo_answer_snapshots_import_batch_idx" ON "geo_aeo_answer_snapshots" USING btree ("import_batch_id");