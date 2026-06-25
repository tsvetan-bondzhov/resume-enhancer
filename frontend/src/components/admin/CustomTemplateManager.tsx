import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/apiClient"
import type { CustomTemplateAdminDto } from "@/types/api"

export default function CustomTemplateManager() {
  const [templates, setTemplates] = useState<CustomTemplateAdminDto[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<CustomTemplateAdminDto[]>("/api/v1/resume-templates/admin/custom")
      .then((data) => {
        if (!cancelled) {
          setTemplates(data)
          setLoadError(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
          toast.error("Failed to load user templates")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  if (loadError) {
    return <p className="text-sm text-destructive">Failed to load user templates.</p>
  }

  const query = search.trim().toLowerCase()
  const filteredTemplates = query
    ? templates.filter((template) =>
        [
          template.name,
          template.ownerEmail,
          template.isPublished ? "Published" : "Draft",
        ].some((field) => field.toLowerCase().includes(query)),
      )
    : templates

  return (
    <>
      <div className="mb-4">
        <Input
          type="search"
          placeholder="Search by name, owner email, or status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search user templates"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">Name</th>
            <th scope="col" className="px-4 py-2 font-medium">Owner</th>
            <th scope="col" className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredTemplates.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                No user templates found.
              </td>
            </tr>
          ) : (
            filteredTemplates.map((template) => (
              <tr key={template.id} className="border-b last:border-0">
                <td className="px-4 py-2">{template.name}</td>
                <td className="px-4 py-2">{template.ownerEmail}</td>
                <td className="px-4 py-2">
                  <Badge variant={template.isPublished ? "secondary" : "outline"}>
                    {template.isPublished ? "Published" : "Draft"}
                  </Badge>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </>
  )
}
