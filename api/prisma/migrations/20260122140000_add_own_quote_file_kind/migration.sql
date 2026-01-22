-- Add OWN_QUOTE to FileKind enum
-- Postgres note: enum values can only be appended.
ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'OWN_QUOTE';
