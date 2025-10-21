-- Create enums for the task and automation subsystem
DO $$ BEGIN
    CREATE TYPE "RelatedType" AS ENUM ('LEAD', 'PROJECT', 'QUOTE', 'EMAIL', 'QUESTIONNAIRE', 'WORKSHOP', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "AssigneeRole" AS ENUM ('OWNER', 'FOLLOWER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "SubtaskStatus" AS ENUM ('OPEN', 'DONE');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_DUE_SOON', 'TASK_OVERDUE', 'MENTION', 'STREAK', 'SUMMARY');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ActivityEntity" AS ENUM ('TASK', 'RULE', 'PROJECT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "ActivityVerb" AS ENUM ('CREATED', 'ASSIGNED', 'STARTED', 'COMPLETED', 'REOPENED', 'OVERDUE', 'NUDGED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Core task tables
CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "relatedType" "RelatedType" NOT NULL,
    "relatedId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN'::"TaskStatus",
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM'::"TaskPriority",
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "autocreated" BOOLEAN NOT NULL DEFAULT TRUE,
    "meta" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AssigneeRole" NOT NULL DEFAULT 'OWNER'::"AssigneeRole",
    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId", "userId"),
    CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Subtask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SubtaskStatus" NOT NULL DEFAULT 'OPEN'::"SubtaskStatus",
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Automation + notification primitives referenced by the task system
CREATE TABLE IF NOT EXISTS "AutomationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "trigger" JSONB NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Streak" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" TIMESTAMP(3),
    CONSTRAINT "Streak_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Streak_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entity" "ActivityEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "verb" "ActivityVerb" NOT NULL,
    "actorId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActivityLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UserPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifications" JSONB,
    "quietHours" JSONB,
    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Supporting indexes and unique constraints
CREATE INDEX IF NOT EXISTS "Task_tenantId_status_dueAt_idx" ON "Task" ("tenantId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "Task_tenantId_relatedType_relatedId_idx" ON "Task" ("tenantId", "relatedType", "relatedId");
CREATE INDEX IF NOT EXISTS "Subtask_taskId_idx" ON "Subtask" ("taskId");
CREATE INDEX IF NOT EXISTS "AutomationRule_tenantId_enabled_idx" ON "AutomationRule" ("tenantId", "enabled");
CREATE INDEX IF NOT EXISTS "Notification_tenantId_userId_readAt_idx" ON "Notification" ("tenantId", "userId", "readAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Streak_tenantId_userId_key" ON "Streak" ("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "ActivityLog_tenantId_entity_entityId_idx" ON "ActivityLog" ("tenantId", "entity", "entityId");
CREATE INDEX IF NOT EXISTS "ActivityLog_tenantId_verb_idx" ON "ActivityLog" ("tenantId", "verb");
CREATE UNIQUE INDEX IF NOT EXISTS "UserPreference_tenantId_userId_key" ON "UserPreference" ("tenantId", "userId");
