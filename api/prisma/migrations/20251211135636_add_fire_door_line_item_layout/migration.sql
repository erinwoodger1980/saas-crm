-- Add fire door line item display layout configuration
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "fireDoorLineItemLayout" JSONB;
