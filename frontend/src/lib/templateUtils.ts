import type { ResumeSectionDto, TemplateDto } from "@/types/api"

/**
 * Orders the given sections to follow `sectionOrder`:
 * - sections whose `sectionType` is listed in `sectionOrder` come first, in that order;
 * - any section not listed is appended afterwards in its original array order;
 * - sections are NEVER dropped.
 */
function applySectionOrder(
  sections: ResumeSectionDto[],
  sectionOrder: string[] | undefined | null
): ResumeSectionDto[] {
  if (!sectionOrder || sectionOrder.length === 0) return sections

  const rank = new Map(sectionOrder.map((type, index) => [type, index]))
  const listed: ResumeSectionDto[] = []
  const unlisted: ResumeSectionDto[] = []

  for (const section of sections) {
    if (rank.has(section.sectionType)) listed.push(section)
    else unlisted.push(section)
  }

  listed.sort((a, b) => (rank.get(a.sectionType) ?? 0) - (rank.get(b.sectionType) ?? 0))
  return [...listed, ...unlisted]
}

/**
 * Returns visible sections ordered for rendering.
 *
 * Rules:
 * - Visibility filtering is applied first: sections with `visible === false` are always excluded.
 * - `single-column` / `modern-accent`: when `layout.sectionOrder` is present, visible sections are
 *   ordered to follow it (listed sections first in that order; unlisted visible sections appended
 *   in their original array order). With no `sectionOrder`, the user's stored array order is kept.
 * - `two-column`: sections are split into left/right groups using template `columns.left` /
 *   `columns.right`; within each group, `sectionOrder` is honored when present. Unassigned sections
 *   are appended to the right column.
 * - No template / no layout: user array order returned unchanged.
 * - Sections are NEVER silently dropped.
 *
 * Note: `sectionOrder` / column strings match `section.sectionType` values (e.g. "WORK_EXPERIENCE").
 */
export function getOrderedSections(
  sections: ResumeSectionDto[],
  template: TemplateDto | null
): ResumeSectionDto[] {
  const visibleSections = sections.filter((s) => s.visible)
  const layout = template?.templateDefinition?.layout
  if (!layout) return visibleSections

  const layoutType = template?.templateDefinition?.layoutType
  const sectionOrder = layout.sectionOrder

  if (layoutType === "two-column") {
    const leftIds = new Set(layout.columns?.left ?? [])
    const rightIds = new Set(layout.columns?.right ?? [])
    const leftSections = applySectionOrder(
      visibleSections.filter((s) => leftIds.has(s.sectionType)),
      sectionOrder
    )
    const rightSections = applySectionOrder(
      visibleSections.filter((s) => rightIds.has(s.sectionType)),
      sectionOrder
    )
    const unassigned = visibleSections.filter(
      (s) => !leftIds.has(s.sectionType) && !rightIds.has(s.sectionType)
    )
    return [...leftSections, ...rightSections, ...unassigned]
  }

  // single-column and modern-accent: honor sectionOrder when present.
  return applySectionOrder(visibleSections, sectionOrder)
}
