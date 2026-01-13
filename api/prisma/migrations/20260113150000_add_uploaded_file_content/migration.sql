-- Add DB-backed content bytes for UploadedFile so PDFs can be processed even if local disk is ephemeral.
ALTER TABLE "public"."UploadedFile" ADD COLUMN IF NOT EXISTS "content" BYTEA;
