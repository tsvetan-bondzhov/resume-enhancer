import type { ResumeSectionDto, TemplateDto } from "@/types/api"

/**
 * Returns visible sections ordered according to the template definition.
 *
 * Rules:
 * - Visibility filtering is applied first: sections with `visible === false` are always excluded.
 * - `single-column` / `modern-accent`: follows `layout.sectionOrder`.
 * - `two-column`: follows `columns.left` then `columns.right`.
 * - Sections absent from the template order arrays are appended last in document order.
 * - Sections are NEVER silently dropped.
 *
 * Note: `sectionOrder` strings now match `section.sectionType` values (e.g. "WORK_EXPERIENCE").
 * After Story 3.11, template definitions use enum names — full alignment is achieved.
 */
export function getOrderedSections(
  sections: ResumeSectionDto[],
  template: TemplateDto | null
): ResumeSectionDto[] {
  const visibleSections = sections.filter((s) => s.visible)
  const layout = template?.templateDefinition?.layout
  if (!layout) return visibleSections

  const layoutType = template?.templateDefinition?.layoutType

  if (layoutType === "two-column") {
    const left = layout.columns?.left ?? []
    const right = layout.columns?.right ?? []
    const orderedIds = [...left, ...right]
    const inOrder = orderedIds
      .map((id) => visibleSections.find((s) => s.sectionType === id))
      .filter((s): s is ResumeSectionDto => s !== undefined)
    const remaining = visibleSections.filter((s) => !orderedIds.includes(s.sectionType))
    return [...inOrder, ...remaining]
  }

  // single-column and modern-accent
  const sectionOrder = layout.sectionOrder ?? []
  const inOrder = sectionOrder
    .map((id) => visibleSections.find((s) => s.sectionType === id))
    .filter((s): s is ResumeSectionDto => s !== undefined)
  const remaining = visibleSections.filter((s) => !sectionOrder.includes(s.sectionType))
  return [...inOrder, ...remaining]
}
