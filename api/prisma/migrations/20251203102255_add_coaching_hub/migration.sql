-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "isGroupCoachingMember" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "GoalTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "FinancialTargetHorizon" AS ENUM ('YEAR', 'FIVE_YEAR');

-- CreateTable
CREATE TABLE IF NOT EXISTS "GoalPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoalPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MonthlyGoal" (
    "id" TEXT NOT NULL,
    "goalPlanId" TEXT NOT NULL,
    "monthNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT true,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "MonthlyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeeklyGoal" (
    "id" TEXT NOT NULL,
    "monthlyGoalId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT true,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "WeeklyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GoalTask" (
    "id" TEXT NOT NULL,
    "weeklyGoalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "GoalTaskStatus" NOT NULL DEFAULT 'TODO',
    "aiSuggested" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GoalTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CoachingNote" (
    "id" TEXT NOT NULL,
    "goalPlanId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL,
    "commitments" TEXT[],
    "autoAddToTasks" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoachingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinancialPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinancialYear" (
    "id" TEXT NOT NULL,
    "financialPlanId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MonthlyPnl" (
    "id" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "monthNumber" INTEGER NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "directLabour" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "materials" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketing" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overheads" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlyPnl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinancialTarget" (
    "id" TEXT NOT NULL,
    "financialPlanId" TEXT NOT NULL,
    "horizon" "FinancialTargetHorizon" NOT NULL,
    "year" INTEGER,
    "revenueTarget" DOUBLE PRECISION,
    "grossProfitTarget" DOUBLE PRECISION,
    "netProfitTarget" DOUBLE PRECISION,
    "grossMarginTarget" DOUBLE PRECISION,
    "netMarginTarget" DOUBLE PRECISION,
    "labourPctTarget" DOUBLE PRECISION,
    "materialsPctTarget" DOUBLE PRECISION,
    "marketingPctTarget" DOUBLE PRECISION,
    "overheadsPctTarget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GoalPlan_tenantId_ownerUserId_idx" ON "GoalPlan"("tenantId", "ownerUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MonthlyGoal_goalPlanId_monthNumber_idx" ON "MonthlyGoal"("goalPlanId", "monthNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyGoal_monthlyGoalId_weekNumber_idx" ON "WeeklyGoal"("monthlyGoalId", "weekNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GoalTask_weeklyGoalId_status_idx" ON "GoalTask"("weeklyGoalId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CoachingNote_goalPlanId_sessionDate_idx" ON "CoachingNote"("goalPlanId", "sessionDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialPlan_tenantId_startYear_idx" ON "FinancialPlan"("tenantId", "startYear");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialYear_financialPlanId_year_idx" ON "FinancialYear"("financialPlanId", "year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MonthlyPnl_financialYearId_monthNumber_idx" ON "MonthlyPnl"("financialYearId", "monthNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialTarget_financialPlanId_horizon_idx" ON "FinancialTarget"("financialPlanId", "horizon");

-- AddForeignKey
ALTER TABLE "GoalPlan" ADD CONSTRAINT "GoalPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPlan" ADD CONSTRAINT "GoalPlan_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGoal" ADD CONSTRAINT "MonthlyGoal_goalPlanId_fkey" FOREIGN KEY ("goalPlanId") REFERENCES "GoalPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyGoal" ADD CONSTRAINT "WeeklyGoal_monthlyGoalId_fkey" FOREIGN KEY ("monthlyGoalId") REFERENCES "MonthlyGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalTask" ADD CONSTRAINT "GoalTask_weeklyGoalId_fkey" FOREIGN KEY ("weeklyGoalId") REFERENCES "WeeklyGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingNote" ADD CONSTRAINT "CoachingNote_goalPlanId_fkey" FOREIGN KEY ("goalPlanId") REFERENCES "GoalPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPlan" ADD CONSTRAINT "FinancialPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialYear" ADD CONSTRAINT "FinancialYear_financialPlanId_fkey" FOREIGN KEY ("financialPlanId") REFERENCES "FinancialPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyPnl" ADD CONSTRAINT "MonthlyPnl_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTarget" ADD CONSTRAINT "FinancialTarget_financialPlanId_fkey" FOREIGN KEY ("financialPlanId") REFERENCES "FinancialPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
