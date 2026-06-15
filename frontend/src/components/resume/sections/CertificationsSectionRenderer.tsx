import React from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2, GripVertical, Plus } from "lucide-react"
import type { CertificationItemDto, ResumeItemDto } from "@/types/api"

interface CertificationsSectionRendererProps {
  readonly items: readonly CertificationItemDto[]
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

export default function CertificationsSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: CertificationsSectionRendererProps) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorderItems) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorderItems(arrayMove([...items], oldIndex, newIndex))
  }

  const content = (
    <div className="space-y-2 group/section">
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} />}
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <SortableItemWrapper id={item.id} onDeleteItem={onDeleteItem}>
            <div className="text-sm">
              {item.name != null && (
                <p className="font-medium">
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
                    <span>{item.name}</span>
                  )}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {item.issuer != null && (
                  <>
                    {onFieldChange ? (
                      <span
                        role="textbox"
                        tabIndex={0}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onFieldChange(item.id, "issuer", e.currentTarget.textContent ?? "")
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                          }
                        }}
                        className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                        aria-label="Edit issuer"
                      >
                        {item.issuer}
                      </span>
                    ) : (
                      <span>{item.issuer}</span>
                    )}
                    {" · "}
                  </>
                )}
                {onFieldChange ? (
                  <span
                    role="textbox"
                    tabIndex={0}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      onFieldChange(item.id, "issueDate", e.currentTarget.textContent ?? "")
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                      }
                    }}
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    aria-label="Edit issueDate"
                  >
                    {item.issueDate ?? ""}
                  </span>
                ) : (
                  item.issueDate != null && <span>{item.issueDate}</span>
                )}
                {(item.expirationDate != null || onFieldChange) && " — "}
                {onFieldChange ? (
                  <span
                    role="textbox"
                    tabIndex={0}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      onFieldChange(item.id, "expirationDate", e.currentTarget.textContent ?? "")
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                      }
                    }}
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    aria-label="Edit expirationDate"
                  >
                    {item.expirationDate ?? ""}
                  </span>
                ) : (
                  item.expirationDate != null && <span>{item.expirationDate}</span>
                )}
              </p>
            </div>
          </SortableItemWrapper>
          {onAddItem && <AddItemButton onClick={() => onAddItem(index + 1)} />}
        </React.Fragment>
      ))}
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
