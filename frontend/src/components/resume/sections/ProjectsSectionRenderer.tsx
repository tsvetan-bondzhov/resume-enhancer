import React from "react"
import { ExternalLink } from "lucide-react"
import type { ProjectItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper, EditableField, EditableTitleField, EditableDescriptionField, DateRangeDisplay } from "./sectionRendererShared"

interface ProjectsSectionRendererProps {
  readonly items: readonly ProjectItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

export default function ProjectsSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: ProjectsSectionRendererProps) {
  const content = (
    <div className="space-y-3 group/section">
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} />}
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <SortableItemWrapper id={item.id} onDeleteItem={onDeleteItem}>
            <div>
              <EditableTitleField itemId={item.id} field="name" value={item.name} onFieldChange={onFieldChange} />
              {(item.startDate != null || item.endDate != null || item.isCurrent) && (
                <DateRangeDisplay
                  itemId={item.id}
                  startDate={item.startDate}
                  endDate={item.endDate}
                  isCurrent={item.isCurrent}
                  onFieldChange={onFieldChange}
                />
              )}
              {item.technologies != null && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {onFieldChange ? (
                    <EditableField
                      itemId={item.id}
                      field="technologies"
                      value={item.technologies}
                      onFieldChange={onFieldChange}
                      className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block text-xs text-muted-foreground"
                    />
                  ) : (
                    item.technologies.split(",").map((tech) => tech.trim()).filter(Boolean).map((tech) => (
                      <span
                        key={tech}
                        className="inline-block bg-zinc-100 text-zinc-700 text-xs px-2 py-0.5 rounded-sm"
                      >
                        {tech}
                      </span>
                    ))
                  )}
                </div>
              )}
              <EditableDescriptionField itemId={item.id} value={item.description} onFieldChange={onFieldChange} />
              {item.link != null && (
                <div className="mt-1">
                  {onFieldChange ? (
                    <EditableField
                      itemId={item.id}
                      field="link"
                      value={item.link}
                      onFieldChange={onFieldChange}
                      className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block text-xs text-primary"
                    />
                  ) : (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {item.link}
                    </a>
                  )}
                </div>
              )}
            </div>
          </SortableItemWrapper>
          {onAddItem && <AddItemButton onClick={() => onAddItem(index + 1)} />}
        </React.Fragment>
      ))}
    </div>
  )

  return (
    <SectionDndWrapper items={items} onReorderItems={onReorderItems}>
      {content}
    </SectionDndWrapper>
  )
}
