import React from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2, GripVertical, Plus } from "lucide-react"
import type { ResumeItemDto } from "@/types/api"
import { formatMonthYear, toEditableDate, parseDateInput } from "@/lib/dateUtils"

// ─── Shared editable field primitives ────────────────────────────────────────

interface EditableFieldProps {
  readonly itemId: string
  readonly field: string
  readonly value: string | null
  readonly onFieldChange: (itemId: string, field: string, value: string) => void
  readonly className?: string
  readonly ariaLabel?: string
  readonly placeholder?: string
}

export function EditableField({
  itemId,
  field,
  value,
  onFieldChange,
  className = "outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block",
  ariaLabel,
  placeholder,
}: EditableFieldProps) {
  const isEmpty = !value

  const handleBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
    const el = e.currentTarget
    const text = el.textContent ?? ""
    onFieldChange(itemId, field, text)
    // Remove stray <br> the browser inserts when all text is deleted,
    // otherwise the :empty CSS selector won't match and the placeholder won't reappear.
    if (!text) el.innerHTML = ""
  }

  return (
    <span
      role="textbox"
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={isEmpty && placeholder ? placeholder : undefined}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault()
        }
      }}
      className={`editable-field ${className}`}
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
  const handleDateFieldChange = (id: string, field: string, raw: string) => {
    const parsed = parseDateInput(raw)
    onFieldChange(id, field, parsed ?? "")
    if (field === "endDate" && parsed === null) {
      onFieldChange(id, "isCurrent", "true")
    }
  }

  return (
    <>
      <EditableField
        itemId={itemId}
        field="startDate"
        value={toEditableDate(startDate)}
        onFieldChange={handleDateFieldChange}
        ariaLabel="Edit startDate"
        placeholder="Start date"
      />
      {" — "}
      <EditableField
        itemId={itemId}
        field="endDate"
        value={isCurrent ? "Present" : toEditableDate(endDate)}
        onFieldChange={handleDateFieldChange}
        ariaLabel="Edit endDate"
        placeholder="End date"
      />
    </>
  )
}

interface DateRangeDisplayProps {
  readonly itemId: string
  readonly startDate: string | null
  readonly endDate: string | null
  readonly isCurrent?: boolean
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
}

export function DateRangeContent({
  itemId,
  startDate,
  endDate,
  isCurrent,
  onFieldChange,
}: DateRangeDisplayProps) {
  return onFieldChange ? (
    <EditableDateRange
      itemId={itemId}
      startDate={startDate}
      endDate={endDate}
      isCurrent={isCurrent}
      onFieldChange={onFieldChange}
    />
  ) : (
    <span>{(() => {
      const start = formatMonthYear(startDate)
      const end = !isCurrent && endDate ? formatMonthYear(endDate) : "Present"
      return start ? `${start} — ${end}` : end
    })()}</span>
  )
}

export function DateRangeDisplay(props: DateRangeDisplayProps) {
  return (
    <p className="text-muted-foreground italic text-sm">
      <DateRangeContent {...props} />
    </p>
  )
}

interface SortableItemWrapperProps {
  readonly id: string
  readonly children: React.ReactNode
  readonly onDeleteItem?: (itemId: string) => void
  readonly containerClassName?: string
  readonly deleteButtonClassName?: string
  readonly deleteIconClassName?: string
  readonly className?: string
}

export function SortableItemWrapper({
  id,
  children,
  onDeleteItem,
  containerClassName = "relative group/item break-inside-avoid",
  deleteButtonClassName = "absolute right-0 top-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted hover:text-red-500 cursor-pointer",
  deleteIconClassName = "h-3.5 w-3.5",
  className = "absolute left-[-20px] top-0 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 transition-opacity cursor-grab touch-none",
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
    <div ref={setNodeRef} style={style} className={containerClassName} data-item-id={id}>
      <button
        type="button"
        className={className}
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
          title="Delete item"
          onClick={() => onDeleteItem(id)}
        >
          <Trash2 className={deleteIconClassName} />
        </button>
      )}
      {children}
    </div>
  )
}

export function AddItemButton({ onClick, isLast = false }: Readonly<{ onClick: () => void; isLast?: boolean }>) {
  return (
    <div className="relative h-0 overflow-visible">
      <button
        type="button"
        className={`absolute left-1/2 -translate-x-1/2 z-20 flex items-center justify-center p-1 cursor-pointer group/btn${isLast ? "-translate-y-1" : " -translate-y-1/2 invisible group-hover/section:visible opacity-0 group-hover/section:opacity-100 transition-opacity"}`}
        aria-label="Add item here"
        title="Add item"
        onClick={onClick}
      >
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-background border border-border text-muted-foreground group-hover/btn:text-foreground group-hover/btn:border-foreground transition-colors shadow-sm">
          <Plus className="h-3 w-3" />
        </div>
      </button>
    </div>
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
    onReorderItems(arrayMove([...items], oldIndex, newIndex) as unknown as ResumeItemDto[])
  }
}

interface SectionDndWrapperProps {
  readonly items: readonly { id: string }[]
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
  readonly children: React.ReactNode
  readonly strategy?: "vertical" | "rect"
}

interface EditableTitleFieldProps {
  readonly itemId: string
  readonly field: string
  readonly value: string | null
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly placeholder?: string
}

export function EditableTitleField({ itemId, field, value, onFieldChange, placeholder }: EditableTitleFieldProps) {
  // In read-only mode: skip null values entirely
  if (!onFieldChange && value == null) return null
  return (
    <p className="font-semibold text-sm">
      {onFieldChange ? (
        <EditableField itemId={itemId} field={field} value={value} onFieldChange={onFieldChange} placeholder={placeholder} />
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
  readonly placeholder?: string
}

export function EditableDescriptionField({ itemId, value, onFieldChange, placeholder }: EditableDescriptionFieldProps) {
  // In read-only mode: skip null values entirely
  if (!onFieldChange && value == null) return null
  return (
    <p className="text-sm mt-1">
      {onFieldChange ? (
        <EditableField itemId={itemId} field="description" value={value} onFieldChange={onFieldChange} placeholder={placeholder} />
      ) : (
        <span>{value}</span>
      )}
    </p>
  )
}

export function SectionDndWrapper({ items, onReorderItems, children, strategy = "vertical" }: SectionDndWrapperProps) {
  const handleDragEnd = createHandleDragEnd(items, onReorderItems)
  const sortingStrategy = strategy === "rect" ? rectSortingStrategy : verticalListSortingStrategy

  if (onReorderItems) {
    return (
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={sortingStrategy}>
          {children}
        </SortableContext>
      </DndContext>
    )
  }

  return <>{children}</>
}
