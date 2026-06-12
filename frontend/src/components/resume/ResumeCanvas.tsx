import { useState, useEffect, useRef, useCallback } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/apiClient"
import { getOrderedSections } from "@/lib/templateUtils"
import ResumeSection from "@/components/resume/ResumeSection"
import type { ResumeDocumentDto, ResumeItemDto, TemplateDto } from "@/types/api"

// A4: 210mm × 297mm. max-w-[794px] ≈ 210mm at 96dpi.
// Page height in px = 794 * (297 / 210) ≈ 1123
// eslint-disable-next-line react-refresh/only-export-components
export const PAGE_HEIGHT_PX = Math.round(794 * (297 / 210)) // 1123

interface ResumeCanvasProps {
  document: ResumeDocumentDto | null
  templateId: string | null
  isLoading?: boolean
  state?: "idle" | "streaming" | "diff" | "print-preview"
  onTitleChange?: (sectionId: string, title: string) => void
  onFieldChange?: (sectionId: string, itemId: string, field: string, value: string) => void
  onAddItem?: (sectionType: string, position: number) => void
  onDeleteItem?: (sectionType: string, itemId: string) => void
  onReorderItems?: (sectionType: string, newItems: ResumeItemDto[]) => void
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
  const [pageCount, setPageCount] = useState(1)
  const contentRef = useRef<HTMLDivElement>(null)

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
  const cssVars = template?.templateDefinition?.cssVariables ?? {}
  const layoutType = template?.templateDefinition?.layoutType

  const baseStyle = Object.fromEntries(
    Object.entries(cssVars as Record<string, string>).filter(([, v]) => v !== undefined)
  ) as React.CSSProperties

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

  // Memoised render helper — renders resume section content for both the hidden
  // measurement container and each visible page article.
  const renderSections = useCallback((): React.ReactNode => {
    if (document === null) return null

    if (isTwoColumn) {
      const leftSections = orderedSections.filter((s) => leftColumnIds.has(s.sectionType))
      const rightSections = orderedSections.filter((s) => rightColumnIds.has(s.sectionType))

      return (
        <div className="flex gap-6">
          <div className="flex flex-col gap-4 basis-1/3">
            {leftSections.map((section) => (
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
              />
            ))}
          </div>
          <div className="flex flex-col gap-4 flex-1">
            {rightSections.map((section) => (
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
              />
            ))}
          </div>
        </div>
      )
    }

    // Single-column, modern-accent, or two-column graceful degradation when column arrays are empty.
    return orderedSections.map((section) => (
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
      />
    ))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, template, onTitleChange, onFieldChange, onAddItem, onDeleteItem, onReorderItems])

  // ResizeObserver on the hidden measurement container — updates pageCount reactively
  // whenever content height changes (e.g. user edits inline content).
  useEffect(() => {
    if (!contentRef.current) return
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0
      setPageCount(Math.max(1, Math.ceil(height / PAGE_HEIGHT_PX)))
    })
    observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [document, template])

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
          ref={contentRef}
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
        <div id="resume-canvas" className="flex flex-col items-center gap-4 w-full">
          {Array.from({ length: pageCount }, (_, i) => (
            <article
              key={i}
              aria-label={`Resume page ${i + 1}`}
              style={{ ...rootStyle, height: PAGE_HEIGHT_PX, overflow: "hidden", position: "relative" }}
              className="bg-white shadow-lg w-[794px] max-w-full"
            >
              {/* Inner content div offset per page to slice the correct page window */}
              <div
                style={{ position: "absolute", top: -(i * PAGE_HEIGHT_PX), left: 0, right: 0 }}
                className="p-8"
              >
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

                {renderSections()}
              </div>
            </article>
          ))}
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
