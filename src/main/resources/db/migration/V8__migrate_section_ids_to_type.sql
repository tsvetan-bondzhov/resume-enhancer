-- V8: Rename "id" to "sectionType" in resume section objects and convert values to enum names.
-- DATA migration only — no DDL changes.
-- Idempotent: sections already having "sectionType" key are unaffected (DO NOTHING).

UPDATE resumes
SET resume_content = (
    SELECT jsonb_build_object(
        'sections',
        jsonb_agg(
            CASE
                -- Already migrated: sectionType key exists — leave unchanged
                WHEN section ? 'sectionType' THEN section
                ELSE
                    -- Remove old "id" key, add "sectionType" with mapped value
                    (section - 'id') || jsonb_build_object(
                        'sectionType',
                        CASE section->>'id'
                            WHEN 'experience' THEN 'WORK_EXPERIENCE'
                            WHEN 'education'  THEN 'EDUCATION'
                            WHEN 'skills'     THEN 'SKILLS'
                            WHEN 'certifications' THEN 'CERTIFICATIONS'
                            WHEN 'projects'   THEN 'PROJECTS'
                            WHEN 'summary'    THEN 'SUMMARY'
                            WHEN 'languages'  THEN 'LANGUAGES'
                            WHEN 'volunteering' THEN 'VOLUNTEERING'
                            ELSE 'UNKNOWN'
                        END
                    )
            END
            ORDER BY ordinality
        )
    )
    FROM jsonb_array_elements(resume_content->'sections') WITH ORDINALITY AS t(section, ordinality)
)
WHERE resume_content IS NOT NULL
  AND jsonb_array_length(resume_content->'sections') > 0;
