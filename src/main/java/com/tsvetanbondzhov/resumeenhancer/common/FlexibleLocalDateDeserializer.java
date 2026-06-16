package com.tsvetanbondzhov.resumeenhancer.common;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Jackson deserializer for {@link LocalDate} that accepts multiple date string formats
 * sent by the frontend resume editor.
 *
 * <p>Accepted formats (tried in order):
 * <ol>
 *   <li>{@code YYYY-MM-DD} — ISO full date (existing default)</li>
 *   <li>{@code MM/YYYY} — month/year shorthand → first day of the month</li>
 *   <li>{@code YYYY-MM} — ISO year-month → first day of the month</li>
 *   <li>{@code MM/DD/YYYY} — US date format → exact date</li>
 *   <li>{@code Present} — special sentinel → returns {@code null}
 *       (the calling item's {@code isCurrent} flag conveys the "currently active" state)</li>
 * </ol>
 *
 * <p>If none of the formats match, a {@link DateParseException} is thrown, which
 * {@link GlobalExceptionHandler} maps to HTTP 400 with a descriptive message.
 */
public class FlexibleLocalDateDeserializer extends StdDeserializer<LocalDate> {

    static final String ACCEPTED_FORMATS =
            "YYYY-MM-DD, MM/YYYY, YYYY-MM, MM/DD/YYYY, Present";

    // MM/YYYY  — e.g. "03/2022"
    private static final Pattern MONTH_YEAR_PATTERN = Pattern.compile("^(\\d{2})/(\\d{4})$");
    // YYYY-MM  — e.g. "2022-03"
    private static final Pattern ISO_MONTH_PATTERN  = Pattern.compile("^(\\d{4})-(\\d{2})$");

    private static final DateTimeFormatter ISO_FULL = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter US_DATE  = DateTimeFormatter.ofPattern("MM/dd/yyyy");

    public FlexibleLocalDateDeserializer() {
        super(LocalDate.class);
    }

    @Override
    public LocalDate deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        String raw = p.getText();
        if (raw == null || raw.isBlank()) {
            return null;
        }

        String value = raw.trim();

        // "Present" is a frontend sentinel for an ongoing position — end date is null
        if ("Present".equalsIgnoreCase(value)) {
            return null;
        }

        // YYYY-MM-DD (ISO full date)
        LocalDate result = tryParse(value, ISO_FULL);
        if (result != null) return result;

        // MM/YYYY → first day of month
        Matcher monthYearMatcher = MONTH_YEAR_PATTERN.matcher(value);
        if (monthYearMatcher.matches()) {
            int month = Integer.parseInt(monthYearMatcher.group(1));
            int year  = Integer.parseInt(monthYearMatcher.group(2));
            if (month >= 1 && month <= 12) {
                return LocalDate.of(year, month, 1);
            }
        }

        // YYYY-MM → first day of month
        Matcher isoMonthMatcher = ISO_MONTH_PATTERN.matcher(value);
        if (isoMonthMatcher.matches()) {
            int year  = Integer.parseInt(isoMonthMatcher.group(1));
            int month = Integer.parseInt(isoMonthMatcher.group(2));
            if (month >= 1 && month <= 12) {
                return LocalDate.of(year, month, 1);
            }
        }

        // MM/DD/YYYY (US date format)
        result = tryParse(value, US_DATE);
        if (result != null) return result;

        throw new DateParseException(
                "Invalid date format '" + value + "'. Accepted formats: " + ACCEPTED_FORMATS + ".");
    }

    /** Tries to parse {@code value} with {@code formatter}; returns null on failure. */
    private static LocalDate tryParse(String value, DateTimeFormatter formatter) {
        try {
            return LocalDate.parse(value, formatter);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
