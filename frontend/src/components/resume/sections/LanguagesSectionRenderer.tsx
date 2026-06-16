import React from "react"
import type { LanguageItemDto, ResumeItemDto } from "@/types/api"
import { SortableItemWrapper, AddItemButton, SectionDndWrapper, EditableField } from "./sectionRendererShared"

interface LanguagesSectionRendererProps {
  readonly items: readonly LanguageItemDto[]
  readonly onFieldChange?: (itemId: string, field: string, value: string) => void
  readonly onAddItem?: (position: number) => void
  readonly onDeleteItem?: (itemId: string) => void
  readonly onReorderItems?: (newItems: ResumeItemDto[]) => void
}

export default function LanguagesSectionRenderer({
  items,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: LanguagesSectionRendererProps) {
  const content = (
    <div className="space-y-1 group/section">
      {onAddItem && <AddItemButton onClick={() => onAddItem(0)} />}
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <SortableItemWrapper id={item.id} onDeleteItem={onDeleteItem}>
            <div className="flex items-center gap-2 text-sm">
              {(item.language != null || onFieldChange) && (
                <>
                  {onFieldChange ? (
                    <EditableField
                      itemId={item.id}
                      field="language"
                      value={item.language}
                      onFieldChange={onFieldChange}
                      placeholder="Click to add language"
                      ariaLabel="Edit language"
                    />
                  ) : (
                    <span>{item.language}</span>
                  )}
                </>
              )}
              {(item.proficiency != null || onFieldChange) && (
                <span className="inline-block bg-zinc-100 text-zinc-600 text-xs px-2 py-0.5 rounded-full">
                  {onFieldChange ? (
                    <EditableField
                      itemId={item.id}
                      field="proficiency"
                      value={item.proficiency}
                      onFieldChange={onFieldChange}
                      placeholder="Proficiency"
                      ariaLabel="Edit proficiency"
                    />
                  ) : (
                    item.proficiency
                  )}
                </span>
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
