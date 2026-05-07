CREATE TYPE "public"."sprint_status" AS ENUM('planning', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'number', 'dropdown', 'date');--> statement-breakpoint
CREATE TYPE "public"."issue_priority" AS ENUM('lowest', 'low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('epic', 'story', 'task', 'bug', 'subtask');--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"goal" text,
	"status" "sprint_status" DEFAULT 'planning' NOT NULL,
	"start_date" date,
	"end_date" date,
	"completed_at" timestamp with time zone,
	"velocity_points" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"field_type" "custom_field_type" NOT NULL,
	"options" jsonb,
	"is_required" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_custom_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"field_def_id" uuid NOT NULL,
	"value_text" text,
	"value_number" integer,
	"value_date" date,
	"value_option" text
);
--> statement-breakpoint
CREATE TABLE "issue_watchers" (
	"issue_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "issue_watchers_issue_id_user_id_pk" PRIMARY KEY("issue_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_number" integer NOT NULL,
	"type" "issue_type" DEFAULT 'task' NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status_id" uuid NOT NULL,
	"priority" "issue_priority" DEFAULT 'medium' NOT NULL,
	"assignee_id" uuid,
	"reporter_id" uuid NOT NULL,
	"parent_id" uuid,
	"sprint_id" uuid,
	"story_points" integer,
	"labels" text[],
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_custom_field_values" ADD CONSTRAINT "issue_custom_field_values_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_custom_field_values" ADD CONSTRAINT "issue_custom_field_values_field_def_id_custom_field_definitions_id_fk" FOREIGN KEY ("field_def_id") REFERENCES "public"."custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_watchers" ADD CONSTRAINT "issue_watchers_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_watchers" ADD CONSTRAINT "issue_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_status_id_workflow_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."workflow_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_id_issues_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issues_project_status_idx" ON "issues" USING btree ("project_id","status_id");--> statement-breakpoint
CREATE INDEX "issues_project_sprint_idx" ON "issues" USING btree ("project_id","sprint_id");--> statement-breakpoint
CREATE INDEX "issues_assignee_idx" ON "issues" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "issues_parent_idx" ON "issues" USING btree ("parent_id");