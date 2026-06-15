import React from "react"
import { ExternalLink } from "lucide-react"
import type { SummaryItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper } from "./sectionRendererShared"

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
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} />}
      {items.map((item, index) =>
        item.text == null ? null : (
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
                      <div
                        role="textbox"
                        aria-multiline="true"
                        tabIndex={0}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onFieldChange(item.id, "text", e.currentTarget.textContent ?? "")
                        }
                        className="text-sm outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text"
                        aria-label="Edit text"
                      >
                        {item.text}
                      </div>
                    ) : (
                      <p className="text-sm">{item.text}</p>
                    )}
                  </>
                )
              })()}
            </SortableItemWrapper>
            {onAddItem && <AddItemButton onClick={() => onAddItem(index + 1)} />}
          </React.Fragment>
        )
      )}
    </div>
  )

  return (
    <SectionDndWrapper items={items} onReorderItems={onReorderItems}>
      {content}
    </SectionDndWrapper>
  )
}
