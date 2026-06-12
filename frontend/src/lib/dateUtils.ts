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
