import React from "react"
import type { SkillItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper, EditableField } from "./sectionRendererShared"

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
      {items.map((item, index) => {
        // In read-only mode skip items with no name; in editor mode always render
        if (item.name == null && !onFieldChange) return null
        return (
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
                  <EditableField
                    itemId={item.id}
                    field="name"
                    value={item.name}
                    onFieldChange={onFieldChange}
                    placeholder="Click to add skill"
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    ariaLabel="Edit name"
                  />
                ) : (
                  item.name
                )}
              </span>
            </SortableItemWrapper>
            {onAddItem && <AddItemButton onClick={() => onAddItem(index + 1)} />}
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
