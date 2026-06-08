package com.tsvetanbondzhov.resumeenhancer.upload.parsers;

public enum ResumeSectionType {
    WORK_EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS,
    PROJECTS, SUMMARY, LANGUAGES, VOLUNTEERING, UNKNOWN;

    /**
     * Maps a normalized section header to a type.
     * Returns UNKNOWN for headers that don't match any known type.
     */
    public static ResumeSectionType fromHeader(String normalizedHeader) {
        return switch (normalizedHeader) {
            case "experience", "work experience", "work", "employment",
                 "work history", "professional experience" -> WORK_EXPERIENCE;
            case "education", "degree", "academic background",
                 "educational background" -> EDUCATION;
            case "skills", "technologies", "technical skills",
                 "core competencies", "competencies" -> SKILLS;
            case "certifications", "certificates", "certification" -> CERTIFICATIONS;
            case "projects", "project experience", "personal projects",
                 "open source", "key projects" -> PROJECTS;
            case "summary", "professional summary", "profile",
                 "about me", "objective", "career objective" -> SUMMARY;
            case "languages", "language skills" -> LANGUAGES;
            case "volunteering", "volunteer", "volunteer experience",
                 "community involvement" -> VOLUNTEERING;
            default -> UNKNOWN;
        };
    }
}
