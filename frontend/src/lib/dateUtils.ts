/**
 * Formats a date range as a human-readable string using locale-aware month abbreviations.
 *
 * @param startDate ISO date string (e.g. "2020-01-15") or null
 * @param endDate   ISO date string (e.g. "2023-06-30") or null
 * @param isCurrent Whether the position/education is currently ongoing
 * @returns Formatted range such as "Jan 2020 — Jun 2023" or "Jan 2020 — Present" or ""
 */
export function formatDateRange(
  startDate: string | null,
  endDate: string | null,
  isCurrent: boolean
): string {
  if (!startDate && !endDate) return ""
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(d))
  const start = startDate ? fmt(startDate) : ""
  const end = !isCurrent && endDate ? fmt(endDate) : "Present"
  return start ? `${start} — ${end}` : end
}

/**
 * Formats an ISO date string as "MM/YYYY" with zero-padded month.
 * Uses UTC methods to avoid timezone drift.
 *
 * @param date ISO date string (e.g. "2022-03-15") or null
 * @returns Formatted string such as "03/2022", or "" for null input
 */
export function formatMonthYear(date: string | null): string {
  if (!date) return ""
  const d = new Date(date)
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  const year = d.getUTCFullYear()
  return `${month}/${year}`
}

/**
 * Formats an ISO date string as "YYYY".
 * Uses UTC methods for consistency.
 *
 * @param date ISO date string (e.g. "2018-09-01") or null
 * @returns Formatted string such as "2018", or "" for null input
 */
export function formatYear(date: string | null): string {
  if (!date) return ""
  return String(new Date(date).getUTCFullYear())
}

/**
 * Converts a date string from storage/backend format to an editable "MM/YYYY" string
 * suitable for display in resume editor fields.
 *
 * Accepted input formats:
 *   - "YYYY-MM-DD" → "MM/YYYY"  (ISO full date)
 *   - "YYYY-MM"    → "MM/YYYY"  (ISO year-month)
 *   - "MM/YYYY"    → "MM/YYYY"  (already correct, passed through)
 *   - "Present"    → "Present"  (passed through)
 *   - null / ""    → ""
 *
 * @param date Date string from a DTO field, or null
 * @returns Display-ready string for an editable date field
 */
export function toEditableDate(date: string | null): string {
  if (!date) return ""
  if (date === "Present") return "Present"
  // Already MM/YYYY
  if (/^\d{2}\/\d{4}$/.test(date)) return date
  // YYYY-MM-DD or YYYY-MM
  const isoMatch = /^(\d{4})-(\d{2})/.exec(date)
  if (isoMatch) {
    const year = isoMatch[1]
    const month = isoMatch[2]
    return `${month}/${year}`
  }
  // Unrecognized format — return as-is so the user can correct it
  return date
}
