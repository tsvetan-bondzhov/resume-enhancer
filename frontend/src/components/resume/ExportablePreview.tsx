import { useEffect, useRef, useState } from "react"
import { apiClient } from "@/lib/apiClient"
import ResumeCanvas from "@/components/resume/ResumeCanvas"
import type { ResumeDocumentDto, ResumeDto } from "@/types/api"

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
 * Mounts an off-screen, read-only ResumeCanvas and, once pagination has settled,
 * hands the container element to `onReady` so a visual PDF can be captured from the
 * rendered A4 pages. No edit handlers are passed, so the canvas renders plain spans.
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
  const [ready, setReady] = useState(providedDocument != null)

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
        setReady(true)
      })
      .catch((err) => {
        if (!cancelled) onError(err)
      })
    return () => {
      cancelled = true
    }
  }, [resumeId, providedDocument, onError])

  // Once the document is available, poll with requestAnimationFrame until the page
  // count is > 0 and stable across two consecutive frames, then hand off to onReady.
  useEffect(() => {
    if (!ready) return
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
  }, [ready, doc, onReady, onError])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{ position: "fixed", left: "-10000px", top: 0, width: "794px" }}
    >
      <ResumeCanvas document={doc} templateId={templateId} state="print-preview" />
    </div>
  )
}
