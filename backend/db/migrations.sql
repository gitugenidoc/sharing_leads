-- Migration: Add lead cancellation support (2024)
-- This migration adds support for temporary lead cancellations

-- Add new columns to leads table if they don't exist
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cancellation_expiry TIMESTAMP;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_leads_cancellation_expiry ON leads(cancellation_expiry);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_at ON leads(assigned_at);

-- Backfill assigned_at for already assigned leads
UPDATE leads 
SET assigned_at = created_at 
WHERE assigned_to IS NOT NULL AND assigned_at IS NULL;
