import { ExternalLink } from "lucide-react"
import { formatDateRange } from "@/lib/dateUtils"
import type { ProjectItemDto } from "@/types/api"

interface ProjectsSectionRendererProps {
  items: ProjectItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
}

export default function ProjectsSectionRenderer({
  items,
  onFieldChange,
}: ProjectsSectionRendererProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id}>
          {item.name != null && (
            <p className="font-semibold text-sm">
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "name", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                  aria-label="Edit name"
                >
                  {item.name}
                </span>
              ) : (
                <span>{item.name}</span>
              )}
            </p>
          )}
          {(item.startDate != null || item.endDate != null || item.isCurrent) && (
            <p className="text-muted-foreground italic text-sm">
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
          {item.technologies != null && (
            <div className="flex flex-wrap gap-1 mt-1">
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "technologies", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block text-xs text-muted-foreground"
                  aria-label="Edit technologies"
                >
                  {item.technologies}
                </span>
              ) : (
                item.technologies.split(",").map((tech) => tech.trim()).filter(Boolean).map((tech) => (
                  <span
                    key={tech}
                    className="inline-block bg-zinc-100 text-zinc-700 text-xs px-2 py-0.5 rounded-sm"
                  >
                    {tech}
                  </span>
                ))
              )}
            </div>
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
          {item.link != null && (
            <div className="mt-1">
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "link", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block text-xs text-primary"
                  aria-label="Edit link"
                >
                  {item.link}
                </span>
              ) : (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary"
                >
                  <ExternalLink className="h-3 w-3" />
                  {item.link}
                </a>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
