import { useShallow } from "zustand/react/shallow"
import { useDiffStore } from "@/stores/useDiffStore"
import { useResumeStore } from "@/stores/useResumeStore"
import DiffHighlight from "@/components/resume/DiffHighlight"

interface DiffOverlayProps {
  readonly sectionId: string
  readonly itemIndex?: number
}

export default function DiffOverlay({ sectionId, itemIndex }: DiffOverlayProps) {
  const diffs = useDiffStore(
    useShallow((state) =>
      state.diffs.filter(
        (d) =>
          d.sectionId === sectionId &&
          d.state !== "hidden" &&
          (itemIndex === undefined || d.itemIndex === itemIndex)
      )
    )
  )
  const acceptDiff = useDiffStore((state) => state.acceptDiff)
  const rejectDiff = useDiffStore((state) => state.rejectDiff)
  const applyPatch = useResumeStore((state) => state.applyPatch)

  if (diffs.length === 0) return null

  return (
    <div className="mt-1 flex flex-col gap-1">
      {diffs.map((diff) => (
        <DiffHighlight
          key={diff.id}
          kind={diff.kind}
          state={diff.state}
          previousValue={diff.previousValue}
          onAccept={() => acceptDiff(diff.id)}
          onReject={() => {
            applyPatch({
              sectionId: diff.sectionId,
              itemIndex: diff.itemIndex,
              field: diff.field,
              newValue: diff.previousValue,
            })
            rejectDiff(diff.id)
          }}
        >
          {diff.newValue}
        </DiffHighlight>
      ))}
    </div>
  )
}
