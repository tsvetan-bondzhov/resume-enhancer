import React from "react"
import type { WorkExperienceItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper, EditableField, EditableTitleField, EditableDescriptionField, DateRangeContent } from "./sectionRendererShared"

interface WorkExperienceSectionRendererProps {
  readonly items: readonly WorkExperienceItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

export default function WorkExperienceSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: WorkExperienceSectionRendererProps) {
  const content = (
    <div className="space-y-3 group/section">
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} />}
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <SortableItemWrapper id={item.id} onDeleteItem={onDeleteItem}>
            <div>
              <EditableTitleField itemId={item.id} field="jobTitle" value={item.jobTitle} onFieldChange={onFieldChange} />
              {(item.company != null || item.startDate != null || item.endDate != null || item.isCurrent) && (
                <p className="text-muted-foreground italic text-sm">
                  {onFieldChange ? (
                    <EditableField itemId={item.id} field="company" value={item.company} onFieldChange={onFieldChange} />
                  ) : (
                    <span>{item.company}</span>
                  )}
                  {item.company && (item.startDate || item.endDate || item.isCurrent) && " · "}
                  <DateRangeContent
                    itemId={item.id}
                    startDate={item.startDate}
                    endDate={item.endDate}
                    isCurrent={item.isCurrent}
                    onFieldChange={onFieldChange}
                  />
                </p>
              )}
              <EditableDescriptionField itemId={item.id} value={item.description} onFieldChange={onFieldChange} />
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
