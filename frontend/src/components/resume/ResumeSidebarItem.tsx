import { ExternalLink, Download, Copy, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import type { ResumeDto } from "@/types/api"

interface ResumeSidebarItemProps {
  resume: ResumeDto
  isActive: boolean
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
  isDuplicating?: boolean
}

export default function ResumeSidebarItem({
  resume,
  isActive,
  onOpen,
  onDuplicate,
  onDelete,
  isDuplicating = false,
}: ResumeSidebarItemProps) {
  return (
    <div
      className={[
        "group relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
        isActive
          ? "bg-blue-50 text-blue-900"
          : "hover:bg-muted",
      ].join(" ")}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`${resume.name}${isActive ? " (active)" : ""}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen() }}
    >
      {/* Resume info */}
      <div className="flex-1 min-w-0">
        <p className={[
          "text-xs font-medium truncate",
          isActive ? "text-blue-900" : "",
        ].join(" ")}>
          {resume.name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {resume.isTailored ? (
            <Badge className="text-[10px] px-1 py-0 h-4">Tailored</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Base</Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(resume.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Hover action icons — visible on hover/focus-within (UX-DR9) */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          aria-label={`Open ${resume.name}`}
          className="p-1 rounded hover:bg-muted"
        >
          <ExternalLink className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toast("Export coming soon")
          }}
          aria-label={`Export ${resume.name}`}
          className="p-1 rounded hover:bg-muted"
        >
          <Download className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate() }}
          aria-label={`Duplicate ${resume.name}`}
          className="p-1 rounded hover:bg-muted"
          disabled={isDuplicating}
        >
          {isDuplicating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          aria-label={`Delete ${resume.name}`}
          className="p-1 rounded hover:bg-muted hover:text-red-500"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
