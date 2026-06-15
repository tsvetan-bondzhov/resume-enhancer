import React from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2, GripVertical, Plus } from "lucide-react"
import type { ResumeItemDto } from "@/types/api"

// ─── Shared editable field primitives ────────────────────────────────────────

interface EditableFieldProps {
  readonly itemId: string
  readonly field: string
  readonly value: string | null
  readonly onFieldChange: (itemId: string, field: string, value: string) => void
  readonly className?: string
  readonly ariaLabel?: string
}

export function EditableField({
  itemId,
  field,
  value,
  onFieldChange,
  className = "outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block",
  ariaLabel,
}: EditableFieldProps) {
  return (
    <span
      role="textbox"
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onFieldChange(itemId, field, e.currentTarget.textContent ?? "")}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault()
        }
      }}
      className={className}
      aria-label={ariaLabel ?? `Edit ${field}`}
    >
      {value ?? ""}
    </span>
  )
}

interface EditableDateRangeProps {
  readonly itemId: string
  readonly startDate: string | null
  readonly endDate: string | null
  readonly isCurrent?: boolean
  readonly onFieldChange: (itemId: string, field: string, value: string) => void
}

export function EditableDateRange({
  itemId,
  startDate,
  endDate,
  isCurrent,
  onFieldChange,
}: EditableDateRangeProps) {
  return (
    <>
      <EditableField
        itemId={itemId}
        field="startDate"
        value={startDate}
        onFieldChange={onFieldChange}
        ariaLabel="Edit startDate"
      />
      {" — "}
      <EditableField
        itemId={itemId}
        field="endDate"
        value={isCurrent ? "Present" : endDate}
        onFieldChange={onFieldChange}
        ariaLabel="Edit endDate"
      />
    </>
  )
}

interface SortableItemWrapperProps {
  readonly id: string
  readonly children: React.ReactNode
  readonly onDeleteItem?: (itemId: string) => void
  readonly containerClassName?: string
  readonly deleteButtonClassName?: string
  readonly deleteIconClassName?: string
}

export function SortableItemWrapper({
  id,
  children,
  onDeleteItem,
  containerClassName = "relative group/item break-inside-avoid",
  deleteButtonClassName = "absolute right-0 top-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted hover:text-red-500",
  deleteIconClassName = "h-3.5 w-3.5",
}: SortableItemWrapperProps) {
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
    <div ref={setNodeRef} style={style} className={containerClassName}>
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
          className={deleteButtonClassName}
          aria-label="Delete item"
          onClick={() => onDeleteItem(id)}
        >
          <Trash2 className={deleteIconClassName} />
        </button>
      )}
      {children}
    </div>
  )
}

export function AddItemButton({ onClick }: Readonly<{ onClick: () => void }>) {
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

export function createHandleDragEnd<T extends { id: string }>(
  items: readonly T[],
  onReorderItems?: (newItems: ResumeItemDto[]) => void,
) {
  return function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorderItems) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorderItems(arrayMove([...items], oldIndex, newIndex))
  }
}

interface SectionDndWrapperProps {
  readonly items: readonly { id: string }[]
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
  readonly children: React.ReactNode
}

interface EditableTitleFieldProps {
  readonly itemId: string
  readonly field: string
  readonly value: string | null
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
}

export function EditableTitleField({ itemId, field, value, onFieldChange }: EditableTitleFieldProps) {
  if (value == null) return null
  return (
    <p className="font-semibold text-sm">
      {onFieldChange ? (
        <EditableField itemId={itemId} field={field} value={value} onFieldChange={onFieldChange} />
      ) : (
        <span>{value}</span>
      )}
    </p>
  )
}

interface EditableDescriptionFieldProps {
  readonly itemId: string
  readonly value: string | null
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
}

export function EditableDescriptionField({ itemId, value, onFieldChange }: EditableDescriptionFieldProps) {
  if (value == null) return null
  return (
    <p className="text-sm mt-1">
      {onFieldChange ? (
        <EditableField itemId={itemId} field="description" value={value} onFieldChange={onFieldChange} />
      ) : (
        <span>{value}</span>
      )}
    </p>
  )
}

export function SectionDndWrapper({ items, onReorderItems, children }: SectionDndWrapperProps) {
  const handleDragEnd = createHandleDragEnd(items, onReorderItems)

  if (onReorderItems) {
    return (
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </DndContext>
    )
  }

  return <>{children}</>
}
