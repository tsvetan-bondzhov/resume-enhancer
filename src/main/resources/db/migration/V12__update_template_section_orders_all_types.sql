-- V12: Update template sectionOrder arrays to include all eight ResumeSectionType values.
-- DATA migration only — no DDL changes.
-- Idempotent: jsonb_set overwrites the target key unconditionally.

-- Minimal template (single-column): full eight-section order
UPDATE resume_templates
SET template_definition = jsonb_set(
    template_definition,
    '{layout,sectionOrder}',
    '["SUMMARY", "WORK_EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS", "PROJECTS", "LANGUAGES", "VOLUNTEERING"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000001'::uuid;

-- Classic template (two-column): left stays the same; add VOLUNTEERING to right column
UPDATE resume_templates
SET template_definition = jsonb_set(
    jsonb_set(
        template_definition,
        '{layout,columns,left}',
        '["SKILLS", "LANGUAGES", "CERTIFICATIONS"]'::jsonb
    ),
    '{layout,columns,right}',
    '["WORK_EXPERIENCE", "EDUCATION", "PROJECTS", "VOLUNTEERING"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000002'::uuid;

-- Modern template (modern-accent): full eight-section order
UPDATE resume_templates
SET template_definition = jsonb_set(
    template_definition,
    '{layout,sectionOrder}',
    '["SUMMARY", "WORK_EXPERIENCE", "SKILLS", "EDUCATION", "PROJECTS", "CERTIFICATIONS", "LANGUAGES", "VOLUNTEERING"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000003'::uuid;
