-- V5: Seed prebuilt resume templates (INSERT-only; V4 DDL already applied)
INSERT INTO resume_templates (id, name, description, is_prebuilt, is_published, owner_id, template_definition)
VALUES
    ('11111111-0000-0000-0000-000000000001'::uuid, 'Minimal',  'Clean single-column layout',          true, true, NULL, '{}'),
    ('11111111-0000-0000-0000-000000000002'::uuid, 'Classic',  'Traditional two-column layout',        true, true, NULL, '{}'),
    ('11111111-0000-0000-0000-000000000003'::uuid, 'Modern',   'Contemporary accent-color layout',     true, true, NULL, '{}');
