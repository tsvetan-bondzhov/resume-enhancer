package com.tsvetanbondzhov.resumeenhancer.ai;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;

public final class ResumeContextBuilder {

    private ResumeContextBuilder() {}

    public static String buildResumeContext(ResumeDocument document) {
        if (document == null || document.sections().isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("--- RESUME CONTENT ---\n");
        for (var section : document.sections()) {
            if (!section.visible()) continue;
            sb.append("\n[").append(section.sectionType()).append("]\n");
            var items = section.items();
            for (int i = 0; i < items.size(); i++) {
                sb.append("  ").append(i + 1).append(". ").append(items.get(i)).append("\n");
            }
        }
        sb.append("--- END OF RESUME ---\n");
        return sb.toString();
    }
}
