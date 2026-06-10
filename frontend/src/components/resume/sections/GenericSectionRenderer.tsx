import type { GenericItemDto } from "@/types/api"

interface GenericSectionRendererProps {
  items: GenericItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
}

export default function GenericSectionRenderer({
  items,
  onFieldChange,
}: GenericSectionRendererProps) {
  return (
    <>
      {items.map((item) => {
        const visibleEntries = Object.entries(item.fields).filter(([, v]) => Boolean(v))
        return (
          <ul key={item.id} className="space-y-1 text-sm list-none p-0">
            {visibleEntries.map(([fieldKey, fieldValue]) => (
              <li key={`${item.id}-${fieldKey}`}>
                {onFieldChange ? (
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      onFieldChange(item.id, fieldKey, e.currentTarget.textContent ?? "")
                    }
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    aria-label={`Edit ${fieldKey}`}
                  >
                    {fieldValue}
                  </span>
                ) : (
                  <span>{fieldValue}</span>
                )}
              </li>
            ))}
          </ul>
        )
      })}
    </>
  )
}
