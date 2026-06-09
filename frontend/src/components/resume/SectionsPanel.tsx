import { useState, useCallback } from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, GripVertical } from "lucide-react"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Checkbox } from "@/components/ui/checkbox"
import { useResumeStore } from "@/stores/useResumeStore"
import type { ResumeSectionDto } from "@/types/api"

interface SectionsPanelProps {
  sections: ResumeSectionDto[]
}

interface SortableSectionRowProps {
  section: ResumeSectionDto
  onToggle: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

function SortableSectionRow({
  section,
  onToggle,
  onMoveUp,
  onMoveDown,
}: SortableSectionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.sectionType })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-muted/50 group"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity touch-none"
        aria-label={`Drag to reorder ${section.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Visibility checkbox */}
      <Checkbox
        checked={section.visible}
        onCheckedChange={() => onToggle(section.sectionType)}
        aria-label={`Show ${section.title} section`}
        id={`section-visible-${section.sectionType}`}
      />

      {/* Section name label */}
      <label
        htmlFor={`section-visible-${section.sectionType}`}
        className="flex-1 text-sm truncate cursor-pointer select-none"
      >
        {section.title}
      </label>

      {/* Keyboard reorder buttons — always in DOM but visually hidden; revealed on focus */}
      <div className="flex flex-col opacity-0 group-focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground p-0.5"
          aria-label={`Move ${section.title} up`}
          onClick={() => onMoveUp(section.sectionType)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault()
              onMoveUp(section.sectionType)
            }
          }}
        >
          ▲
        </button>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground p-0.5"
          aria-label={`Move ${section.title} down`}
          onClick={() => onMoveDown(section.sectionType)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              onMoveDown(section.sectionType)
            }
          }}
        >
          ▼
        </button>
      </div>
    </div>
  )
}

export default function SectionsPanel({ sections }: SectionsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const toggleSectionVisibility = useResumeStore(
    (s) => s.toggleSectionVisibility
  )
  const reorderSections = useResumeStore((s) => s.reorderSections)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = sections.findIndex((s) => s.sectionType === active.id)
      const newIndex = sections.findIndex((s) => s.sectionType === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      reorderSections(arrayMove(sections, oldIndex, newIndex))
    },
    [sections, reorderSections]
  )

  const handleMoveUp = useCallback(
    (id: string) => {
      const idx = sections.findIndex((s) => s.sectionType === id)
      if (idx <= 0) return
      reorderSections(arrayMove(sections, idx, idx - 1))
    },
    [sections, reorderSections]
  )

  const handleMoveDown = useCallback(
    (id: string) => {
      const idx = sections.findIndex((s) => s.sectionType === id)
      if (idx === -1 || idx >= sections.length - 1) return
      reorderSections(arrayMove(sections, idx, idx + 1))
    },
    [sections, reorderSections]
  )

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        aria-label="Toggle sections panel"
      >
        <span>Sections</span>
        <ChevronDown
          className={`size-4 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 py-1">
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.sectionType)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => (
              <SortableSectionRow
                key={section.sectionType}
                section={section}
                onToggle={toggleSectionVisibility}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
              />
            ))}
          </SortableContext>
        </DndContext>
      </CollapsibleContent>
    </Collapsible>
  )
}
