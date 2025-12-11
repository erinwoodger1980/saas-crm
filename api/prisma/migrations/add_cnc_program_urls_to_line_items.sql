-- Add CNC program URL fields to FireDoorLineItem for QR code generation
-- These URLs will link to calculated CNC program files for Initial CNC and Final CNC Trim processes
-- Idempotent: only adds columns if they don't exist

ALTER TABLE "FireDoorLineItem" ADD COLUMN IF NOT EXISTS "initialCncProgramUrl" TEXT;
ALTER TABLE "FireDoorLineItem" ADD COLUMN IF NOT EXISTS "finalCncTrimProgramUrl" TEXT;
