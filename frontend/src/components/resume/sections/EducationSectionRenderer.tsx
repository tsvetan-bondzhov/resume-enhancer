import React from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2, GripVertical, Plus } from "lucide-react"
import { formatYear } from "@/lib/dateUtils"
import type { EducationItemDto, ResumeItemDto } from "@/types/api"

interface EducationSectionRendererProps {
  items: EducationItemDto[]
  onFieldChange?: (itemId: string, field: string, value: string) => void
  onAddItem?: (position: number) => void
  onDeleteItem?: (itemId: string) => void
  onReorderItems?: (newItems: ResumeItemDto[]) => void
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

export default function EducationSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: EducationSectionRendererProps) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorderItems) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorderItems(arrayMove(items, oldIndex, newIndex))
  }

  const content = (
    <div className="space-y-3 group/section">
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} />}
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <SortableItemWrapper id={item.id} onDeleteItem={onDeleteItem}>
            <div>
              {(item.degree != null || item.fieldOfStudy != null) && (
                <p className="font-semibold text-sm">
                  {onFieldChange ? (
                    <>
                      <span
                        role="textbox"
                        tabIndex={0}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onFieldChange(item.id, "degree", e.currentTarget.textContent ?? "")
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                          }
                        }}
                        className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                        aria-label="Edit degree"
                      >
                        {item.degree ?? ""}
                      </span>
                      {item.degree && item.fieldOfStudy && " — "}
                      <span
                        role="textbox"
                        tabIndex={0}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onFieldChange(item.id, "fieldOfStudy", e.currentTarget.textContent ?? "")
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                          }
                        }}
                        className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                        aria-label="Edit fieldOfStudy"
                      >
                        {item.fieldOfStudy ?? ""}
                      </span>
                    </>
                  ) : (
                    <span>
                      {[item.degree, item.fieldOfStudy].filter(Boolean).join(" — ")}
                    </span>
                  )}
                </p>
              )}
              {(item.institution != null || item.startDate != null || item.endDate != null) && (
                <p className="text-muted-foreground italic text-sm">
                  {onFieldChange ? (
                    <span
                      role="textbox"
                      tabIndex={0}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) =>
                        onFieldChange(item.id, "institution", e.currentTarget.textContent ?? "")
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault()
                        }
                      }}
                      className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                      aria-label="Edit institution"
                    >
                      {item.institution ?? ""}
                    </span>
                  ) : (
                    <span>{item.institution}</span>
                  )}
                  {item.institution && (item.startDate || item.endDate) && " · "}
                  {onFieldChange ? (
                    <>
                      <span
                        role="textbox"
                        tabIndex={0}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onFieldChange(item.id, "startDate", e.currentTarget.textContent ?? "")
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                          }
                        }}
                        className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                        aria-label="Edit startDate"
                      >
                        {item.startDate ?? ""}
                      </span>
                      {" — "}
                      <span
                        role="textbox"
                        tabIndex={0}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          onFieldChange(item.id, "endDate", e.currentTarget.textContent ?? "")
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                          }
                        }}
                        className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                        aria-label="Edit endDate"
                      >
                        {item.endDate ?? ""}
                      </span>
                    </>
                  ) : (
                    <span>{(() => {
                      const start = formatYear(item.startDate)
                      const end = item.endDate ? formatYear(item.endDate) : "Present"
                      return start ? `${start} — ${end}` : end
                    })()}</span>
                  )}
                </p>
              )}
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
