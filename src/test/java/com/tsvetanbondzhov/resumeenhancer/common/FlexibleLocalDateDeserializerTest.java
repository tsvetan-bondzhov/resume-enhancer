package com.tsvetanbondzhov.resumeenhancer.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;
import java.time.Month;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for {@link FlexibleLocalDateDeserializer}.
 *
 * Uses a locally constructed {@link ObjectMapper} that mirrors the configuration in
 * {@code JacksonConfig} plus the flexible deserializer module.  If {@code JacksonConfig}
 * changes (additional modules, etc.), this mapper must stay in sync.
 */
class FlexibleLocalDateDeserializerTest {

    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        SimpleModule flexibleDateModule = new SimpleModule("FlexibleLocalDate");
        flexibleDateModule.addDeserializer(LocalDate.class, new FlexibleLocalDateDeserializer());

        mapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .registerModule(flexibleDateModule)
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    // ─── YYYY-MM-DD ──────────────────────────────────────────────────────────

    @Test
    void isoFullDate_parsesExactDate() throws Exception {
        LocalDate result = parseDate("2022-03-15");
        assertThat(result).isEqualTo(LocalDate.of(2022, Month.MARCH, 15));
    }

    @Test
    void isoFullDate_january_parsesCorrectly() throws Exception {
        LocalDate result = parseDate("2020-01-01");
        assertThat(result).isEqualTo(LocalDate.of(2020, Month.JANUARY, 1));
    }

    // ─── MM/YYYY ─────────────────────────────────────────────────────────────

    @Test
    void monthYearSlash_parsesFirstDayOfMonth() throws Exception {
        LocalDate result = parseDate("03/2022");
        assertThat(result).isEqualTo(LocalDate.of(2022, Month.MARCH, 1));
    }

    @Test
    void monthYearSlash_decemberEdgeCase_parsesFirstDayOfDecember() throws Exception {
        LocalDate result = parseDate("12/2021");
        assertThat(result).isEqualTo(LocalDate.of(2021, Month.DECEMBER, 1));
    }

    @Test
    void monthYearSlash_januaryEdgeCase_parsesFirstDayOfJanuary() throws Exception {
        LocalDate result = parseDate("01/2019");
        assertThat(result).isEqualTo(LocalDate.of(2019, Month.JANUARY, 1));
    }

    // ─── YYYY-MM ─────────────────────────────────────────────────────────────

    @Test
    void isoYearMonth_parsesFirstDayOfMonth() throws Exception {
        LocalDate result = parseDate("2022-03");
        assertThat(result).isEqualTo(LocalDate.of(2022, Month.MARCH, 1));
    }

    @Test
    void isoYearMonth_decemberEdgeCase_parsesFirstDayOfDecember() throws Exception {
        LocalDate result = parseDate("2021-12");
        assertThat(result).isEqualTo(LocalDate.of(2021, Month.DECEMBER, 1));
    }

    // ─── MM/DD/YYYY ──────────────────────────────────────────────────────────

    @Test
    void usDate_parsesExactDate() throws Exception {
        LocalDate result = parseDate("03/15/2022");
        assertThat(result).isEqualTo(LocalDate.of(2022, Month.MARCH, 15));
    }

    @Test
    void usDate_january_parsesCorrectly() throws Exception {
        LocalDate result = parseDate("01/01/2020");
        assertThat(result).isEqualTo(LocalDate.of(2020, Month.JANUARY, 1));
    }

    // ─── Present ─────────────────────────────────────────────────────────────

    @Test
    void present_returnsNull() throws Exception {
        LocalDate result = parseDate("Present");
        assertThat(result).isNull();
    }

    @Test
    void present_caseInsensitive_returnsNull() throws Exception {
        LocalDate result = parseDate("present");
        assertThat(result).isNull();
    }

    @Test
    void present_uppercase_returnsNull() throws Exception {
        LocalDate result = parseDate("PRESENT");
        assertThat(result).isNull();
    }

    // ─── null / blank ─────────────────────────────────────────────────────────

    @Test
    void nullString_returnsNull() throws Exception {
        String json = "{\"date\":null}";
        DateWrapper result = mapper.readValue(json, DateWrapper.class);
        assertThat(result.date()).isNull();
    }

    // ─── Invalid formats → DateParseException ────────────────────────────────

    @ParameterizedTest
    @ValueSource(strings = {"not-a-date", "2022", "15-03-2022", "03-2022", "2022/03/15"})
    void invalidFormat_throwsDateParseException(String invalid) {
        assertThatThrownBy(() -> parseDate(invalid))
                .hasCauseInstanceOf(DateParseException.class)
                .getCause()
                .hasMessageContaining("Invalid date format '" + invalid + "'")
                .hasMessageContaining(FlexibleLocalDateDeserializer.ACCEPTED_FORMATS);
    }

    @Test
    void invalidMonthValue_throwsDateParseException() {
        assertThatThrownBy(() -> parseDate("13/2022"))
                .hasCauseInstanceOf(DateParseException.class);
    }

    @Test
    void invalidMonthValueIso_throwsDateParseException() {
        assertThatThrownBy(() -> parseDate("2022-13"))
                .hasCauseInstanceOf(DateParseException.class);
    }

    // ─── Round-trip: serialized LocalDate can be re-read ─────────────────────

    @ParameterizedTest
    @CsvSource({
            "2022-03-15, 2022, 3, 15",
            "2020-01-01, 2020, 1, 1",
            "2021-12-31, 2021, 12, 31",
    })
    void isoFullDate_roundTrip(String isoDate, int year, int month, int day) throws Exception {
        LocalDate result = parseDate(isoDate);
        assertThat(result).isEqualTo(LocalDate.of(year, month, day));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /** Wraps a date string in a JSON object so the deserializer is triggered. */
    private LocalDate parseDate(String dateStr) throws Exception {
        String json = "{\"date\":\"" + dateStr + "\"}";
        return mapper.readValue(json, DateWrapper.class).date();
    }

    record DateWrapper(LocalDate date) {}
}
