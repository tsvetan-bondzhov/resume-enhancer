import { describe, it, expect } from "vitest"
import { formatDateRange, formatMonthYear, formatYear, parseDateInput, toEditableFullDate } from "./dateUtils"

describe("formatDateRange", () => {
  it("returns empty string when both startDate and endDate are null", () => {
    expect(formatDateRange(null, null, false)).toBe("")
  })

  it("returns empty string when both are null even with isCurrent true", () => {
    expect(formatDateRange(null, null, true)).toBe("")
  })

  it("formats both dates present", () => {
    // Use fixed locale-independent approach: just verify structure
    const result = formatDateRange("2020-01-01", "2023-06-01", false)
    expect(result).toContain("—")
    expect(result).toContain("2020")
    expect(result).toContain("2023")
    expect(result).not.toContain("Present")
  })

  it("returns Present when isCurrent is true", () => {
    const result = formatDateRange("2020-01-01", "2023-06-01", true)
    expect(result).toContain("Present")
    expect(result).toContain("2020")
  })

  it("returns Present when endDate is null but startDate is present", () => {
    const result = formatDateRange("2020-01-01", null, false)
    expect(result).toContain("Present")
    expect(result).toContain("2020")
  })

  it("includes the em dash separator", () => {
    const result = formatDateRange("2020-01-01", "2023-06-01", false)
    expect(result).toContain("—")
  })

  it("handles only startDate with isCurrent false and endDate null", () => {
    const result = formatDateRange("2019-03-15", null, false)
    expect(result).toContain("2019")
    expect(result).toContain("Present")
  })
})

describe("formatMonthYear", () => {
  it("returns empty string for null input", () => {
    expect(formatMonthYear(null)).toBe("")
  })

  it("formats a date with zero-padded month and year", () => {
    expect(formatMonthYear("2022-03-15")).toBe("03/2022")
  })

  it("formats a date with two-digit month and year", () => {
    expect(formatMonthYear("2022-12-01")).toBe("12/2022")
  })
})

describe("formatYear", () => {
  it("returns empty string for null input", () => {
    expect(formatYear(null)).toBe("")
  })

  it("formats a date as year only", () => {
    expect(formatYear("2018-09-01")).toBe("2018")
  })
})

describe("parseDateInput", () => {
  it("returns null for null input", () => {
    expect(parseDateInput(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(parseDateInput(undefined)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseDateInput("")).toBeNull()
  })

  it("returns null for whitespace-only string", () => {
    expect(parseDateInput("   ")).toBeNull()
  })

  it("passes through YYYY-MM-DD unchanged", () => {
    expect(parseDateInput("2023-06-15")).toBe("2023-06-15")
  })

  it("converts YYYY-MM to YYYY-MM-01", () => {
    expect(parseDateInput("2023-06")).toBe("2023-06-01")
  })

  it("converts MM/YYYY to YYYY-MM-01", () => {
    expect(parseDateInput("06/2023")).toBe("2023-06-01")
  })

  it("converts MM/DD/YYYY to YYYY-MM-DD", () => {
    expect(parseDateInput("06/15/2023")).toBe("2023-06-15")
  })

  it("converts MM.YYYY to YYYY-MM-01", () => {
    expect(parseDateInput("06.2023")).toBe("2023-06-01")
  })

  it("converts YYYY.MM to YYYY-MM-01", () => {
    expect(parseDateInput("2023.06")).toBe("2023-06-01")
  })

  it("converts DD.MM.YYYY to YYYY-MM-DD", () => {
    expect(parseDateInput("15.06.2023")).toBe("2023-06-15")
  })

  it("returns null for unrecognized format", () => {
    expect(parseDateInput("June 2023")).toBeNull()
  })

  it("returns null for partial input", () => {
    expect(parseDateInput("06/23")).toBeNull()
  })

  it("trims whitespace before parsing", () => {
    expect(parseDateInput("  06/2023  ")).toBe("2023-06-01")
  })
})

describe("toEditableFullDate", () => {
  it("returns empty string for null input", () => {
    expect(toEditableFullDate(null)).toBe("")
  })

  it("returns empty string for empty string input", () => {
    expect(toEditableFullDate("")).toBe("")
  })

  it("passes through 'Present' unchanged", () => {
    expect(toEditableFullDate("Present")).toBe("Present")
  })

  it("passes through already-formatted MM/DD/YYYY unchanged", () => {
    expect(toEditableFullDate("06/15/2023")).toBe("06/15/2023")
  })

  it("converts YYYY-MM-DD to MM/DD/YYYY", () => {
    expect(toEditableFullDate("2023-06-15")).toBe("06/15/2023")
  })

  it("converts YYYY-MM-DD with zero-padded month and day", () => {
    expect(toEditableFullDate("2020-01-05")).toBe("01/05/2020")
  })

  it("converts YYYY-MM (no day) to MM/01/YYYY", () => {
    expect(toEditableFullDate("2023-06")).toBe("06/01/2023")
  })

  it("converts YYYY-MM with zero-padded month to MM/01/YYYY", () => {
    expect(toEditableFullDate("2020-01")).toBe("01/01/2020")
  })

  it("returns unrecognized format as-is", () => {
    expect(toEditableFullDate("June 2023")).toBe("June 2023")
  })
})
