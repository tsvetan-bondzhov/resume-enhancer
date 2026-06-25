import { Columns2, PanelLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LayoutPresetId } from "@/pages/templateEditorPresets"

interface CssVarDoc {
  name: string
  controls: string
  units: string
}

const CSS_VAR_DOCS: CssVarDoc[] = [
  { name: "--primary-color", controls: "Section title text color", units: "color (hex/rgb)" },
  {
    name: "--accent-color",
    controls: "Title underline / modern-accent header band",
    units: "color (hex/rgb)",
  },
  { name: "--text-color", controls: "Body text color", units: "color (hex/rgb)" },
  { name: "--font-family-sans", controls: "Font family for all text", units: "font stack" },
  { name: "--font-size-base", controls: "Base body font size", units: "px or in only" },
  { name: "--line-height-base", controls: "Base line height", units: "unitless number" },
  { name: "--section-spacing", controls: "Gap between sections", units: "px or in only" },
  { name: "--item-spacing", controls: "Gap between items in a section", units: "px or in only" },
  { name: "--page-margin-top", controls: "Top page margin", units: "px or in only" },
  { name: "--page-margin-right", controls: "Right page margin", units: "px or in only" },
  { name: "--page-margin-bottom", controls: "Bottom page margin", units: "px or in only" },
  { name: "--page-margin-left", controls: "Left page margin", units: "px or in only" },
]

const LAYOUT_PRESET_META: { id: LayoutPresetId; label: string; icon: typeof PanelLeft; effect: string }[] = [
  {
    id: "single-column",
    label: "Single column",
    icon: PanelLeft,
    effect: "All sections stacked in one column (default).",
  },
  {
    id: "two-column",
    label: "Two column",
    icon: Columns2,
    effect: "Splits sections across layout.columns.left and layout.columns.right.",
  },
  {
    id: "modern-accent",
    label: "Modern accent",
    icon: Sparkles,
    effect: "Single column with a colored accent header band.",
  },
]

interface TemplateEditorSidebarProps {
  readonly onApplyPreset: (preset: LayoutPresetId) => void
  readonly disabled?: boolean
}

export default function TemplateEditorSidebar({
  onApplyPreset,
  disabled,
}: TemplateEditorSidebarProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto border-r bg-muted/20 p-4 text-xs">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Layout presets</h2>
        <p className="text-muted-foreground">
          Click a layout to prefill the JSON with a complete, valid definition.
        </p>
        <div className="flex flex-col gap-2">
          {LAYOUT_PRESET_META.map(({ id, label, icon: Icon, effect }) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onApplyPreset(id)}
              className="h-auto justify-start gap-2 py-2 text-left"
              aria-label={`Apply ${label} preset`}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex flex-col">
                <span className="font-medium">{label}</span>
                <span className="text-[10px] font-normal text-muted-foreground">{effect}</span>
              </span>
            </Button>
          ))}
        </div>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold">CSS variables</h2>
        <p className="text-muted-foreground">
          Sized values must use <strong>px</strong> or <strong>in</strong> — never rem/em.
        </p>
        <ul className="space-y-2">
          {CSS_VAR_DOCS.map((v) => (
            <li key={v.name} className="rounded border bg-background p-2">
              <code className="font-mono text-[11px] font-semibold">{v.name}</code>
              <p className="text-muted-foreground">{v.controls}</p>
              <p className="text-[10px] text-muted-foreground">Value: {v.units}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold">Layout types</h2>
        <ul className="space-y-1">
          {LAYOUT_PRESET_META.map((l) => (
            <li key={l.id}>
              <code className="font-mono text-[11px] font-semibold">{l.id}</code>
              <span className="text-muted-foreground"> — {l.effect}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold">Sections & ordering</h2>
        <p className="text-muted-foreground">
          <code className="font-mono">layout.sectionOrder</code> is an array of section types
          controlling render order. Visible sections not listed are appended at the end.
        </p>
        <p className="text-muted-foreground">
          For <code className="font-mono">two-column</code>, place each section type in either{" "}
          <code className="font-mono">layout.columns.left</code> or{" "}
          <code className="font-mono">layout.columns.right</code>.
        </p>
        <p className="text-muted-foreground">
          Section types: WORK_EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS, LANGUAGES, PROJECTS,
          VOLUNTEERING, SUMMARY, FULL_NAME.
        </p>
      </section>
    </div>
  )
}
