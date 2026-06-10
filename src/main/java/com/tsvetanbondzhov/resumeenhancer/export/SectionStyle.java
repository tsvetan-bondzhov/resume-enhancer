package com.tsvetanbondzhov.resumeenhancer.export;

public record SectionStyle(
        String titleFormat,
        String itemSeparator,
        boolean showDates,
        boolean showDescriptions
) {}
