import React from "react"
import type { SkillItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, SectionDndWrapper, EditableField } from "./sectionRendererShared"
import { Plus } from "lucide-react"

interface SkillsSectionRendererProps {
  readonly items: readonly SkillItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

/** Inline add button that participates in the flex-wrap flow */
function InlineAddButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add skill"
      title="Add skill"
      className="inline-flex items-center justify-center h-5 w-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/section:opacity-100 transition-opacity cursor-pointer"
    >
      <Plus className="h-3 w-3" />
    </button>
  )
}

export default function SkillsSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: SkillsSectionRendererProps) {
  const content = (
    <div className="flex flex-wrap gap-1 items-center group/section">
      {items.map((item) => {
        // In read-only mode skip items with no name; in editor mode always render
        if (item.name == null && !onFieldChange) return null
        return (
          <SortableItemWrapper
            key={item.id}
            id={item.id}
            onDeleteItem={onDeleteItem}
            containerClassName="relative group/item inline-flex break-inside-avoid"
            deleteButtonClassName="absolute right-[-14px] top-[-6px] opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted hover:text-red-500"
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
        )
      })}
      {onAddItem && <InlineAddButton onClick={() => onAddItem(items.length)} />}
    </div>
  )

  return (
    <SectionDndWrapper items={items} onReorderItems={onReorderItems} strategy="rect">
      {content}
    </SectionDndWrapper>
  )
}
