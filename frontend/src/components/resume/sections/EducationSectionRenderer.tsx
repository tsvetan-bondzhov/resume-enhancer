import { formatYear } from "@/lib/dateUtils"
import type { EducationItemDto } from "@/types/api"

interface EducationSectionRendererProps {
  items: EducationItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
}

export default function EducationSectionRenderer({
  items,
  onFieldChange,
}: EducationSectionRendererProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id}>
          {(item.degree != null || item.fieldOfStudy != null) && (
            <p className="font-semibold text-sm">
              {onFieldChange ? (
                <>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      onFieldChange(item.id, "degree", e.currentTarget.textContent ?? "")
                    }
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    aria-label="Edit degree"
                  >
                    {item.degree ?? ""}
                  </span>
                  {item.degree && item.fieldOfStudy && " — "}
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      onFieldChange(item.id, "fieldOfStudy", e.currentTarget.textContent ?? "")
                    }
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    aria-label="Edit fieldOfStudy"
                  >
                    {item.fieldOfStudy ?? ""}
                  </span>
                </>
              ) : (
                <span>
                  {[item.degree, item.fieldOfStudy].filter(Boolean).join(" — ")}
                </span>
              )}
            </p>
          )}
          {(item.institution != null || item.startDate != null || item.endDate != null) && (
            <p className="text-muted-foreground italic text-sm">
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "institution", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                  aria-label="Edit institution"
                >
                  {item.institution ?? ""}
                </span>
              ) : (
                <span>{item.institution}</span>
              )}
              {item.institution && (item.startDate || item.endDate) && " · "}
              {onFieldChange ? (
                <>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      onFieldChange(item.id, "startDate", e.currentTarget.textContent ?? "")
                    }
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    aria-label="Edit startDate"
                  >
                    {item.startDate ?? ""}
                  </span>
                  {" — "}
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      onFieldChange(item.id, "endDate", e.currentTarget.textContent ?? "")
                    }
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    aria-label="Edit endDate"
                  >
                    {item.endDate ?? ""}
                  </span>
                </>
              ) : (
                <span>{(() => {
                  const start = formatYear(item.startDate)
                  const end = !item.endDate ? "Present" : formatYear(item.endDate)
                  return start ? `${start} — ${end}` : end
                })()}</span>
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
