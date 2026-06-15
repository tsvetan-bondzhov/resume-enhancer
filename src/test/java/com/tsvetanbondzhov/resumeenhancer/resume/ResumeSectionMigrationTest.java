package com.tsvetanbondzhov.resumeenhancer.resume;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Validates the section migration logic corresponding to V8__migrate_section_ids_to_type.sql.
 * Tests the mapping: old "id" string values → ResumeSectionType enum names.
 * Uses Java-side simulation of the SQL CASE logic to verify correctness.
 */
class ResumeSectionMigrationTest {

    private static final Map<String, String> MIGRATION_MAP = Map.of(
            "experience",    "WORK_EXPERIENCE",
            "education",     "EDUCATION",
            "skills",        "SKILLS",
            "certifications","CERTIFICATIONS",
            "projects",      "PROJECTS",
            "summary",       "SUMMARY",
            "languages",     "LANGUAGES",
            "volunteering",  "VOLUNTEERING"
    );

    /** Simulates the V8 SQL CASE mapping for a single section id value. */
    private String migrateId(String oldId) {
        return MIGRATION_MAP.getOrDefault(oldId, "UNKNOWN");
    }

    @Test
    void migrateId_experience_mapsToWorkExperience() {
        assertThat(migrateId("experience")).isEqualTo("WORK_EXPERIENCE");
    }

    @Test
    void migrateId_education_mapsToEducation() {
        assertThat(migrateId("education")).isEqualTo("EDUCATION");
    }

    @Test
    void migrateId_skills_mapsToSkills() {
        assertThat(migrateId("skills")).isEqualTo("SKILLS");
    }

    @Test
    void migrateId_unknownString_mapsToUnknown() {
        assertThat(migrateId("some-random-uuid-or-unrecognised-string")).isEqualTo("UNKNOWN");
    }

    @Test
    void migrateId_allEnumValues_haveCorrespondingMigratedNames() {
        // Verify each mapped value is a valid ResumeSectionType enum name
        for (String enumName : MIGRATION_MAP.values()) {
            assertThat(ResumeSectionType.valueOf(enumName))
                    .as("Mapped value '%s' must be a valid ResumeSectionType", enumName)
                    .isNotNull();
        }
        // UNKNOWN fallback must also be valid
        assertThat(ResumeSectionType.valueOf("UNKNOWN")).isNotNull();
    }

    @Test
    void jsonMigration_fixtureDocument_producesCorrectSectionTypes() throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        // Build fixture JSON matching pre-migration DB structure
        ObjectNode doc = mapper.createObjectNode();
        ArrayNode sections = doc.putArray("sections");

        for (String[] pair : new String[][]{
                {"experience", "Work Experience"},
                {"education",  "Education"},
                {"skills",     "Skills"},
                {"weird-uuid", "Unknown Section"}
        }) {
            ObjectNode section = mapper.createObjectNode();
            section.put("id",      pair[0]);
            section.put("title",   pair[1]);
            section.put("visible", true);
            section.putArray("items");
            sections.add(section);
        }

        // Apply migration logic
        ArrayNode migrated = mapper.createArrayNode();
        for (var section : (Iterable<com.fasterxml.jackson.databind.JsonNode>) sections::elements) {
            ObjectNode s = (ObjectNode) section.deepCopy();
            if (!s.has("sectionType")) {
                String oldId = s.path("id").asText("");
                s.remove("id");
                s.put("sectionType", migrateId(oldId));
            }
            migrated.add(s);
        }

        // Assert
        assertThat(migrated.get(0).get("sectionType").asText()).isEqualTo("WORK_EXPERIENCE");
        assertThat(migrated.get(1).get("sectionType").asText()).isEqualTo("EDUCATION");
        assertThat(migrated.get(2).get("sectionType").asText()).isEqualTo("SKILLS");
        assertThat(migrated.get(3).get("sectionType").asText()).isEqualTo("UNKNOWN");

        // Idempotency: already-migrated sections must be unchanged
        ObjectNode alreadyMigrated = mapper.createObjectNode();
        alreadyMigrated.put("sectionType", "WORK_EXPERIENCE");
        alreadyMigrated.put("title", "Work Experience");
        alreadyMigrated.put("visible", true);
        alreadyMigrated.putArray("items");

        ObjectNode idempotentResult = (ObjectNode) alreadyMigrated.deepCopy();
        if (!idempotentResult.has("sectionType")) {
            // Would have migrated — but it already has sectionType so this branch won't run
            idempotentResult.put("sectionType", "BUG");
        }
        assertThat(idempotentResult.get("sectionType").asText()).isEqualTo("WORK_EXPERIENCE");
    }
}
