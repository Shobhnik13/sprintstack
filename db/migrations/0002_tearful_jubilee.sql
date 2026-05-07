CREATE TYPE "public"."status_category" AS ENUM('todo', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."transition_action_type" AS ENUM('assign_user', 'set_field', 'send_notification');--> statement-breakpoint
CREATE TYPE "public"."transition_condition_type" AS ENUM('field_required', 'field_value');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" varchar(10) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_workspace_id_key_unique" UNIQUE("workspace_id","key")
);
--> statement-breakpoint
CREATE TABLE "workflow_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) DEFAULT '#6B7280' NOT NULL,
	"position" integer NOT NULL,
	"category" "status_category" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_transition_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transition_id" uuid NOT NULL,
	"action_type" "transition_action_type" NOT NULL,
	"action_config" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_transition_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transition_id" uuid NOT NULL,
	"condition_type" "transition_condition_type" NOT NULL,
	"condition_config" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"from_status_id" uuid,
	"to_status_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_statuses" ADD CONSTRAINT "workflow_statuses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transition_actions" ADD CONSTRAINT "workflow_transition_actions_transition_id_workflow_transitions_id_fk" FOREIGN KEY ("transition_id") REFERENCES "public"."workflow_transitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transition_conditions" ADD CONSTRAINT "workflow_transition_conditions_transition_id_workflow_transitions_id_fk" FOREIGN KEY ("transition_id") REFERENCES "public"."workflow_transitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_status_id_workflow_statuses_id_fk" FOREIGN KEY ("from_status_id") REFERENCES "public"."workflow_statuses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_status_id_workflow_statuses_id_fk" FOREIGN KEY ("to_status_id") REFERENCES "public"."workflow_statuses"("id") ON DELETE cascade ON UPDATE no action;