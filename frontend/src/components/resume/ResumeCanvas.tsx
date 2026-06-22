import { useState, useEffect, useCallback } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/apiClient"
import { getOrderedSections } from "@/lib/templateUtils"
import ResumeSection from "@/components/resume/ResumeSection"
import type { ResumeDocumentDto, ResumeItemDto, ResumeSectionType, TemplateCssVariables, TemplateDto } from "@/types/api"
import { usePageLayout, type PageSectionSlice } from "./usePageLayout"
export { PAGE_HEIGHT_PX } from "./resumeConstants"
import { PAGE_HEIGHT_PX } from "./resumeConstants"

interface ResumeCanvasProps {
  readonly document: ResumeDocumentDto | null
  readonly templateId: string | null
  readonly isLoading?: boolean
  readonly state?: "idle" | "streaming" | "diff" | "print-preview"
  readonly onTitleChange?: (sectionId: string, title: string) => void
  readonly onFieldChange?: (sectionId: string, itemId: string, field: string, value: string) => void
  readonly onAddItem?: (sectionType: ResumeSectionType, position: number) => void
  readonly onDeleteItem?: (sectionType: ResumeSectionType, itemId: string) => void
  readonly onReorderItems?: (sectionType: ResumeSectionType, newItems: ResumeItemDto[]) => void
}

export default function ResumeCanvas({
  document,
  templateId,
  isLoading = false,
  state = "idle",
  onTitleChange,
  onFieldChange,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: ResumeCanvasProps) {
  const [template, setTemplate] = useState<TemplateDto | null>(null)

  useEffect(() => {
    let cancelled = false
    if (templateId) {
      apiClient
        .get<TemplateDto>(`/api/v1/resume-templates/${templateId}`)
        .then((data) => {
          if (!cancelled) setTemplate(data)
        })
        .catch(() => {
          if (!cancelled) setTemplate(null)
        })
    } else {
      // ESLint react-hooks/set-state-in-effect forbids synchronous setState in effect body.
      // Promise.resolve().then() defers to microtask queue — satisfies the rule while
      // still resetting template when templateId becomes null (AC5/AC6).
      void Promise.resolve().then(() => {
        if (!cancelled) setTemplate(null)
      })
    }
    return () => {
      cancelled = true
    }
  }, [templateId])

  // CSS variable injection — empty object when no template (AC5/AC6: defaults apply via Tailwind)
  const cssVars: TemplateCssVariables = template?.templateDefinition?.cssVariables ?? {}
  const layoutType = template?.templateDefinition?.layoutType

  const baseStyle: React.CSSProperties = Object.fromEntries(
    Object.entries(cssVars).filter(([, v]) => v !== undefined)
  )

  const rootStyle: React.CSSProperties = {
    ...baseStyle,
    color: "var(--text-color, #111827)",
  }

  // Compute ordered sections once — used by both the two-column and single-column render paths.
  const orderedSections = document ? getOrderedSections(document.sections ?? [], template) : []

  // Two-column: sets of section IDs belonging to each column (AC1/AC2/AC4)
  const leftColumnDef = template?.templateDefinition?.layout?.columns?.left ?? []
  const rightColumnDef = template?.templateDefinition?.layout?.columns?.right ?? []
  const leftColumnIds = new Set(leftColumnDef)
  const rightColumnIds = new Set(rightColumnDef)

  const isTwoColumn =
    document !== null &&
    layoutType === "two-column" &&
    leftColumnDef.length > 0 &&
    rightColumnDef.length > 0

  // Resolve page margins from CSS variables (px values) falling back to p-8 (32px) padding.
  const marginTop = Number.parseFloat(cssVars["--page-margin-top"] ?? "") || 32
  const marginBottom = Number.parseFloat(cssVars["--page-margin-bottom"] ?? "") || 32

  const { pageLayout, pageCount, measureRef } = usePageLayout(
    document ? orderedSections : [],
    marginTop,
    marginBottom,
  )

  // Memoised render helper — renders resume section content for both the hidden
  // measurement container (no slices → all sections) and each visible page article
  // (slices → only the sections/items assigned to that page).
  const renderSections = useCallback(
    (pageSlices?: PageSectionSlice[]): React.ReactNode => {
      if (document === null) return null

      const sliceMap = pageSlices
        ? new Map(pageSlices.map((s) => [s.sectionType, s]))
        : null

      // When slicing, only render sections present on this page — rendering every
      // section on every page would duplicate content across pages.
      const sectionsForRender = sliceMap
        ? orderedSections.filter((s) => sliceMap.has(s.sectionType))
        : orderedSections

      const renderSection = (section: (typeof orderedSections)[number]) => {
        const slice = sliceMap?.get(section.sectionType)
        return (
          <ResumeSection
            key={section.sectionType}
            section={section}
            onTitleChange={(title) => onTitleChange?.(section.sectionType, title)}
            onFieldChange={
              onFieldChange
                ? (itemId, field, value) => onFieldChange(section.sectionType, itemId, field, value)
                : undefined
            }
            onAddItem={onAddItem ? (position) => onAddItem(section.sectionType, position) : undefined}
            onDeleteItem={onDeleteItem ? (itemId) => onDeleteItem(section.sectionType, itemId) : undefined}
            onReorderItems={onReorderItems ? (newItems) => onReorderItems(section.sectionType, newItems) : undefined}
            visibleItemIds={slice?.visibleItemIds}
            showTitle={slice ? slice.showTitle : true}
          />
        )
      }

      if (isTwoColumn) {
        const leftSections = sectionsForRender.filter((s) => leftColumnIds.has(s.sectionType))
        const rightSections = sectionsForRender.filter((s) => rightColumnIds.has(s.sectionType))

        return (
          <div className="flex gap-6">
            <div className="flex flex-col gap-4 basis-1/3">
              {leftSections.map(renderSection)}
            </div>
            <div className="flex flex-col gap-4 flex-1">
              {rightSections.map(renderSection)}
            </div>
          </div>
        )
      }

      // Single-column, modern-accent, or two-column graceful degradation when column arrays are empty.
      return sectionsForRender.map(renderSection)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [document, template, onTitleChange, onFieldChange, onAddItem, onDeleteItem, onReorderItems],
  )

  let canvasContent: React.ReactNode

  if (isLoading) {
    canvasContent = (
      <div
        id="resume-canvas"
        aria-label="Resume preview loading"
        className="bg-white shadow-lg w-full max-w-[794px] p-8 space-y-6"
      >
        <Skeleton className="h-6 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
        <div className="space-y-2 pt-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="space-y-2 pt-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    )
  } else if (document === null) {
    canvasContent = (
      <article
        id="resume-canvas"
        aria-label="Resume preview"
        style={rootStyle}
        className="bg-white shadow-lg w-full max-w-[794px] p-8 min-h-[200px]"
      />
    )
  } else {
    canvasContent = (
      <>
        {/* Hidden measurement container — off-screen, aria-hidden, full A4 width */}
        <div
          ref={measureRef}
          style={{ position: "absolute", left: "-9999px", visibility: "hidden", width: "794px", ...rootStyle }}
          aria-hidden="true"
          className="p-8"
        >
          {/* ARIA live region stub for streaming — used in Story 4.3 */}
          <div
            role="status"
            aria-live="polite"
            aria-label="AI is updating your resume"
            className="sr-only"
          >
            {state === "streaming" ? "AI is updating your resume" : ""}
          </div>

          {/* modern-accent: accent header band — decorative only */}
          {layoutType === "modern-accent" && (
            <div aria-hidden="true" className="bg-[var(--accent-color)] p-4 mb-6" />
          )}

          {renderSections()}
        </div>

        {/* Visible page stack */}
        <div id="resume-canvas" tabIndex={-1} className="flex flex-col items-center gap-4 w-full">
          {Array.from({ length: pageCount }, (_, i) => {
            const pageSlices = pageLayout?.[i]

            return (
              <article
                key={i}
                aria-label={`Resume page ${i + 1}`}
                style={{ ...rootStyle, height: PAGE_HEIGHT_PX, overflow: "hidden", position: "relative" }}
                className="bg-white shadow-lg w-[794px] max-w-full"
              >
                <div style={{ paddingTop: marginTop, paddingBottom: marginBottom, paddingLeft: 32, paddingRight: 32 }}>
                  {/* ARIA live region stub — only on page 1 to avoid duplication */}
                  {i === 0 && (
                    <div
                      role="status"
                      aria-live="polite"
                      aria-label="AI is updating your resume"
                      className="sr-only"
                    >
                      {state === "streaming" ? "AI is updating your resume" : ""}
                    </div>
                  )}

                  {/* modern-accent: accent header band — only on page 1 */}
                  {i === 0 && layoutType === "modern-accent" && (
                    <div aria-hidden="true" className="bg-[var(--accent-color)] p-4 mb-6" />
                  )}

                  {pageSlices
                    ? renderSections(pageSlices)
                    : renderSections()}
                </div>
              </article>
            )
          })}
        </div>
      </>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-200 py-8 px-4 flex flex-col items-center">
      {canvasContent}
    </div>
  )
}
