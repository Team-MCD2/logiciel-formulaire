-- Migration V2: Add branding configuration to clients table

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'sans-serif';
