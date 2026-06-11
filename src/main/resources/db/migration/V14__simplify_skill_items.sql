-- V14__simplify_skill_items.sql
-- Remove 'category' and 'proficiency' fields from SkillItem objects stored in resume_content JSONB.
-- Idempotent: removing a non-existent key from a JSONB object is a no-op in PostgreSQL.
UPDATE resumes
SET resume_content = jsonb_set(
  resume_content,
  '{sections}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN section->>'sectionType' = 'SKILLS' THEN
          jsonb_set(
            section,
            '{items}',
            COALESCE(
              (
                SELECT jsonb_agg(item - 'category' - 'proficiency')
                FROM jsonb_array_elements(section->'items') item
              ),
              '[]'::jsonb
            )
          )
        ELSE section
      END
    )
    FROM jsonb_array_elements(resume_content->'sections') section
  )
)
WHERE resume_content->'sections' IS NOT NULL;
