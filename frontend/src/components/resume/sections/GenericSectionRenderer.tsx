import React from "react"
import type { GenericItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper } from "./sectionRendererShared"

interface GenericSectionRendererProps {
  readonly items: readonly GenericItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

export default function GenericSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: GenericSectionRendererProps) {
  const content = (
    <div className="group/section">
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} isLast={items.length === 0} />}
      {items.map((item, index) => {
        const visibleEntries = Object.entries(item.fields).filter(([, v]) => Boolean(v))
        return (
          <React.Fragment key={item.id}>
            <SortableItemWrapper
              id={item.id}
              onDeleteItem={onDeleteItem}
              containerClassName="relative group/item"
            >
              <ul className="space-y-1 text-sm list-none p-0">
                {visibleEntries.map(([fieldKey, fieldValue]) => (
                  <li key={`${item.id}-${fieldKey}`}>
                    {onFieldChange ? (
                      <span
                        role="textbox"
                        tabIndex={0}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onFieldChange(item.id, fieldKey, e.currentTarget.textContent ?? "")
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                          }
                        }}
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
            </SortableItemWrapper>
            {onAddItem && <AddItemButton onClick={() => onAddItem(index + 1)} isLast={index === items.length - 1} />}
          </React.Fragment>
        )
      })}
    </div>
  )

  return (
    <SectionDndWrapper items={items} onReorderItems={onReorderItems}>
      {content}
    </SectionDndWrapper>
  )
}
