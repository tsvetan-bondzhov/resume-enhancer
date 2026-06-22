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

  const showPopup = isHovering && kind === "rewrite" && !!previousValue

  const bgClass =
    kind === "addition"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700"

  return (
    <section
      aria-label={kind === "addition" ? "AI addition" : "Modified: hover to compare original and new text"}
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
      {showPopup && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-10 mb-1 flex w-max max-w-xs -translate-x-1/2 flex-col gap-1 rounded-md border border-slate-200 bg-white p-2 text-left text-xs shadow-md"
        >
          <span className="flex items-baseline gap-1">
            <span aria-hidden="true" className="font-semibold text-rose-600">−</span>
            <span className="text-rose-600 line-through">{previousValue}</span>
          </span>
          <span className="flex items-baseline gap-1">
            <span aria-hidden="true" className="font-semibold text-emerald-600">+</span>
            <span className="text-emerald-600">{children}</span>
          </span>
        </span>
      )}
      <span aria-hidden="true" className="mr-0.5 text-xs">
        {kind === "addition" ? "+" : "~"}
      </span>
      {children}
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
