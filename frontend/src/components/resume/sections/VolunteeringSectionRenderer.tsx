import { formatDateRange } from "@/lib/dateUtils"
import type { VolunteeringItemDto } from "@/types/api"

interface VolunteeringSectionRendererProps {
  items: VolunteeringItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
}

export default function VolunteeringSectionRenderer({
  items,
  onFieldChange,
}: VolunteeringSectionRendererProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id}>
          {item.role != null && (
            <p className="font-semibold text-sm">
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "role", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                  aria-label="Edit role"
                >
                  {item.role}
                </span>
              ) : (
                <span>{item.role}</span>
              )}
            </p>
          )}
          {(item.organization != null || item.startDate != null || item.endDate != null || item.isCurrent) && (
            <p className="text-muted-foreground italic text-sm">
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "organization", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                  aria-label="Edit organization"
                >
                  {item.organization ?? ""}
                </span>
              ) : (
                <span>{item.organization}</span>
              )}
              {item.organization && (item.startDate || item.endDate || item.isCurrent) && " · "}
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
