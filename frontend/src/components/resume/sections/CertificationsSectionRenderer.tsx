import React from "react"
import type { CertificationItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper, EditableField } from "./sectionRendererShared"
import {parseDateInput, toEditableFullDate} from "@/lib/dateUtils.ts";

interface CertificationsSectionRendererProps {
  readonly items: readonly CertificationItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

export default function CertificationsSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: CertificationsSectionRendererProps) {
  const handleDateFieldChange = (id: string, field: string, raw: string) => {
    if (!onFieldChange) return
    const parsed = parseDateInput(raw)
    onFieldChange(id, field, parsed ?? "")
  }

  const content = (
    <div className="flex flex-col group/section" style={{ gap: "var(--item-spacing, 8px)" }}>
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} isLast={items.length === 0} />}
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <SortableItemWrapper id={item.id} itemIndex={index} onDeleteItem={onDeleteItem}>
            <div className="text-sm">
              {(item.name != null || onFieldChange) && (
                <p className="font-medium">
                  {onFieldChange ? (
                    <EditableField itemId={item.id} field="name" value={item.name} onFieldChange={onFieldChange} placeholder="Click to add certification name" />
                  ) : (
                    <span>{item.name}</span>
                  )}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {(item.issuer != null || onFieldChange) && (
                  <>
                    {onFieldChange ? (
                      <EditableField itemId={item.id} field="issuer" value={item.issuer} onFieldChange={onFieldChange} placeholder="Click to add issuer" />
                    ) : (
                      <span>{item.issuer}</span>
                    )}
                    {" · "}
                  </>
                )}
                {onFieldChange ? (
                  <EditableField itemId={item.id} field="issueDate" value={toEditableFullDate(item.issueDate)} onFieldChange={handleDateFieldChange} placeholder="Issue date" />
                ) : (
                  item.issueDate != null && <span>{item.issueDate}</span>
                )}
                {(item.expirationDate != null || onFieldChange) && " — "}
                {onFieldChange ? (
                  <EditableField itemId={item.id} field="expirationDate" value={toEditableFullDate(item.expirationDate)} onFieldChange={handleDateFieldChange} placeholder="Expiration date" />
                ) : (
                  item.expirationDate != null && <span>{item.expirationDate}</span>
                )}
              </p>
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
