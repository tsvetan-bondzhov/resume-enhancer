import { useState } from "react"

type DiffHighlightKind = "addition" | "rewrite" | "deletion"
type DiffHighlightState = "visible" | "faded" | "hidden"

interface DiffHighlightProps {
  readonly kind: DiffHighlightKind
  readonly state: DiffHighlightState
  readonly children: React.ReactNode
  readonly previousValue?: string
  readonly onAccept: () => void
  readonly onReject: () => void
}

export default function DiffHighlight({
  kind,
  state,
  children,
  previousValue,
  onAccept,
  onReject,
}: DiffHighlightProps) {
  const [isHovering, setIsHovering] = useState(false)

  if (state === "hidden") return null

  const showOld = isHovering && kind === "rewrite" && !!previousValue

  const displayText = showOld ? previousValue : children
  let bgClass: string
  if (showOld) {
    bgClass = "bg-rose-100 text-rose-700"
  } else if (kind === "addition") {
    bgClass = "bg-emerald-100 text-emerald-700"
  } else {
    bgClass = "bg-amber-100 text-amber-700"
  }

  return (
    <section
      aria-label={kind === "addition" ? "AI addition" : "Modified: hover to see original text"}
      aria-live="polite"
      title={kind === "rewrite" && previousValue ? previousValue : undefined}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={[
        bgClass,
        state === "faded" ? "opacity-50" : "",
        "relative inline-block rounded-sm px-0.5",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span aria-hidden="true" className="mr-0.5 text-xs">
        {kind === "addition" ? "+" : "~"}
      </span>
      {displayText}
      <span className="inline-flex gap-0.5 ml-1 align-middle">
        <button
          type="button"
          aria-label="Accept AI change"
          onClick={(e) => {
            e.stopPropagation()
            onAccept()
          }}
          className="text-xs px-1 rounded bg-emerald-200 hover:bg-emerald-300"
        >
          ✓
        </button>
        <button
          type="button"
          aria-label="Reject AI change"
          onClick={(e) => {
            e.stopPropagation()
            onReject()
          }}
          className="text-xs px-1 rounded bg-red-100 hover:bg-red-200"
        >
          ✕
        </button>
      </span>
    </section>
  )
}
