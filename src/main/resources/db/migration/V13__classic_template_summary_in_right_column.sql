-- V13: Move SUMMARY to first position in Classic template right column.
-- DATA migration only — no DDL changes.
-- Idempotent: jsonb_set overwrites the target key unconditionally.

DO $$
DECLARE
  row_count INTEGER;
BEGIN
  UPDATE resume_templates
  SET template_definition = jsonb_set(
      template_definition,
      '{layout,columns,right}',
      '["SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "PROJECTS", "VOLUNTEERING"]'::jsonb
  )
  WHERE id = '11111111-0000-0000-0000-000000000002'::uuid;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count = 0 THEN
    RAISE EXCEPTION 'V13 migration: Classic template row (id=11111111-0000-0000-0000-000000000002) not found — migration did not update any rows.';
  END IF;
END $$;
