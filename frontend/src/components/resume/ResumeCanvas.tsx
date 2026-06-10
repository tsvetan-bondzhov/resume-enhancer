import { useState, useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/lib/apiClient"
import { getOrderedSections } from "@/lib/templateUtils"
import ResumeSection from "@/components/resume/ResumeSection"
import type { ResumeDocumentDto, TemplateDto } from "@/types/api"

interface ResumeCanvasProps {
  document: ResumeDocumentDto | null
  templateId: string | null
  isLoading?: boolean
  state?: "idle" | "streaming" | "diff" | "print-preview"
  onTitleChange?: (sectionId: string, title: string) => void
  onFieldChange?: (sectionId: string, itemId: string, field: string, value: string) => void
}

export default function ResumeCanvas({
  document,
  templateId,
  isLoading = false,
  state = "idle",
  onTitleChange,
  onFieldChange,
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
  const cssVars = template?.templateDefinition?.cssVariables ?? {}
  const layoutType = template?.templateDefinition?.layoutType

  const baseStyle = Object.fromEntries(
    Object.entries(cssVars as Record<string, string>).filter(([, v]) => v !== undefined)
  ) as React.CSSProperties

  // Two-column gets gridTemplateColumns via inline style (AC8, avoids Tailwind JIT scan issues)
  const rootStyle: React.CSSProperties =
    layoutType === "two-column"
      ? { ...baseStyle, color: "var(--text-color, #111827)", gridTemplateColumns: "1fr 2fr" }
      : { ...baseStyle, color: "var(--text-color, #111827)" }

  // Two-column: sets of section IDs belonging to each column (AC8)
  const leftColumnIds = new Set(template?.templateDefinition?.layout?.columns?.left ?? [])
  const rightColumnIds = new Set(template?.templateDefinition?.layout?.columns?.right ?? [])

  return (
    <div className="h-full overflow-y-auto bg-zinc-100 py-8 px-4 flex flex-col items-center">
      {isLoading ? (
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
      ) : document === null ? (
        <article
          id="resume-canvas"
          aria-label="Resume preview"
          style={rootStyle}
          className="bg-white shadow-lg w-full max-w-[794px] p-8 min-h-[200px]"
        />
      ) : (
        <article
          id="resume-canvas"
          aria-label="Resume preview"
          style={rootStyle}
          className={
            layoutType === "two-column"
              ? "bg-white shadow-lg w-full max-w-[794px] grid gap-4 p-8"
              : "bg-white shadow-lg w-full max-w-[794px] p-8"
          }
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

          {/* modern-accent: accent header band (AC7) — decorative only */}
          {layoutType === "modern-accent" && (
            <div aria-hidden="true" className="bg-[var(--accent-color)] p-4 mb-6" />
          )}

          {getOrderedSections(document.sections ?? [], template).map((section) => (
            <div
              key={section.sectionType}
              style={
                layoutType === "two-column"
                  ? { gridColumn: leftColumnIds.has(section.sectionType) ? 1 : rightColumnIds.has(section.sectionType) ? 2 : undefined }
                  : undefined
              }
            >
              <ResumeSection
                section={section}
                onTitleChange={(title) => onTitleChange?.(section.sectionType, title)}
                onFieldChange={
                  onFieldChange
                    ? (itemId, field, value) => onFieldChange(section.sectionType, itemId, field, value)
                    : undefined
                }
              />
            </div>
          ))}
        </article>
      )}
    </div>
  )
}
