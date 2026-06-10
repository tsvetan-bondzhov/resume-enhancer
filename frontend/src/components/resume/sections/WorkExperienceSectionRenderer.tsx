import { formatDateRange } from "@/lib/dateUtils"
import type { WorkExperienceItemDto } from "@/types/api"

interface WorkExperienceSectionRendererProps {
  items: WorkExperienceItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
}

export default function WorkExperienceSectionRenderer({
  items,
  onFieldChange,
}: WorkExperienceSectionRendererProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id}>
          {item.jobTitle != null && (
            <p className="font-semibold text-sm">
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "jobTitle", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                  aria-label="Edit jobTitle"
                >
                  {item.jobTitle}
                </span>
              ) : (
                <span>{item.jobTitle}</span>
              )}
            </p>
          )}
          {(item.company != null || item.startDate != null || item.endDate != null || item.isCurrent) && (
            <p className="text-muted-foreground italic text-sm">
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "company", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                  aria-label="Edit company"
                >
                  {item.company ?? ""}
                </span>
              ) : (
                <span>{item.company}</span>
              )}
              {item.company && (item.startDate || item.endDate || item.isCurrent) && " · "}
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
                    {item.isCurrent ? "Present" : (item.endDate ?? "")}
                  </span>
                </>
              ) : (
                <span>{formatDateRange(item.startDate, item.endDate, item.isCurrent)}</span>
              )}
            </p>
          )}
          {item.description != null && (
            <p className="text-sm mt-1">
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "description", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                  aria-label="Edit description"
                >
                  {item.description}
                </span>
              ) : (
                <span>{item.description}</span>
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
