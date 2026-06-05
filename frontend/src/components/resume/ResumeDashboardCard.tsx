import { ExternalLink, Download, Copy, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import type { ResumeDto } from "@/types/api"

interface ResumeDashboardCardProps {
  resume: ResumeDto
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
  isDuplicating?: boolean
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
      className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
      onClick={onOpen}
    >
      {/* Mini preview area — A4 aspect ratio placeholder */}
      <div className="aspect-[1/1.414] w-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center rounded-t-xl overflow-hidden">
        <span className="text-xs text-zinc-400 select-none px-4 text-center line-clamp-2">
          {resume.name}
        </span>
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
