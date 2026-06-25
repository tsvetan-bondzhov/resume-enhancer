-- Story 8.1: Custom Template Data Model & CRUD API
-- Adds an ownership index to support querying a user's own custom templates.
-- The owner_id, is_prebuilt, and is_published columns already exist from V4 — do NOT re-add them.
CREATE INDEX IF NOT EXISTS idx_resume_templates_owner_id ON resume_templates (owner_id);
