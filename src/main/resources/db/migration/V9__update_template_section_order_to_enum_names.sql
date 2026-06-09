-- V9: Update template sectionOrder and column arrays to use ResumeSectionType enum name strings.
-- DATA migration only — no DDL changes.

-- Minimal template (single-column): update sectionOrder
UPDATE resume_templates
SET template_definition = jsonb_set(
    template_definition,
    '{layout,sectionOrder}',
    '["WORK_EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS", "PROJECTS"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000001'::uuid;

-- Classic template (two-column): update columns.left and columns.right
UPDATE resume_templates
SET template_definition = jsonb_set(
    jsonb_set(
        template_definition,
        '{layout,columns,left}',
        '["SKILLS", "LANGUAGES", "CERTIFICATIONS"]'::jsonb
    ),
    '{layout,columns,right}',
    '["WORK_EXPERIENCE", "EDUCATION", "PROJECTS"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000002'::uuid;

-- Modern template (modern-accent): update sectionOrder
UPDATE resume_templates
SET template_definition = jsonb_set(
    template_definition,
    '{layout,sectionOrder}',
    '["WORK_EXPERIENCE", "SKILLS", "EDUCATION", "PROJECTS", "CERTIFICATIONS"]'::jsonb
)
WHERE id = '11111111-0000-0000-0000-000000000003'::uuid;
