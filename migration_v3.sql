-- V3 Migration: Auto-reply formatting, Success URL, and Failure Logs

-- 1. Add new configuration columns to forms table
ALTER TABLE forms
ADD COLUMN IF NOT EXISTS auto_reply_subject TEXT,
ADD COLUMN IF NOT EXISTS auto_reply_message TEXT,
ADD COLUMN IF NOT EXISTS success_url TEXT;

-- 2. Create the failures_log table to track failed submissions and spam attempts
CREATE TABLE IF NOT EXISTS failures_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID REFERENCES forms(id) ON DELETE SET NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: Ensure RLS is enabled if needed, though API uses Service Role Key which bypasses RLS.
ALTER TABLE failures_log ENABLE ROW LEVEL SECURITY;
