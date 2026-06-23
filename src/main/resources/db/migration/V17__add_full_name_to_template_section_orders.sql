-- V17: Add FULL_NAME section to prebuilt template orders so the candidate's name
-- renders at the top of exported (PDF/DOCX) resumes. Sections absent from the
-- template order are skipped by the renderers, so FULL_NAME must be included.
-- DATA migration only — no DDL changes. Idempotent: jsonb_set overwrites the key.

-- Minimal template (single-column)
UPDATE resume_templates
SET template_definition = jsonb_set(
    template_definition,
    '{layout,sectionOrder}',
    '["FULL_NAME", "SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS", "PROJECTS", "LANGUAGES", "VOLUNTEERING"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000001'::uuid;

-- Classic template (two-column): name leads the right column above the summary
UPDATE resume_templates
SET template_definition = jsonb_set(
    template_definition,
    '{layout,columns,right}',
    '["FULL_NAME", "SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "PROJECTS", "VOLUNTEERING"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000002'::uuid;

-- Modern template (modern-accent)
UPDATE resume_templates
SET template_definition = jsonb_set(
    template_definition,
    '{layout,sectionOrder}',
    '["FULL_NAME", "SUMMARY", "WORK_EXPERIENCE", "SKILLS", "EDUCATION", "PROJECTS", "CERTIFICATIONS", "LANGUAGES", "VOLUNTEERING"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000003'::uuid;
