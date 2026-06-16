import React from "react"
import { formatDateRange } from "@/lib/dateUtils"
import type { VolunteeringItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper, EditableField, EditableDateRange, EditableTitleField, EditableDescriptionField } from "./sectionRendererShared"

interface VolunteeringSectionRendererProps {
  readonly items: readonly VolunteeringItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

export default function VolunteeringSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: VolunteeringSectionRendererProps) {
  const content = (
    <div className="space-y-3 group/section">
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} />}
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <SortableItemWrapper id={item.id} onDeleteItem={onDeleteItem}>
            <div>
              <EditableTitleField itemId={item.id} field="role" value={item.role} onFieldChange={onFieldChange} placeholder="Click to add role" />
              {(item.organization != null || item.startDate != null || item.endDate != null || item.isCurrent || onFieldChange) && (
                <p className="text-muted-foreground italic text-sm">
                  {onFieldChange ? (
                    <EditableField itemId={item.id} field="organization" value={item.organization} onFieldChange={onFieldChange} placeholder="Click to add organization" />
                  ) : (
                    <span>{item.organization}</span>
                  )}
                  {item.organization && (item.startDate || item.endDate || item.isCurrent) && " · "}
                  {onFieldChange ? (
                    <EditableDateRange
                      itemId={item.id}
                      startDate={item.startDate}
                      endDate={item.endDate}
                      isCurrent={item.isCurrent}
                      onFieldChange={onFieldChange}
                    />
                  ) : (
                    <span>{formatDateRange(item.startDate, item.endDate, item.isCurrent)}</span>
                  )}
                </p>
              )}
              <EditableDescriptionField itemId={item.id} value={item.description} onFieldChange={onFieldChange} placeholder="Click to add description" />
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
