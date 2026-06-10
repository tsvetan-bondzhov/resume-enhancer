import type { LanguageItemDto } from "@/types/api"

interface LanguagesSectionRendererProps {
  items: LanguageItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
}

export default function LanguagesSectionRenderer({
  items,
  onFieldChange,
}: LanguagesSectionRendererProps) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 text-sm">
          {item.language != null && (
            <>
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "language", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                  aria-label="Edit language"
                >
                  {item.language}
                </span>
              ) : (
                <span>{item.language}</span>
              )}
            </>
          )}
          {item.proficiency != null && (
            <span className="inline-block bg-zinc-100 text-zinc-600 text-xs px-2 py-0.5 rounded-full">
              {onFieldChange ? (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onFieldChange(item.id, "proficiency", e.currentTarget.textContent ?? "")
                  }
                  className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                  aria-label="Edit proficiency"
                >
                  {item.proficiency}
                </span>
              ) : (
                item.proficiency
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
