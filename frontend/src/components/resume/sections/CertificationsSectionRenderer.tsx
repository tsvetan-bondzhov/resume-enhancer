import React from "react"
import type { CertificationItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper, EditableField } from "./sectionRendererShared"

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
                    <EditableField itemId={item.id} field="name" value={item.name} onFieldChange={onFieldChange} />
                  ) : (
                    <span>{item.name}</span>
                  )}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {item.issuer != null && (
                  <>
                    {onFieldChange ? (
                      <EditableField itemId={item.id} field="issuer" value={item.issuer} onFieldChange={onFieldChange} />
                    ) : (
                      <span>{item.issuer}</span>
                    )}
                    {" · "}
                  </>
                )}
                {onFieldChange ? (
                  <EditableField itemId={item.id} field="issueDate" value={item.issueDate} onFieldChange={onFieldChange} />
                ) : (
                  item.issueDate != null && <span>{item.issueDate}</span>
                )}
                {(item.expirationDate != null || onFieldChange) && " — "}
                {onFieldChange ? (
                  <EditableField itemId={item.id} field="expirationDate" value={item.expirationDate} onFieldChange={onFieldChange} />
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

  return (
    <SectionDndWrapper items={items} onReorderItems={onReorderItems}>
      {content}
    </SectionDndWrapper>
  )
}
