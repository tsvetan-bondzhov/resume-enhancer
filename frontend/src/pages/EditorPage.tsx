import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { apiClient } from "@/lib/apiClient"
import { useResumeStore } from "@/stores/useResumeStore"
import SplitPaneLayout from "@/components/layout/SplitPaneLayout"
import ResumeCanvas from "@/components/resume/ResumeCanvas"
import type { ResumeDto } from "@/types/api"

export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const [resume, setResume] = useState<ResumeDto | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const setCurrentResume = useResumeStore((state) => state.setCurrentResume)

  useEffect(() => {
    if (!id) return

    const load = async () => {
      try {
        const data = await apiClient.get<ResumeDto>(`/api/v1/resumes/${id}`)
        setResume(data)
        setCurrentResume(data)
      } catch {
        setError("Failed to load resume")
        toast.error("Failed to load resume")
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [id, setCurrentResume])

  // Cleanup: clear current resume from store on unmount
  useEffect(() => {
    return () => {
      setCurrentResume(null)
    }
  }, [setCurrentResume])

  return (
    <SplitPaneLayout
      leftSlot={
        <div className="p-4 text-sm text-muted-foreground">
          Sections panel coming in Story 3.5
        </div>
      }
      centerSlot={
        error !== null && !isLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-destructive">{error}</p>
          </div>
        ) : (
          <ResumeCanvas
            document={resume?.content ?? null}
            isLoading={isLoading}
            state="idle"
          />
        )
      }
      rightSlot={
        <div className="p-4 text-sm text-muted-foreground">
          Chat panel coming in Story 4.3
        </div>
      }
    />
  )
}
