package com.tsvetanbondzhov.resumeenhancer.export;

import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeDocument;
import com.tsvetanbondzhov.resumeenhancer.template.domain.ResumeTemplate;

public interface DocumentRenderer {
    byte[] render(ResumeDocument doc, ResumeTemplate template);
}
