import { describe, it, expect } from "vitest"
import { formatDateRange } from "./dateUtils"

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
