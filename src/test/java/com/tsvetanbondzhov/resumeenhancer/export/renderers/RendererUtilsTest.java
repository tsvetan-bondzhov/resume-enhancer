package com.tsvetanbondzhov.resumeenhancer.export.renderers;

import com.tsvetanbondzhov.resumeenhancer.export.TemplateColumns;
import com.tsvetanbondzhov.resumeenhancer.export.TemplateDefinition;
import com.tsvetanbondzhov.resumeenhancer.export.TemplateLayout;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSection;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.ResumeSectionType;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SkillItem;
import com.tsvetanbondzhov.resumeenhancer.resume.domain.SummaryItem;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for package-private {@link RendererUtils}.
 *
 * <p>Since {@code RendererUtils} is package-private this test lives in the
 * {@code com.tsvetanbondzhov.resumeenhancer.export.renderers} package so it can
 * access the class directly.
 */
class RendererUtilsTest {

    // ─── buildSectionOrder ────────────────────────────────────────────────────

    @Test
    void buildSectionOrder_withNullLayout_returnsEmptyList() {
        TemplateDefinition def = new TemplateDefinition("single-column", Map.of(), null, Map.of());

        List<String> order = RendererUtils.buildSectionOrder(def);

        assertThat(order).isEmpty();
    }

    @Test
    void buildSectionOrder_singleColumn_withNonNullSectionOrder_returnsSectionOrder() {
        TemplateLayout layout = new TemplateLayout(
                "name-contact",
                List.of("WORK_EXPERIENCE", "EDUCATION", "SKILLS"),
                null,
                Map.of()
        );
        TemplateDefinition def = new TemplateDefinition("single-column", Map.of(), layout, Map.of());

        List<String> order = RendererUtils.buildSectionOrder(def);

        assertThat(order).containsExactly("WORK_EXPERIENCE", "EDUCATION", "SKILLS");
    }

    @Test
    void buildSectionOrder_singleColumn_withNullSectionOrder_returnsEmptyList() {
        TemplateLayout layout = new TemplateLayout(
                "name-contact",
                null,           // null sectionOrder — line 57
                null,
                Map.of()
        );
        TemplateDefinition def = new TemplateDefinition("single-column", Map.of(), layout, Map.of());

        List<String> order = RendererUtils.buildSectionOrder(def);

        assertThat(order).isEmpty();
    }

    @Test
    void buildSectionOrder_twoColumn_withBothColumns_mergesLeftThenRight() {
        TemplateLayout layout = new TemplateLayout(
                "name-contact",
                null,
                new TemplateColumns(
                        List.of("WORK_EXPERIENCE", "EDUCATION"),
                        List.of("SKILLS", "LANGUAGES")
                ),
                Map.of()
        );
        TemplateDefinition def = new TemplateDefinition("two-column", Map.of(), layout, Map.of());

        List<String> order = RendererUtils.buildSectionOrder(def);

        assertThat(order).containsExactly("WORK_EXPERIENCE", "EDUCATION", "SKILLS", "LANGUAGES");
    }

    @Test
    void buildSectionOrder_twoColumn_withNullLeftColumn_mergesOnlyRight() {
        // covers line 51 null check for cols.left()
        TemplateLayout layout = new TemplateLayout(
                "name-contact",
                null,
                new TemplateColumns(
                        null,                          // null left
                        List.of("SKILLS", "LANGUAGES")
                ),
                Map.of()
        );
        TemplateDefinition def = new TemplateDefinition("two-column", Map.of(), layout, Map.of());

        List<String> order = RendererUtils.buildSectionOrder(def);

        assertThat(order).containsExactly("SKILLS", "LANGUAGES");
    }

    @Test
    void buildSectionOrder_twoColumn_withNullRightColumn_mergesOnlyLeft() {
        // covers line 52 null check for cols.right()
        TemplateLayout layout = new TemplateLayout(
                "name-contact",
                null,
                new TemplateColumns(
                        List.of("WORK_EXPERIENCE", "EDUCATION"),
                        null                           // null right
                ),
                Map.of()
        );
        TemplateDefinition def = new TemplateDefinition("two-column", Map.of(), layout, Map.of());

        List<String> order = RendererUtils.buildSectionOrder(def);

        assertThat(order).containsExactly("WORK_EXPERIENCE", "EDUCATION");
    }

    @Test
    void buildSectionOrder_twoColumn_withNullColumns_returnsEmptyList() {
        // isTwoColumn() is true but layout().columns() is null
        TemplateLayout layout = new TemplateLayout(
                "name-contact",
                null,
                null,          // null TemplateColumns
                Map.of()
        );
        TemplateDefinition def = new TemplateDefinition("two-column", Map.of(), layout, Map.of());

        List<String> order = RendererUtils.buildSectionOrder(def);

        assertThat(order).isEmpty();
    }

    // ─── orderSections ────────────────────────────────────────────────────────

    @Test
    void orderSections_whenSectionOrderEmpty_returnsOriginalList() {
        List<ResumeSection> sections = List.of(
                new ResumeSection(ResumeSectionType.SKILLS, "Skills", true,
                        List.of(new SkillItem(UUID.randomUUID().toString(), "Java")))
        );
        TemplateDefinition def = new TemplateDefinition("single-column", Map.of(), null, Map.of());

        List<ResumeSection> result = RendererUtils.orderSections(sections, def);

        assertThat(result).isSameAs(sections);
    }

    @Test
    void orderSections_ordersAccordingToTemplateOrder() {
        ResumeSection work = new ResumeSection(ResumeSectionType.WORK_EXPERIENCE, "Work", true, List.of());
        ResumeSection skills = new ResumeSection(ResumeSectionType.SKILLS, "Skills", true, List.of());
        List<ResumeSection> sections = List.of(work, skills);

        TemplateLayout layout = new TemplateLayout(
                "name-contact",
                List.of("SKILLS", "WORK_EXPERIENCE"),
                null,
                Map.of()
        );
        TemplateDefinition def = new TemplateDefinition("single-column", Map.of(), layout, Map.of());

        List<ResumeSection> ordered = RendererUtils.orderSections(sections, def);

        assertThat(ordered).containsExactly(skills, work);
    }

    // ─── findSummaryItem ──────────────────────────────────────────────────────

    @Test
    void findSummaryItem_withNullItems_skipsSection() {
        // A section whose items list is null — the compact constructor converts null → emptyList,
        // so we need to pass a section type that's SUMMARY but has an empty items list to trigger
        // the "no SummaryItem found" path. We also test the null-items guard (line 68) indirectly
        // via a section with empty items.
        ResumeSection summarySection = new ResumeSection(
                ResumeSectionType.SUMMARY,
                "Summary",
                true,
                List.of()   // empty — no SummaryItem in the list
        );

        SummaryItem result = RendererUtils.findSummaryItem(List.of(summarySection));

        assertThat(result).isNull();
    }

    @Test
    void findSummaryItem_withSummaryItem_returnsIt() {
        SummaryItem expected = new SummaryItem(
                "s1", "Summary text", null, null, null, "a@b.com", "USA", "NYC"
        );
        ResumeSection summarySection = new ResumeSection(
                ResumeSectionType.SUMMARY,
                "Summary",
                true,
                List.of(expected)
        );

        SummaryItem result = RendererUtils.findSummaryItem(List.of(summarySection));

        assertThat(result).isEqualTo(expected);
    }

    @Test
    void findSummaryItem_withNoSummarySection_returnsNull() {
        ResumeSection skills = new ResumeSection(ResumeSectionType.SKILLS, "Skills", true, List.of());

        SummaryItem result = RendererUtils.findSummaryItem(List.of(skills));

        assertThat(result).isNull();
    }

    @Test
    void findSummaryItem_withNonSummaryItemInSummarySection_returnsNull() {
        // A SUMMARY-typed section that only contains a non-SummaryItem — exercises the
        // "item instanceof SummaryItem" false branch (line 67)
        ResumeItem nonSummary = new SkillItem(UUID.randomUUID().toString(), "Java");
        ResumeSection summarySection = new ResumeSection(
                ResumeSectionType.SUMMARY,
                "Summary",
                true,
                List.of(nonSummary)
        );

        SummaryItem result = RendererUtils.findSummaryItem(List.of(summarySection));

        assertThat(result).isNull();
    }

    // ─── formatDateRange ──────────────────────────────────────────────────────

    @Test
    void formatDateRange_withBothDates_returnsRange() {
        LocalDate start = LocalDate.of(2020, 1, 1);
        LocalDate end = LocalDate.of(2022, 6, 30);

        String result = RendererUtils.formatDateRange(start, end, false);

        assertThat(result).isEqualTo("Jan 2020 – Jun 2022");
    }

    @Test
    void formatDateRange_withNullStartAndNonNullEnd_returnsEndOnly() {
        // covers line 84: startStr is blank, endStr is not blank → return endStr (line 84)
        LocalDate end = LocalDate.of(2022, 6, 30);

        String result = RendererUtils.formatDateRange(null, end, false);

        assertThat(result).isEqualTo("Jun 2022");
    }

    @Test
    void formatDateRange_withNonNullStartAndNullEnd_returnsStartOnly() {
        // covers line 83: startStr is not blank, endStr is blank → return startStr
        LocalDate start = LocalDate.of(2020, 3, 1);

        String result = RendererUtils.formatDateRange(start, null, false);

        assertThat(result).isEqualTo("Mar 2020");
    }

    @Test
    void formatDateRange_withNullStartAndNullEnd_returnsEmpty() {
        // covers line 85: both blank → return ""
        String result = RendererUtils.formatDateRange(null, null, false);

        assertThat(result).isEmpty();
    }

    @Test
    void formatDateRange_withIsCurrent_returnsPresent() {
        LocalDate start = LocalDate.of(2021, 5, 1);

        String result = RendererUtils.formatDateRange(start, null, true);

        assertThat(result).isEqualTo("May 2021 – Present");
    }
}
