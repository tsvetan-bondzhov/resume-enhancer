import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { FileText } from "lucide-react"
import { apiClient } from "@/lib/apiClient"
import { useResumeStore } from "@/stores/useResumeStore"
import ResumeDashboardCard from "@/components/resume/ResumeDashboardCard"
import ResumeDashboardCardSkeleton from "@/components/resume/ResumeDashboardCardSkeleton"
import { Button } from "@/components/ui/button"
import type { CreateResumeRequest, ResumeDto } from "@/types/api"

export default function DashboardPage() {
  const navigate = useNavigate()
  const [displayedResumes, setDisplayedResumes] = useState<ResumeDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const setResumes = useResumeStore((state) => state.setResumes)

  useEffect(() => {
    async function fetchResumes() {
      try {
        const data = await apiClient.get<ResumeDto[]>("/api/v1/resumes")
        setDisplayedResumes(data)
        setResumes(data)
      } catch {
        toast.error("Failed to load resumes")
      } finally {
        setIsLoading(false)
      }
    }
    fetchResumes()
  }, [setResumes])

  // Clean up pending deletes on unmount
  useEffect(() => {
    return () => {
      pendingDeletes.current.forEach(clearTimeout)
    }
  }, [])

  const handleCreateResume = useCallback(async () => {
    setIsCreating(true)
    try {
      const body: CreateResumeRequest = { name: "Untitled Resume", templateId: null }
      const newResume = await apiClient.post<ResumeDto>("/api/v1/resumes", body)
      navigate(`/resumes/${newResume.id}`)
    } catch {
      toast.error("Failed to create resume")
    } finally {
      setIsCreating(false)
    }
  }, [navigate])

  const handleOpen = useCallback(
    (id: string) => {
      navigate(`/resumes/${id}`)
    },
    [navigate],
  )

  const handleDuplicate = useCallback(async (resume: ResumeDto) => {
    setDuplicatingId(resume.id)
    try {
      const newResume = await apiClient.post<ResumeDto>(
        `/api/v1/resumes/${resume.id}/clone`,
        { name: `${resume.name} (copy)` },
      )
      setDisplayedResumes((prev) => [newResume, ...prev])
      toast.success("Resume duplicated")
    } catch {
      toast.error("Failed to duplicate resume")
    } finally {
      setDuplicatingId(null)
    }
  }, [])

  const handleDelete = useCallback((resume: ResumeDto) => {
    // 1. Remove from display immediately (optimistic)
    setDisplayedResumes((prev) => prev.filter((r) => r.id !== resume.id))

    // 2. Schedule actual API delete after 5s
    const timeoutId = setTimeout(async () => {
      pendingDeletes.current.delete(resume.id)
      try {
        await apiClient.delete(`/api/v1/resumes/${resume.id}`)
      } catch {
        // Restore on failure
        setDisplayedResumes((prev) => {
          if (prev.find((r) => r.id === resume.id)) return prev
          return [...prev, resume]
        })
        toast.error("Delete failed — resume restored")
      }
    }, 5000)

    pendingDeletes.current.set(resume.id, timeoutId)

    // 3. Show undo toast
    toast("Deleted. Undo?", {
      action: {
        label: "Undo",
        onClick: () => {
          const id = pendingDeletes.current.get(resume.id)
          if (id !== undefined) clearTimeout(id)
          pendingDeletes.current.delete(resume.id)
          setDisplayedResumes((prev) => {
            if (prev.find((r) => r.id === resume.id)) return prev
            return [...prev, resume]
          })
        },
      },
      duration: 5000,
    })
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">My Resumes</h1>
        <Button variant="outline" onClick={handleCreateResume} disabled={isCreating}>
          {isCreating ? "Creating…" : "New Resume"}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <ResumeDashboardCardSkeleton />
          <ResumeDashboardCardSkeleton />
          <ResumeDashboardCardSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayedResumes.length === 0 && (
        <section
          aria-label="No resumes"
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-24 h-24 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="size-10 text-zinc-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Your resumes live here</h2>
          <p className="text-muted-foreground mb-6">
            Build your profile to get started
          </p>
          <Button onClick={() => navigate("/profile")}>Go to Profile</Button>
        </section>
      )}

      {/* Resume gallery */}
      {!isLoading && displayedResumes.length > 0 && (
        <section aria-label="Resume gallery">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedResumes.map((resume) => (
              <ResumeDashboardCard
                key={resume.id}
                resume={resume}
                onOpen={() => handleOpen(resume.id)}
                onDuplicate={() => handleDuplicate(resume)}
                onDelete={() => handleDelete(resume)}
                isDuplicating={duplicatingId === resume.id}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
