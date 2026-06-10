import type { ResumeItemDto, ResumeSectionDto } from "@/types/api"

interface ResumeSectionProps {
  section: ResumeSectionDto
  onTitleChange: (title: string) => void
  onFieldChange: (itemId: string, field: string, value: string) => void
}

/**
 * Extracts displayable key-value pairs from any ResumeItemDto subtype.
 * For GenericItem (UNKNOWN), returns the `fields` map directly.
 * For typed items, builds a display map from all non-null, non-id, non-type fields.
 * Story 3.15 will replace this with per-type renderers.
 */
function getItemFields(item: ResumeItemDto): Record<string, string> {
  if (item.type === "UNKNOWN") return item.fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, type, ...rest } = item as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(rest)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)])
  )
}

export default function ResumeSection({
  section,
  onTitleChange,
  onFieldChange,
}: ResumeSectionProps) {
  return (
    <section aria-labelledby={`section-title-${section.sectionType}`} className="mb-6">
      <h2
        id={`section-title-${section.sectionType}`}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onTitleChange(e.currentTarget.textContent ?? "")}
        className="text-base font-semibold border-b border-zinc-200 pb-1 mb-2 uppercase tracking-wide outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text"
        aria-label={`Edit section title: ${section.title}`}
      >
        {section.title}
      </h2>
      <ul className="space-y-1 text-sm list-none p-0">
        {section.items.map((item) =>
          Object.entries(getItemFields(item))
            .filter(([, v]) => Boolean(v))
            .map(([field, value]) => (
              <li key={`${item.id}-${field}`}>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(
                      item.id,
                      field,
                      e.currentTarget.textContent ?? ""
                    )
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                  aria-label={`Edit ${field}`}
                >
                  {value}
                </span>
              </li>
            ))
        )}
      </ul>
    </section>
  )
}
