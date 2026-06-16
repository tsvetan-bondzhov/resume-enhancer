package com.tsvetanbondzhov.resumeenhancer.resume.domain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class ResumeSectionTypeTest {

    // ─── WORK_EXPERIENCE ─────────────────────────────────────────────────────

    @ParameterizedTest
    @CsvSource({
            "experience",
            "work experience",
            "work",
            "employment",
            "work history",
            "professional experience"
    })
    void fromHeader_workExperienceVariants_returnsWorkExperience(String header) {
        assertThat(ResumeSectionType.fromHeader(header)).isEqualTo(ResumeSectionType.WORK_EXPERIENCE);
    }

    // ─── EDUCATION ───────────────────────────────────────────────────────────

    @ParameterizedTest
    @CsvSource({
            "education",
            "degree",
            "academic background",
            "educational background"
    })
    void fromHeader_educationVariants_returnsEducation(String header) {
        assertThat(ResumeSectionType.fromHeader(header)).isEqualTo(ResumeSectionType.EDUCATION);
    }

    // ─── SKILLS ──────────────────────────────────────────────────────────────

    @ParameterizedTest
    @CsvSource({
            "skills",
            "technologies",
            "technical skills",
            "core competencies",
            "competencies"
    })
    void fromHeader_skillsVariants_returnsSkills(String header) {
        assertThat(ResumeSectionType.fromHeader(header)).isEqualTo(ResumeSectionType.SKILLS);
    }

    // ─── CERTIFICATIONS ──────────────────────────────────────────────────────

    @ParameterizedTest
    @CsvSource({
            "certifications",
            "certificates",
            "certification"
    })
    void fromHeader_certificationsVariants_returnsCertifications(String header) {
        assertThat(ResumeSectionType.fromHeader(header)).isEqualTo(ResumeSectionType.CERTIFICATIONS);
    }

    // ─── PROJECTS ────────────────────────────────────────────────────────────

    @ParameterizedTest
    @CsvSource({
            "projects",
            "project experience",
            "personal projects",
            "open source",
            "key projects"
    })
    void fromHeader_projectsVariants_returnsProjects(String header) {
        assertThat(ResumeSectionType.fromHeader(header)).isEqualTo(ResumeSectionType.PROJECTS);
    }

    // ─── SUMMARY ─────────────────────────────────────────────────────────────

    @ParameterizedTest
    @CsvSource({
            "summary",
            "professional summary",
            "profile",
            "about me",
            "objective",
            "career objective"
    })
    void fromHeader_summaryVariants_returnsSummary(String header) {
        assertThat(ResumeSectionType.fromHeader(header)).isEqualTo(ResumeSectionType.SUMMARY);
    }

    // ─── LANGUAGES ───────────────────────────────────────────────────────────

    @ParameterizedTest
    @CsvSource({
            "languages",
            "language skills"
    })
    void fromHeader_languagesVariants_returnsLanguages(String header) {
        assertThat(ResumeSectionType.fromHeader(header)).isEqualTo(ResumeSectionType.LANGUAGES);
    }

    // ─── VOLUNTEERING ────────────────────────────────────────────────────────

    @ParameterizedTest
    @CsvSource({
            "volunteering",
            "volunteer",
            "volunteer experience",
            "community involvement"
    })
    void fromHeader_volunteeringVariants_returnsVolunteering(String header) {
        assertThat(ResumeSectionType.fromHeader(header)).isEqualTo(ResumeSectionType.VOLUNTEERING);
    }

    // ─── UNKNOWN ─────────────────────────────────────────────────────────────

    @Test
    void fromHeader_unrecognizedHeader_returnsUnknown() {
        assertThat(ResumeSectionType.fromHeader("hobbies")).isEqualTo(ResumeSectionType.UNKNOWN);
    }

    @Test
    void fromHeader_emptyString_returnsUnknown() {
        assertThat(ResumeSectionType.fromHeader("")).isEqualTo(ResumeSectionType.UNKNOWN);
    }
}
