-- V7: Add --text-color to cssVariables for all three prebuilt templates.
-- DATA migration only — no DDL changes.

UPDATE resume_templates
SET template_definition = jsonb_set(
    template_definition,
    '{cssVariables,--text-color}',
    '"#111827"'
)
WHERE id IN (
    '11111111-0000-0000-0000-000000000001'::uuid,
    '11111111-0000-0000-0000-000000000002'::uuid,
    '11111111-0000-0000-0000-000000000003'::uuid
);
