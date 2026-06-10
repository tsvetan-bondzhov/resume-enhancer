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
  const end = isCurrent || !endDate ? "Present" : fmt(endDate)
  return start ? `${start} — ${end}` : end
}
