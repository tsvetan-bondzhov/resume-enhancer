import React from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2, GripVertical, Plus } from "lucide-react"
import type { SkillItemDto } from "@/types/api"

interface SkillsSectionRendererProps {
  items: SkillItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
  onAddItem?: (position: number) => void
  onDeleteItem?: (itemId: string) => void
  onReorderItems?: (newItems: SkillItemDto[]) => void
}

interface SortableItemWrapperProps {
  id: string
  children: React.ReactNode
  onDeleteItem?: (itemId: string) => void
}

function SortableItemWrapper({ id, children, onDeleteItem }: SortableItemWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/item inline-flex">
      <div
        className="absolute left-[-20px] top-0 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-grab touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {onDeleteItem && (
        <button
          type="button"
          className="absolute right-[-16px] top-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted hover:text-red-500"
          aria-label="Delete item"
          onClick={() => onDeleteItem(id)}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      {children}
    </div>
  )
}

function AddItemButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex items-center justify-center w-full h-4 opacity-0 group-hover/section:opacity-100 transition-opacity hover:opacity-100"
      aria-label="Add item here"
      onClick={onClick}
    >
      <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <Plus className="h-3 w-3" />
      </div>
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
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorderItems) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorderItems(arrayMove(items, oldIndex, newIndex))
  }

  const hasCategories = items.some((item) => item.category)

  const renderItems = () => {
    if (!hasCategories) {
      // Flat chip list
      return (
        <div className="flex flex-wrap gap-1 group/section">
          {onAddItem && <AddItemButton onClick={() => onAddItem(0)} />}
          {items.map((item, index) =>
            item.name != null ? (
              <React.Fragment key={item.id}>
                <SortableItemWrapper id={item.id} onDeleteItem={onDeleteItem}>
                  <span className="inline-block bg-zinc-100 text-zinc-700 text-xs px-2 py-0.5 rounded-sm">
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
                </SortableItemWrapper>
                {onAddItem && <AddItemButton onClick={() => onAddItem(index + 1)} />}
              </React.Fragment>
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
      <div className="space-y-2 group/section">
        {onAddItem && <AddItemButton onClick={() => onAddItem(0)} />}
        {Array.from(groups.entries()).map(([category, groupItems]) => (
          <div key={category}>
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {category}
            </p>
            <div className="flex flex-wrap gap-1">
              {groupItems.map((item) =>
                item.name != null ? (
                  <React.Fragment key={item.id}>
                    <SortableItemWrapper id={item.id} onDeleteItem={onDeleteItem}>
                      <span className="inline-block bg-zinc-100 text-zinc-700 text-xs px-2 py-0.5 rounded-sm">
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
                    </SortableItemWrapper>
                    {onAddItem && <AddItemButton onClick={() => onAddItem(items.indexOf(item) + 1)} />}
                  </React.Fragment>
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const content = renderItems()

  if (onReorderItems) {
    return (
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {content}
        </SortableContext>
      </DndContext>
    )
  }

  return content
}
