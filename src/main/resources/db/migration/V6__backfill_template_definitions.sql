-- V6: Backfill full template definitions for the three prebuilt templates.
-- DATA migration only — no DDL changes.

UPDATE resume_templates
SET template_definition = '{
  "layoutType": "single-column",
  "cssVariables": {
    "--primary-color": "#1f2937",
    "--accent-color": "#3b82f6",
    "--font-family-sans": "Inter, system-ui, sans-serif",
    "--font-size-base": "11px",
    "--line-height-base": "1.5",
    "--section-spacing": "12px",
    "--item-spacing": "6px",
    "--page-margin-top": "0.75in",
    "--page-margin-right": "0.75in",
    "--page-margin-bottom": "0.75in",
    "--page-margin-left": "0.75in"
  },
  "layout": {
    "headerFormat": "name-contact",
    "sectionOrder": ["experience", "education", "skills", "certifications", "projects"],
    "sectionStyles": {}
  },
  "metadata": {
    "version": "1.0",
    "atsCompatible": true,
    "pageSize": "letter"
  }
}'::jsonb
WHERE id = '11111111-0000-0000-0000-000000000001'::uuid;

UPDATE resume_templates
SET template_definition = '{
  "layoutType": "two-column",
  "cssVariables": {
    "--primary-color": "#111827",
    "--accent-color": "#1d4ed8",
    "--font-family-sans": "Georgia, serif",
    "--font-size-base": "11px",
    "--line-height-base": "1.4",
    "--section-spacing": "14px",
    "--item-spacing": "6px",
    "--page-margin-top": "0.75in",
    "--page-margin-right": "0.75in",
    "--page-margin-bottom": "0.75in",
    "--page-margin-left": "0.75in"
  },
  "layout": {
    "headerFormat": "name-contact",
    "columns": {
      "left": ["skills", "languages", "certifications"],
      "right": ["experience", "education", "projects"]
    },
    "sectionStyles": {}
  },
  "metadata": {
    "version": "1.0",
    "atsCompatible": true,
    "pageSize": "letter"
  }
}'::jsonb
WHERE id = '11111111-0000-0000-0000-000000000002'::uuid;

UPDATE resume_templates
SET template_definition = '{
  "layoutType": "modern-accent",
  "cssVariables": {
    "--primary-color": "#111827",
    "--accent-color": "#0d9488",
    "--font-family-sans": "Inter, system-ui, sans-serif",
    "--font-size-base": "11px",
    "--line-height-base": "1.5",
    "--section-spacing": "12px",
    "--item-spacing": "6px",
    "--page-margin-top": "0.75in",
    "--page-margin-right": "0.75in",
    "--page-margin-bottom": "0.75in",
    "--page-margin-left": "0.75in"
  },
  "layout": {
    "headerFormat": "name-contact-summary",
    "sectionOrder": ["experience", "skills", "education", "projects", "certifications"],
    "sectionStyles": {}
  },
  "metadata": {
    "version": "1.0",
    "atsCompatible": false,
    "pageSize": "letter"
  }
}'::jsonb
WHERE id = '11111111-0000-0000-0000-000000000003'::uuid;
