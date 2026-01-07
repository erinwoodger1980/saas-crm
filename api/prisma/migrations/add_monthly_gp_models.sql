-- Add GP calculation fields to Opportunity model
ALTER TABLE public."Opportunity" ADD COLUMN IF NOT EXISTS "contractValue" DECIMAL;
ALTER TABLE public."Opportunity" ADD COLUMN IF NOT EXISTS "budgetHours" DECIMAL;
ALTER TABLE public."Opportunity" ADD COLUMN IF NOT EXISTS "materialTotal" DECIMAL;
ALTER TABLE public."Opportunity" ADD COLUMN IF NOT EXISTS "materialsToDate" DECIMAL;

-- Create MonthlyWageBill table
CREATE TABLE IF NOT EXISTS public."MonthlyWageBill" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "wageBill" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyWageBill_pkey" PRIMARY KEY ("id")
);

-- Create MonthlyProjectMetrics table
CREATE TABLE IF NOT EXISTS public."MonthlyProjectMetrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "hoursThisMonth" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "hoursToDate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "percentCompleteThisMonth" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "percentCompleteToDate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "revenueThisMonth" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "labourCostThisMonth" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "materialsCostThisMonth" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCostThisMonth" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "grossProfitThisMonth" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "grossProfitPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyProjectMetrics_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
DO $$ BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyWageBill_tenantId_month_key" ON public."MonthlyWageBill"("tenantId", "month");
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyProjectMetrics_tenantId_projectId_month_key" ON public."MonthlyProjectMetrics"("tenantId", "projectId", "month");
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- Create indexes
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS "MonthlyWageBill_tenantId_month_idx" ON public."MonthlyWageBill"("tenantId", "month");
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS "MonthlyProjectMetrics_tenantId_month_idx" ON public."MonthlyProjectMetrics"("tenantId", "month");
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS "MonthlyProjectMetrics_projectId_month_idx" ON public."MonthlyProjectMetrics"("projectId", "month");
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- Add foreign key constraints
DO $$ BEGIN
    ALTER TABLE public."MonthlyWageBill" ADD CONSTRAINT "MonthlyWageBill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public."MonthlyProjectMetrics" ADD CONSTRAINT "MonthlyProjectMetrics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public."MonthlyProjectMetrics" ADD CONSTRAINT "MonthlyProjectMetrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
