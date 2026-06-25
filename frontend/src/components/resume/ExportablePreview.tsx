import { useEffect, useRef, useState } from "react"
import { apiClient } from "@/lib/apiClient"
import ResumeCanvas from "@/components/resume/ResumeCanvas"
import type { ResumeDocumentDto, ResumeDto, TemplateDefinitionDto, TemplateDto } from "@/types/api"

interface ExportablePreviewProps {
  readonly resumeId: string
  /**
   * Already-loaded document + templateId for the open resume. When provided the
   * component renders immediately and skips the network fetch. Omit for sidebar
   * exports of a different resume, which are fetched by id.
   */
  readonly document?: ResumeDocumentDto | null
  readonly templateId?: string | null
  readonly onReady: (container: HTMLElement) => void
  readonly onError: (error: unknown) => void
}

const MAX_FRAMES = 120 // ~2s at 60fps — guard against never settling

/**
 * Mounts an off-screen, read-only ResumeCanvas and, once the template theme is applied,
 * web fonts have loaded, and pagination has settled, hands the container element to
 * `onReady` so a visual PDF can be captured from the rendered A4 pages.
 *
 * The template definition is resolved here (not left to ResumeCanvas's own async fetch)
 * and passed via `templatePreview`, so the off-screen render is themed from first paint.
 * Otherwise the settle loop could hand off a default, unthemed, single-column render
 * before ResumeCanvas's internal template fetch resolves.
 */
export default function ExportablePreview({
  resumeId,
  document: providedDocument,
  templateId: providedTemplateId,
  onReady,
  onError,
}: ExportablePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<ResumeDocumentDto | null>(providedDocument ?? null)
  const [templateId, setTemplateId] = useState<string | null>(providedTemplateId ?? null)
  // Resolved template definition (or null once resolution finished with no theme).
  // `undefined` means "not resolved yet" — gate onReady until it becomes defined-or-null.
  const [templateDefinition, setTemplateDefinition] = useState<TemplateDefinitionDto | null | undefined>(undefined)
  const [docReady, setDocReady] = useState(providedDocument != null)
  // Whether template resolution has completed (success or failure). Distinct from
  // `templateDefinition` because a resume can legitimately have no template.
  const [templateResolved, setTemplateResolved] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)

  // Fetch the resume when no document was supplied (sidebar export of another resume).
  useEffect(() => {
    if (providedDocument != null) return
    let cancelled = false
    apiClient
      .get<ResumeDto>(`/api/v1/resumes/${resumeId}`)
      .then((data) => {
        if (cancelled) return
        setDoc(data.content)
        setTemplateId(data.templateId)
        setDocReady(true)
      })
      .catch((err) => {
        if (!cancelled) onError(err)
      })
    return () => {
      cancelled = true
    }
  }, [resumeId, providedDocument, onError])

  // Resolve the template definition once the templateId is known, so the off-screen
  // render is themed from first paint. On failure, fall back to no preview (still
  // produces a PDF, just unthemed) rather than erroring out.
  useEffect(() => {
    let cancelled = false
    if (!docReady) return
    if (!templateId) {
      setTemplateDefinition(null)
      setTemplateResolved(true)
      return
    }
    apiClient
      .get<TemplateDto>(`/api/v1/resume-templates/${templateId}`)
      .then((data) => {
        if (cancelled) return
        setTemplateDefinition(data.templateDefinition ?? null)
        setTemplateResolved(true)
      })
      .catch(() => {
        if (cancelled) return
        setTemplateDefinition(null)
        setTemplateResolved(true)
      })
    return () => {
      cancelled = true
    }
  }, [docReady, templateId])

  // Wait for web fonts so the captured pages use the template fonts, not fallbacks.
  // Reference the real DOM document explicitly — the `document` prop shadows the global.
  useEffect(() => {
    let cancelled = false
    const fontFaceSet = globalThis.document.fonts
    if (!fontFaceSet) {
      setFontsReady(true)
      return
    }
    fontFaceSet.ready
      .then(() => {
        if (!cancelled) setFontsReady(true)
      })
      .catch(() => {
        if (!cancelled) setFontsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Once the document, template theme, and fonts are all ready, poll with
  // requestAnimationFrame until the page count is > 0 and stable across two
  // consecutive frames, then hand off to onReady.
  useEffect(() => {
    if (!docReady || !templateResolved || !fontsReady) return
    let rafId = 0
    let frames = 0
    let lastCount = -1

    const tick = () => {
      const container = containerRef.current
      if (!container) return
      const count = container.querySelectorAll(
        'article[aria-label^="Resume page"]',
      ).length

      if (count > 0 && count === lastCount) {
        onReady(container)
        return
      }
      lastCount = count

      frames += 1
      if (frames >= MAX_FRAMES) {
        if (count > 0) {
          onReady(container)
        } else {
          onError(new Error("Resume preview did not render in time"))
        }
        return
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [docReady, templateResolved, fontsReady, doc, templateDefinition, onReady, onError])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{ position: "fixed", left: "-10000px", top: 0, width: "794px" }}
    >
      <ResumeCanvas
        document={doc}
        templateId={templateId}
        templatePreview={templateDefinition ?? undefined}
        state="print-preview"
      />
    </div>
  )
}
