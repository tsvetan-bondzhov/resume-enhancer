import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiClient } from "@/lib/apiClient"
import ResumeCanvas from "@/components/resume/ResumeCanvas"
import TemplateEditorSidebar from "@/components/template-editor/TemplateEditorSidebar"
import {
  DEFAULT_DEFINITION,
  LAYOUT_PRESETS,
  SAMPLE_DOC,
  type LayoutPresetId,
} from "@/pages/templateEditorPresets"
import type { TemplateDefinitionDto, TemplateDto, TemplateRequest } from "@/types/api"

const DEBOUNCE_MS = 500

const DEFAULT_DEFINITION_TEXT = JSON.stringify(DEFAULT_DEFINITION, null, 2)

// Matches values like 12rem / 1.5em — the backend rejects these with HTTP 400,
// so reject them client-side too (AC4). Only px/in are accepted for sized values.
const REM_EM_PATTERN = /\d+(\.\d+)?(rem|em)\b/i

/**
 * Validate a parsed definition. Returns an error message string, or null if valid.
 * Mirrors the backend contract: `layoutType` required; CSS var values must not use rem/em.
 */
function validateDefinition(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return "Definition must be a JSON object."
  }
  const def = parsed as Record<string, unknown>
  if (typeof def.layoutType !== "string" || def.layoutType.trim() === "") {
    return "Missing required field: layoutType."
  }
  const cssVars = def.cssVariables
  if (cssVars !== undefined) {
    if (typeof cssVars !== "object" || cssVars === null || Array.isArray(cssVars)) {
      return "cssVariables must be an object."
    }
    for (const [key, value] of Object.entries(cssVars as Record<string, unknown>)) {
      if (typeof value === "string" && REM_EM_PATTERN.test(value)) {
        return `CSS value for "${key}" must use px or in, not rem/em.`
      }
    }
  }
  return null
}

export default function TemplateEditorPage() {
  const { templateId } = useParams<{ templateId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isEdit = templateId !== undefined

  // System (admin) mode edits a prebuilt template's definition via the admin
  // endpoints; custom mode edits the caller's own user template. Distinguished
  // by the route path so the same editor UI is reused for both.
  const isSystem = location.pathname.startsWith("/templates/system/")

  // Endpoint base differs by mode: admin updates a system template at
  // `/api/v1/resume-templates/{id}`, a user updates their own at `/custom/{id}`.
  const loadPath = isSystem
    ? `/api/v1/resume-templates/${templateId}`
    : `/api/v1/resume-templates/custom/${templateId}`

  // In edit mode we load the existing template; track loading state.
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Editor state — seeded after the template loads (or immediately for create mode).
  const [name, setName] = useState("")
  const [definitionText, setDefinitionText] = useState(DEFAULT_DEFINITION_TEXT)
  const [lastValidDef, setLastValidDef] = useState<TemplateDefinitionDto>(DEFAULT_DEFINITION)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Load existing template when in edit mode.
  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    apiClient
      .get<TemplateDto>(loadPath)
      .then((template) => {
        if (cancelled) return
        setName(template.name)
        const defText = JSON.stringify(template.templateDefinition, null, 2)
        setDefinitionText(defText)
        setLastValidDef(template.templateDefinition)
        setIsLoadingTemplate(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError("Failed to load template. It may not exist or you may not have access.")
        setIsLoadingTemplate(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, templateId, loadPath])

  // Synchronous validation (AC4): run immediately on every definitionText change so
  // the inline error message appears without delay. Does NOT touch lastValidDef (preview)
  // so the preview never crashes on intermediate invalid input.
  useEffect(() => {
    if (isLoadingTemplate) return
    let parsed: unknown
    try {
      parsed = JSON.parse(definitionText)
    } catch {
      setValidationError("Invalid JSON: please fix the syntax.")
      return
    }
    const error = validateDefinition(parsed)
    setValidationError(error)
  }, [definitionText, isLoadingTemplate])

  // Debounced preview update (AC3): only update lastValidDef (which drives ResumeCanvas)
  // after 500ms of inactivity and only when the definition is currently valid.
  useEffect(() => {
    if (isLoadingTemplate) return
    const id = setTimeout(() => {
      let parsed: unknown
      try {
        parsed = JSON.parse(definitionText)
      } catch {
        return // invalid JSON — keep last valid preview, error already shown above
      }
      if (validateDefinition(parsed) !== null) return // invalid definition — keep last valid preview
      setLastValidDef(parsed as TemplateDefinitionDto)
    }, DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [definitionText, isLoadingTemplate])

  const handleCancel = () => {
    navigate(-1)
  }

  // Prefill the JSON textarea with a complete, valid definition for the chosen
  // layout type. The debounced effect then refreshes the live preview.
  const handleApplyPreset = (preset: LayoutPresetId) => {
    setDefinitionText(JSON.stringify(LAYOUT_PRESETS[preset], null, 2))
  }

  const handleSave = async () => {
    if (validationError || name.trim() === "" || isSaving) return
    // Parse once more synchronously so a save triggered before the debounce flush
    // still uses the current text (and is validated again as a safeguard).
    let parsed: unknown
    try {
      parsed = JSON.parse(definitionText)
    } catch {
      setValidationError("Invalid JSON: please fix the syntax.")
      return
    }
    const error = validateDefinition(parsed)
    if (error) {
      setValidationError(error)
      return
    }

    const body: TemplateRequest = {
      name: name.trim(),
      description: null,
      templateDefinition: parsed as Record<string, unknown>,
    }

    setIsSaving(true)
    try {
      if (isEdit) {
        await apiClient.put<TemplateDto>(loadPath, body)
      } else {
        await apiClient.post<TemplateDto>("/api/v1/resume-templates/custom", body)
      }
      toast.success("Template saved")
      navigate(-1)
    } catch {
      toast.error("Failed to save template")
    } finally {
      setIsSaving(false)
    }
  }

  // Derive saveDisabled from the raw (non-debounced) definitionText so the button
  // is always in sync with the current input, not the debounced validation state.
  // This prevents the Save button from being briefly enabled during the 500ms debounce
  // window after the user types invalid content (AC4).
  const rawSaveDisabled = (() => {
    if (isSaving || name.trim() === "") return true
    let parsed: unknown
    try {
      parsed = JSON.parse(definitionText)
    } catch {
      return true
    }
    return validateDefinition(parsed) !== null
  })()
  const saveDisabled = rawSaveDisabled

  if (isLoadingTemplate) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading template…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button type="button" variant="outline" onClick={handleCancel}>
          Go back
        </Button>
      </div>
    )
  }

  return (
    // h-screen + overflow-hidden: the OUTER body never scrolls. Header is fixed;
    // each pane scrolls independently (AC5).
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center justify-between border-b px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? "Hide instructions" : "Show instructions"}
            aria-pressed={sidebarOpen}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-5" aria-hidden="true" />
            ) : (
              <PanelLeftOpen className="size-5" aria-hidden="true" />
            )}
          </Button>
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              {isEdit ? "Edit template" : "Create new template"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Edit the name and JSON definition. The preview updates as you type.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveDisabled}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      {/* Body — min-h-0 lets the flex child clip and its children scroll internally. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Collapsible instructions / presets sidebar */}
        {sidebarOpen && (
          <aside className="w-72 shrink-0" data-testid="template-editor-sidebar">
            <TemplateEditorSidebar onApplyPreset={handleApplyPreset} disabled={isSaving} />
          </aside>
        )}

        {/* Editor + preview panes */}
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-0 overflow-hidden">
          {/* Left: editor (scrolls independently) */}
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto border-r p-6">
            <div className="space-y-2">
              <Label htmlFor="template-editor-name">Name</Label>
              <Input
                id="template-editor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSaving}
                placeholder="My custom template"
              />
            </div>
            <div className="flex flex-1 flex-col space-y-2">
              <Label htmlFor="template-editor-definition">Template definition (JSON)</Label>
              <Textarea
                id="template-editor-definition"
                value={definitionText}
                onChange={(e) => setDefinitionText(e.target.value)}
                disabled={isSaving}
                spellCheck={false}
                className="font-mono text-xs flex-1 min-h-[400px] resize-none"
              />
              {validationError && (
                <p className="text-sm text-destructive" role="alert">
                  {validationError}
                </p>
              )}
            </div>
          </div>

          {/* Right: live preview (ResumeCanvas scrolls internally) */}
          <div
            aria-live="polite"
            aria-label="Template live preview"
            className="min-h-0 overflow-hidden bg-muted/30"
          >
            <ResumeCanvas document={SAMPLE_DOC} templateId={null} templatePreview={lastValidDef} />
          </div>
        </div>
      </div>
    </div>
  )
}

