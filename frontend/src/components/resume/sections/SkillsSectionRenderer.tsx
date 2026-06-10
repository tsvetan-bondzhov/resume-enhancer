import type { SkillItemDto } from "@/types/api"

interface SkillsSectionRendererProps {
  items: SkillItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
}

export default function SkillsSectionRenderer({
  items,
  onFieldChange,
}: SkillsSectionRendererProps) {
  const hasCategories = items.some((item) => item.category)

  if (!hasCategories) {
    // Flat chip list
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item) =>
          item.name != null ? (
            <span
              key={item.id}
              className="inline-block bg-zinc-100 text-zinc-700 text-xs px-2 py-0.5 rounded-sm"
            >
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
                item.name
              )}
            </span>
          ) : null
        )}
      </div>
    )
  }

  // Group by category
  const groups = new Map<string, SkillItemDto[]>()
  for (const item of items) {
    const key = item.category ?? "Other"
    const existing = groups.get(key)
    if (existing) {
      existing.push(item)
    } else {
      groups.set(key, [item])
    }
  }

  return (
    <div className="space-y-2">
      {Array.from(groups.entries()).map(([category, groupItems]) => (
        <div key={category}>
          <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">
            {category}
          </p>
          <div className="flex flex-wrap gap-1">
            {groupItems.map((item) =>
              item.name != null ? (
                <span
                  key={item.id}
                  className="inline-block bg-zinc-100 text-zinc-700 text-xs px-2 py-0.5 rounded-sm"
                >
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
                    item.name
                  )}
                </span>
              ) : null
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
