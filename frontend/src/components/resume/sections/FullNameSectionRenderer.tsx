import React from "react"
import type { FullNameItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper, EditableField } from "./sectionRendererShared"

interface FullNameSectionRendererProps {
  readonly items: readonly FullNameItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

export default function FullNameSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: FullNameSectionRendererProps) {
  const content = (
    <div className="group/section">
      {items.map((item, index) => {
        // In read-only mode skip empty items; in editor mode always render so user can click to add
        if (item.firstName == null && item.lastName == null && !onFieldChange) return null
        const fullName = [item.firstName, item.lastName].filter(Boolean).join(" ")
        return (
          <React.Fragment key={item.id}>
            <SortableItemWrapper id={item.id} itemIndex={index} onDeleteItem={onDeleteItem}>
              {onFieldChange ? (
                <div className="flex flex-wrap gap-2 text-xl font-bold">
                  <EditableField
                    itemId={item.id}
                    field="firstName"
                    value={item.firstName}
                    onFieldChange={onFieldChange}
                    placeholder="First name"
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    ariaLabel="Edit firstName"
                  />
                  <EditableField
                    itemId={item.id}
                    field="lastName"
                    value={item.lastName}
                    onFieldChange={onFieldChange}
                    placeholder="Last name"
                    className="outline-none focus:ring-1 focus:ring-ring focus:ring-offset-1 rounded-sm cursor-text inline-block"
                    ariaLabel="Edit lastName"
                  />
                </div>
              ) : (
                <p className="text-xl font-bold">{fullName}</p>
              )}
            </SortableItemWrapper>
          </React.Fragment>
        )
      })}
      {onAddItem && <AddItemButton onClick={() => onAddItem(items.length)} isLast />}
    </div>
  )

  return (
    <SectionDndWrapper items={items} onReorderItems={onReorderItems}>
      {content}
    </SectionDndWrapper>
  )
}
