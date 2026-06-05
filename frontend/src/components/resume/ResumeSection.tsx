import type { ResumeSectionDto } from "@/types/api"

interface ResumeSectionProps {
  section: ResumeSectionDto
  onTitleChange: (title: string) => void
  onFieldChange: (itemId: string, field: string, value: string) => void
}

export default function ResumeSection({
  section,
  onTitleChange,
  onFieldChange,
}: ResumeSectionProps) {
  return (
    <section aria-labelledby={`section-title-${section.id}`} className="mb-6">
      <h2
        id={`section-title-${section.id}`}
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
          Object.entries(item.fields)
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
