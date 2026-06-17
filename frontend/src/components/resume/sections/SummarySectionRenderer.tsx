import React, { useRef } from "react"
import { ExternalLink } from "lucide-react"
import type { SummaryItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper } from "./sectionRendererShared"

const SUMMARY_PLACEHOLDER = "Click to add your professional summary"

interface SummaryTextFieldProps {
  readonly itemId: string
  readonly text: string | null
  readonly onFieldChange: (itemId: string, field: string, value: string) => void
}

function SummaryTextField({ itemId, text, onFieldChange }: SummaryTextFieldProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isEmpty = !text

  const handleFocus = () => {
    if (ref.current?.textContent === SUMMARY_PLACEHOLDER) {
      ref.current.textContent = ""
      ref.current.classList.remove("text-gray-300", "italic")
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const value = e.currentTarget.textContent ?? ""
    onFieldChange(itemId, "text", value)
    if (!value && ref.current) {
      ref.current.textContent = SUMMARY_PLACEHOLDER
      ref.current.classList.add("text-gray-300", "italic")
    }
  }

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline="true"
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      onFocus={isEmpty ? handleFocus : undefined}
      onBlur={handleBlur}
      className={`text-sm outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text${isEmpty ? " text-gray-300 italic" : ""}`}
      aria-label="Edit text"
    >
      {isEmpty ? SUMMARY_PLACEHOLDER : text}
    </div>
  )
}

interface SummarySectionRendererProps {
  readonly items: readonly SummaryItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

export default function SummarySectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: SummarySectionRendererProps) {
  const content = (
    <div className="group/section">
      {items.map((item) => {
        // In read-only mode skip items with no text; in editor mode always render so user can click to add
        if (item.text == null && !onFieldChange) return null
        return (
          <React.Fragment key={item.id}>
            <SortableItemWrapper id={item.id} onDeleteItem={onDeleteItem}>
              {(() => {
                const hasContact =
                  item.contactEmail != null ||
                  item.linkedInUrl != null ||
                  item.personalPageUrl != null ||
                  item.blogUrl != null ||
                  item.locationCountry != null ||
                  item.locationCity != null

                const location = [item.locationCity, item.locationCountry]
                  .filter(Boolean)
                  .join(", ")

                return (
                  <>
                    {hasContact && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-1">
                        {item.contactEmail != null && <span>{item.contactEmail}</span>}
                        {item.linkedInUrl != null && (
                          <a href={item.linkedInUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline">
                            LinkedIn<ExternalLink className="inline h-3 w-3 ml-0.5" />
                          </a>
                        )}
                        {item.personalPageUrl != null && (
                          <a href={item.personalPageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline">
                            Website<ExternalLink className="inline h-3 w-3 ml-0.5" />
                          </a>
                        )}
                        {item.blogUrl != null && (
                          <a href={item.blogUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline">
                            Blog<ExternalLink className="inline h-3 w-3 ml-0.5" />
                          </a>
                        )}
                        {location.length > 0 && <span>{location}</span>}
                      </div>
                    )}
                    {onFieldChange ? (
                      <SummaryTextField
                        itemId={item.id}
                        text={item.text}
                        onFieldChange={onFieldChange}
                      />
                    ) : (
                      <p className="text-sm">{item.text}</p>
                    )}
                  </>
                )
              })()}
            </SortableItemWrapper>
          </React.Fragment>
        )
      })}
      {onAddItem && <AddItemButton onClick={() => onAddItem(items.length)} isLast />}
    </div>
  )

  return (
    <SectionDndWrapper items={items} onReorderItems={onReorderItems}>
      {content}
    </SectionDndWrapper>
  )
}
