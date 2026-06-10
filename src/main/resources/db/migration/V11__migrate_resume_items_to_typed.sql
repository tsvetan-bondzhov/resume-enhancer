-- V11: Migrate resume items from {id, fields:{...}} shape to typed discriminated records.
-- DATA migration only — no DDL changes.
-- Idempotent: items already containing a "type" key are left untouched.

UPDATE resumes
SET resume_content = (
    SELECT jsonb_build_object(
        'sections',
        jsonb_agg(
            jsonb_build_object(
                'sectionType', section->>'sectionType',
                'title',       section->>'title',
                'visible',     (section->>'visible')::boolean,
                'items',
                (
                    SELECT jsonb_agg(
                        CASE
                            -- Already migrated: "type" key exists — leave untouched
                            WHEN item ? 'type' THEN item
                            -- UNKNOWN sections: preserve fields map under "fields" key
                            WHEN section->>'sectionType' = 'UNKNOWN' THEN
                                jsonb_build_object(
                                    'type',   'UNKNOWN',
                                    'id',     item->>'id',
                                    'fields', COALESCE(item->'fields', '{}'::jsonb)
                                )
                            -- All other sections: lift fields to top-level + add type discriminator
                            -- Empty string values are converted to null to avoid LocalDate parse failures
                            ELSE
                                jsonb_build_object('type', section->>'sectionType', 'id', item->>'id')
                                || (
                                    SELECT COALESCE(
                                        jsonb_object_agg(
                                            k,
                                            CASE WHEN v = '' THEN NULL ELSE v::jsonb END
                                        ),
                                        '{}'::jsonb
                                    )
                                    FROM (
                                        SELECT k, to_json(v)::text AS v
                                        FROM jsonb_each_text(COALESCE(item->'fields', '{}'::jsonb)) AS f(k, v)
                                    ) sub
                                )
                        END
                        ORDER BY item_ord
                    )
                    FROM jsonb_array_elements(COALESCE(section->'items', '[]'::jsonb)) WITH ORDINALITY AS t2(item, item_ord)
                )
            )
            ORDER BY sec_ord
        )
    )
    FROM jsonb_array_elements(resume_content->'sections') WITH ORDINALITY AS t1(section, sec_ord)
)
WHERE resume_content IS NOT NULL
  AND resume_content ? 'sections'
  AND jsonb_array_length(resume_content->'sections') > 0;
