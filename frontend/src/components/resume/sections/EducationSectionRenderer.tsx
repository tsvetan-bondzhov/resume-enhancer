import React from "react"
import { formatYear } from "@/lib/dateUtils"
import type { EducationItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper, EditableField, EditableDateRange } from "./sectionRendererShared"

interface EducationSectionRendererProps {
  readonly items: readonly EducationItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

export default function EducationSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: EducationSectionRendererProps) {
  const content = (
    <div className="flex flex-col group/section" style={{ gap: "var(--item-spacing, 12px)" }}>
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} isLast={items.length === 0} />}
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <SortableItemWrapper id={item.id} itemIndex={index} onDeleteItem={onDeleteItem}>
            <div>
              {(item.degree != null || item.fieldOfStudy != null || onFieldChange) && (
                <p className="font-semibold text-sm">
                  {onFieldChange ? (
                    <>
                      <EditableField itemId={item.id} field="degree" value={item.degree} onFieldChange={onFieldChange} placeholder="Click to add degree" />
                      {(item.degree || item.fieldOfStudy) && " — "}
                      <EditableField itemId={item.id} field="fieldOfStudy" value={item.fieldOfStudy} onFieldChange={onFieldChange} placeholder="Click to add field of study" />
                    </>
                  ) : (
                    <span>
                      {[item.degree, item.fieldOfStudy].filter(Boolean).join(" — ")}
                    </span>
                  )}
                </p>
              )}
              {(item.institution != null || item.startDate != null || item.endDate != null || onFieldChange) && (
                <p className="text-muted-foreground italic text-sm">
                  {onFieldChange ? (
                    <EditableField itemId={item.id} field="institution" value={item.institution} onFieldChange={onFieldChange} placeholder="Click to add institution" />
                  ) : (
                    <span>{item.institution}</span>
                  )}
                  {item.institution && (item.startDate || item.endDate) && " · "}
                  {onFieldChange ? (
                    <EditableDateRange
                      itemId={item.id}
                      startDate={item.startDate}
                      endDate={item.endDate}
                      onFieldChange={onFieldChange}
                    />
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
          {onAddItem && <AddItemButton onClick={() => onAddItem(index + 1)} isLast={index === items.length - 1} />}
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
