package com.tsvetanbondzhov.resumeenhancer.upload.dto;

import java.util.List;

public record RawSection(String title, List<String> lines) {
    public RawSection {
        lines = lines != null ? List.copyOf(lines) : List.of();
    }
}
