import { useShallow } from "zustand/react/shallow"
import { useDiffStore } from "@/stores/useDiffStore"
import { useResumeStore } from "@/stores/useResumeStore"
import DiffHighlight from "@/components/resume/DiffHighlight"

interface DiffOverlayProps {
  readonly sectionId: string
}

export default function DiffOverlay({ sectionId }: DiffOverlayProps) {
  const diffs = useDiffStore(
    useShallow((state) =>
      state.diffs.filter((d) => d.sectionId === sectionId && d.state !== "hidden")
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
