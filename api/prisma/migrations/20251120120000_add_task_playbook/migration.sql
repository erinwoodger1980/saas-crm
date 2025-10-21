ALTER TABLE "TenantSettings"
ADD COLUMN "taskPlaybook" JSONB NOT NULL DEFAULT '{}'::jsonb;
