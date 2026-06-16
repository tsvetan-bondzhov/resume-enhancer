import { ExternalLink, Download, Copy, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import type { ResumeDto } from "@/types/api"
import ResumeCanvas from "@/components/resume/ResumeCanvas"

/** Scale factor applied to the full-size ResumeCanvas for the dashboard card preview. */
const PREVIEW_SCALE = 0.3

interface ResumeDashboardCardProps {
  readonly resume: ResumeDto
  readonly onOpen: () => void
  readonly onDuplicate: () => void
  readonly onDelete: () => void
  readonly isDuplicating?: boolean
}

export default function ResumeDashboardCard({
  resume,
  onOpen,
  onDuplicate,
  onDelete,
  isDuplicating = false,
}: ResumeDashboardCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen() }}
    >
      {/* Mini preview area — scaled-down live ResumeCanvas */}
      {/* aria-hidden: preview is decorative — screen readers see the info bar instead */}
      {/* inert: excludes all descendants from tab order and pointer interaction */}
      <div
        aria-hidden="true"
        inert
        className="relative w-full overflow-hidden rounded-t-xl bg-card"
        style={{ height: "200px" }}
      >
        <div
          className="pointer-events-none absolute top-0 left-0 origin-top-left"
          style={{ transform: `scale(${PREVIEW_SCALE})`, width: `${100 / PREVIEW_SCALE}%` }}
        >
          <ResumeCanvas
            document={resume.content}
            templateId={resume.templateId}
            isLoading={false}
          />
        </div>
      </div>

      {/* Info bar */}
      <div className="px-3 py-2 bg-card">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{resume.name}</p>
            <div className="flex items-center gap-2 mt-1">
              {resume.isTailored ? (
                <Badge>Tailored</Badge>
              ) : (
                <Badge variant="outline">Base</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(resume.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Action buttons — visible on hover / focus */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-100 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpen()
              }}
              aria-label="Open resume"
              className="p-1 rounded hover:bg-muted"
            >
              <ExternalLink className="size-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                toast("Export coming soon")
              }}
              aria-label="Export resume"
              className="p-1 rounded hover:bg-muted"
            >
              <Download className="size-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate()
              }}
              aria-label="Duplicate resume"
              className="p-1 rounded hover:bg-muted"
              disabled={isDuplicating}
            >
              {isDuplicating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              aria-label="Delete resume"
              className="p-1 rounded hover:bg-muted hover:text-red-500"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
