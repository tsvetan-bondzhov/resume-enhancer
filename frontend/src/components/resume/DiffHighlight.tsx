type DiffHighlightKind = "addition" | "rewrite"
type DiffHighlightState = "visible" | "faded" | "hidden"

interface DiffHighlightProps {
  readonly kind: DiffHighlightKind
  readonly state: DiffHighlightState
  readonly children: React.ReactNode
  readonly onAccept: () => void
  readonly onReject: () => void
}

export default function DiffHighlight({
  kind,
  state,
  children,
  onAccept,
  onReject,
}: DiffHighlightProps) {
  if (state === "hidden") return null

  return (
    <mark
      role="mark"
      aria-label={kind === "addition" ? "AI addition" : "AI rewrite"}
      className={[
        kind === "addition"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700",
        state === "faded" ? "opacity-50" : "",
        "relative inline-block rounded-sm px-0.5",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Icon — never color-only (UX-DR4, AC3) */}
      <span aria-hidden="true" className="mr-0.5 text-xs">
        {kind === "addition" ? "+" : "~"}
      </span>
      {children}
      {/* Accept/Reject controls */}
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
    </mark>
  )
}
