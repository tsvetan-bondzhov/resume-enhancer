import { Skeleton } from "@/components/ui/skeleton"
import type { ResumeDocumentDto } from "@/types/api"

interface ResumeCanvasProps {
  document: ResumeDocumentDto | null
  isLoading?: boolean
  state?: "idle" | "streaming" | "diff" | "print-preview"
}

export default function ResumeCanvas({
  document,
  isLoading = false,
  state = "idle",
}: ResumeCanvasProps) {
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
          className="bg-white shadow-lg w-full max-w-[794px] p-8 min-h-[200px]"
        />
      ) : (
        <article
          id="resume-canvas"
          aria-label="Resume preview"
          className="bg-white shadow-lg w-full max-w-[794px] p-8"
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

          {(document.sections ?? [])
            .filter((section) => section.visible)
            .map((section) => (
              <section
                key={section.id}
                aria-labelledby={`section-title-${section.id}`}
                className="mb-6"
              >
                <h2
                  id={`section-title-${section.id}`}
                  className="text-base font-semibold border-b border-zinc-200 pb-1 mb-2 uppercase tracking-wide"
                >
                  {section.title}
                </h2>
                <ul className="space-y-1 text-sm list-none p-0">
                  {section.items.map((item) => (
                    <li key={item.id}>
                      {Object.values(item.fields)
                        .filter(Boolean)
                        .join(" · ")}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </article>
      )}
    </div>
  )
}
