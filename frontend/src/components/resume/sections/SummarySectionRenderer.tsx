import React from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2, GripVertical, Plus, ExternalLink } from "lucide-react"
import type { SummaryItemDto, ResumeItemDto } from "@/types/api"

interface SummarySectionRendererProps {
  readonly items: readonly SummaryItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

interface SortableItemWrapperProps {
  readonly id: string
  readonly children: React.ReactNode
  readonly onDeleteItem?: (itemId: string) => void
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
    <div ref={setNodeRef} style={style} className="relative group/item break-inside-avoid">
      <button
        type="button"
        className="absolute left-[-20px] top-0 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 transition-opacity cursor-grab touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      {onDeleteItem && (
        <button
          type="button"
          className="absolute right-0 top-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted hover:text-red-500"
          aria-label="Delete item"
          onClick={() => onDeleteItem(id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {children}
    </div>
  )
}

function AddItemButton({ onClick }: Readonly<{ onClick: () => void }>) {
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

export default function SummarySectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: SummarySectionRendererProps) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorderItems) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorderItems(arrayMove([...items], oldIndex, newIndex))
  }

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
