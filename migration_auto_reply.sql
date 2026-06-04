-- Migration: Add auto-reply fields to forms table
ALTER TABLE forms ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS auto_reply_subject TEXT DEFAULT 'Confirmation de réception';
ALTER TABLE forms ADD COLUMN IF NOT EXISTS auto_reply_message TEXT DEFAULT '';
