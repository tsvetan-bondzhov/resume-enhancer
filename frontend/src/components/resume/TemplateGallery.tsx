import { useState, useEffect } from "react"
import { apiClient } from "@/lib/apiClient"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { TemplateDto } from "@/types/api"

interface TemplateGalleryProps {
  activeTemplateId: string | null
  onApply: (templateId: string) => void
}

function TemplateThumbnail({ template }: { template: TemplateDto }) {
  const layoutType = template.templateDefinition?.layoutType
  const accentColor = template.templateDefinition?.cssVariables?.["--accent-color"] ?? "#3b82f6"

  if (layoutType === "two-column") {
    return (
      <div className="w-full aspect-[1/1.414] bg-zinc-100 rounded-sm mb-1.5 flex gap-0.5 p-1 overflow-hidden">
        {/* Narrow left column */}
        <div className="w-1/3 flex flex-col gap-0.5">
          <div className="h-0.5 bg-zinc-300 rounded-full w-full" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-4/5" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-3/5" />
          <div className="h-0.5 bg-zinc-300 rounded-full w-full mt-1" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-4/5" />
        </div>
        {/* Wider right column */}
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="h-1 bg-zinc-300 rounded-full w-3/4" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-full" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-4/6" />
        </div>
      </div>
    )
  }

  if (layoutType === "modern-accent") {
    return (
      <div className="w-full aspect-[1/1.414] bg-white rounded-sm mb-1.5 overflow-hidden">
        {/* Accent header band */}
        <div className="h-3 w-full" style={{ backgroundColor: accentColor }} />
        {/* Content lines */}
        <div className="flex flex-col gap-0.5 p-1">
          <div className="h-0.5 bg-zinc-200 rounded-full w-full" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-4/6" />
          <div className="h-1 bg-zinc-300 rounded-full w-1/2 mt-0.5" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-full" />
          <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
        </div>
      </div>
    )
  }

  // Default: single-column (also handles undefined layoutType — graceful fallback)
  return (
    <div className="w-full aspect-[1/1.414] bg-zinc-100 rounded-sm mb-1.5 flex flex-col gap-0.5 p-1 overflow-hidden">
      <div className="h-1 bg-zinc-300 rounded-full w-3/4" />
      <div className="h-0.5 bg-zinc-200 rounded-full w-full mt-0.5" />
      <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
      <div className="h-0.5 bg-zinc-200 rounded-full w-4/6" />
      <div className="h-1 bg-zinc-300 rounded-full w-1/2 mt-1" />
      <div className="h-0.5 bg-zinc-200 rounded-full w-full" />
      <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
    </div>
  )
}

const FILTER_TABS = ["all", "minimal", "classic", "modern"] as const
type FilterTab = (typeof FILTER_TABS)[number]

export default function TemplateGallery({
  activeTemplateId,
  onApply,
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<TemplateDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<TemplateDto[]>("/api/v1/resume-templates")
      .then((data) => {
        if (!cancelled) {
          setTemplates(data)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filteredTemplates = (tab: FilterTab) =>
    tab === "all"
      ? templates
      : templates.filter((t) => t.name.toLowerCase().includes(tab))

  return (
    <div className="px-3 py-2">
      <p className="text-sm font-medium mb-3">Templates</p>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-3">
          <TabsTrigger value="all" className="flex-1 text-xs">
            All
          </TabsTrigger>
          <TabsTrigger value="minimal" className="flex-1 text-xs">
            Minimal
          </TabsTrigger>
          <TabsTrigger value="classic" className="flex-1 text-xs">
            Classic
          </TabsTrigger>
          <TabsTrigger value="modern" className="flex-1 text-xs">
            Modern
          </TabsTrigger>
        </TabsList>

        {FILTER_TABS.map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-0">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-24 w-full rounded" />
                <Skeleton className="h-24 w-full rounded" />
                <Skeleton className="h-24 w-full rounded" />
              </div>
            ) : filteredTemplates(tab).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No templates in this category
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredTemplates(tab).map((template) => {
                  const isActive = template.id === activeTemplateId
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onApply(template.id)}
                      aria-label={`Apply ${template.name} template${isActive ? " (active)" : ""}`}
                      aria-pressed={isActive}
                      className={[
                        "relative rounded border text-left p-2 transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                        isActive
                          ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50"
                          : "border-border bg-card hover:border-zinc-400",
                      ].join(" ")}
                    >
                      <TemplateThumbnail template={template} />

                      <p className="text-xs font-medium truncate">{template.name}</p>

                      {isActive && (
                        <span
                          className="absolute top-1 right-1 text-[10px] bg-blue-500 text-white px-1 rounded"
                          aria-hidden="true"
                        >
                          Active
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
