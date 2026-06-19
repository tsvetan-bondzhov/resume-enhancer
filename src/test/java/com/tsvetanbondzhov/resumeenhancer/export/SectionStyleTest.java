package com.tsvetanbondzhov.resumeenhancer.export;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SectionStyleTest {

    @Test
    void constructor_storesAllFields() {
        SectionStyle style = new SectionStyle("BOLD", " | ", true, false);

        assertThat(style.titleFormat()).isEqualTo("BOLD");
        assertThat(style.itemSeparator()).isEqualTo(" | ");
        assertThat(style.showDates()).isTrue();
        assertThat(style.showDescriptions()).isFalse();
    }

    @Test
    void recordEquality_twoIdenticalInstances_areEqual() {
        SectionStyle a = new SectionStyle("ITALIC", ", ", false, true);
        SectionStyle b = new SectionStyle("ITALIC", ", ", false, true);

        assertThat(a).isEqualTo(b);
        assertThat(a.hashCode()).isEqualTo(b.hashCode());
    }

    @Test
    void recordToString_containsFieldValues() {
        SectionStyle style = new SectionStyle("NORMAL", "; ", true, true);

        String str = style.toString();
        assertThat(str).contains("NORMAL");
        assertThat(str).contains(";");
    }
}
