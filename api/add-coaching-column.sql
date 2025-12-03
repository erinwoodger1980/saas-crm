-- Add isGroupCoachingMember column to TenantSettings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'TenantSettings' 
        AND column_name = 'isGroupCoachingMember'
    ) THEN
        ALTER TABLE "TenantSettings" 
        ADD COLUMN "isGroupCoachingMember" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
