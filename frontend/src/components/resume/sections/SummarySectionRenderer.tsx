import type { SummaryItemDto } from "@/types/api"

interface SummarySectionRendererProps {
  items: SummaryItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
}

export default function SummarySectionRenderer({
  items,
  onFieldChange,
}: SummarySectionRendererProps) {
  return (
    <>
      {items.map((item) =>
        item.text != null ? (
          onFieldChange ? (
            <p
              key={item.id}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) =>
                onFieldChange(item.id, "text", e.currentTarget.textContent ?? "")
              }
              className="text-sm outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text"
              aria-label="Edit text"
            >
              {item.text}
            </p>
          ) : (
            <p key={item.id} className="text-sm">
              {item.text}
            </p>
          )
        ) : null
      )}
    </>
  )
}
