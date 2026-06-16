import React from "react"
import type { SkillItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper } from "./sectionRendererShared"

interface SkillsSectionRendererProps {
  readonly items: readonly SkillItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

export default function SkillsSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: SkillsSectionRendererProps) {
  const content = (
    <div className="flex flex-wrap gap-1 group/section">
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} />}
      {items.map((item, index) =>
        item.name == null ? null : (
          <React.Fragment key={item.id}>
            <SortableItemWrapper
              id={item.id}
              onDeleteItem={onDeleteItem}
              containerClassName="relative group/item inline-flex break-inside-avoid"
              deleteButtonClassName="absolute right-[-16px] top-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted hover:text-red-500"
              deleteIconClassName="h-3 w-3"
            >
              <span className="inline-block bg-zinc-100 text-zinc-700 text-xs px-2 py-0.5 rounded-sm">
                {onFieldChange ? (
                  <span
                    role="textbox"
                    tabIndex={0}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      onFieldChange(item.id, "name", e.currentTarget.textContent ?? "")
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                      }
                    }}
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    aria-label="Edit name"
                  >
                    {item.name}
                  </span>
                ) : (
                  item.name
                )}
              </span>
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
