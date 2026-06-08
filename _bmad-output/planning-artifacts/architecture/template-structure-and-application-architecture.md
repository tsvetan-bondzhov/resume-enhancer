# Template Structure and Application Architecture

_Added: 2026-06-08. Fills the gap left by the initial architecture document where `templateDefinition` format was deferred ("TBD in Epic 7")._

### Overview

Templates define the **visual layout, typography, and structural presentation** of a resume. They are applied by **reference** — `Resume.templateId` is a UUID foreign key; the template definition is fetched at render time and never embedded in the resume document. This design is already implemented in the entity model; this section defines what the `templateDefinition` JSONB must contain and how both rendering targets consume it.

Two rendering targets consume the same template:
1. **Browser preview** - React `ResumeCanvas` component, CSS custom properties
2. **Server-side export** - iText 7 (PDF) and Apache POI (DOCX), via a `DocumentRenderer` interface

### Layout Types

`layoutType` is the top-level discriminator for the page grid structure - how the content area is divided horizontally. It controls the renderer's structural behaviour, independent of typography (`cssVariables`) and per-section styling (`sectionStyles`).

Three values are defined:

**`"single-column"`** - full-width single content column. All sections stack vertically.

- Web: root `<article>` is a single block container; sections fill full width
- PDF: paragraphs added directly to iText `Document`; no column containers

**`"two-column"`** - narrow left sidebar (~33%) + wider main column (~67%). Section-to-column assignment is **explicit in the template JSON** via `layout.columns.left` and `layout.columns.right`. The renderer is dumb - it reads the arrays and routes sections accordingly; it has no embedded knowledge of which section types belong in which column.

- Web: root `<article>` uses CSS Grid (`grid-template-columns: 1fr 2fr`); sections rendered into left or right grid area based on `columns.left` / `columns.right`
- PDF: iText `ColumnDocumentRenderer` with two `Rectangle` areas; left column rendered first, then right

**`"modern-accent"`** - structurally identical to `single-column`, but with a full-width coloured header band (filled with `--accent-color`) and accent underlines on section title elements. The `layoutType` value tells renderers to apply these accent treatments; no extra JSON fields are needed.

- Web: conditional classes on header (`bg-[var(--accent-color)]`) and section `<h2>` (`border-b-2 border-[var(--accent-color)]`); layout is otherwise single-column
- PDF: iText draws a filled `Rectangle` for the header background; section title separators use a coloured `LineSeparator`

### Template Definition Schema

The `template_definition` JSONB column (on `resume_templates`) follows this schema. Both renderers treat this as their sole source of styling truth.

**Single-column and modern-accent templates** use `layout.sectionOrder` (flat array):

```json
{
  "layoutType": "single-column",
  "cssVariables": {
    "--primary-color": "#1f2937",
    "--accent-color": "#3b82f6",
    "--font-family-sans": "Inter, system-ui, sans-serif",
    "--font-size-base": "11px",
    "--line-height-base": "1.4",
    "--section-spacing": "12px",
    "--item-spacing": "6px",
    "--page-margin-top": "0.5in",
    "--page-margin-right": "0.5in",
    "--page-margin-bottom": "0.5in",
    "--page-margin-left": "0.5in"
  },
  "layout": {
    "headerFormat": "name-only | name-contact | name-contact-summary",
    "sectionOrder": ["experience", "education", "skills", "certifications", "projects"],
    "sectionStyles": {
      "experience": {
        "titleFormat": "uppercase | bold | underline",
        "itemSeparator": "bullet | dash | comma | newline",
        "showDates": true,
        "showDescriptions": true
      }
    }
  },
  "metadata": {
    "version": "1.0",
    "atsCompatible": true,
    "pageSize": "letter | a4"
  }
}
```

**Two-column templates** replace `sectionOrder` with `columns` (explicit left/right assignment). `sectionOrder` is absent or ignored when `columns` is present:

```json
{
  "layoutType": "two-column",
  "cssVariables": { "...": "..." },
  "layout": {
    "headerFormat": "name-contact",
    "columns": {
      "left":  ["skills", "languages", "certifications"],
      "right": ["experience", "education", "projects"]
    },
    "sectionStyles": { "...": {} }
  },
  "metadata": { "version": "1.0", "atsCompatible": true, "pageSize": "letter" }
}
```

Sections present in the resume document but absent from both `columns.left` and `columns.right` (or from `sectionOrder`) append to the end of the right column (two-column) or bottom (single-column), in document order. Sections are never silently dropped.

**Key design rationale:**
- `layoutType` is the sole structural discriminator; renderers switch on it once at the top level
- `cssVariables` keys mirror CSS custom property names - browser injects them as-is; PDF renderer parses their values (`11px -> 8.25pt`, `0.5in -> 36pt`)
- Two-column section assignment is explicit in the template (`columns.left` / `columns.right`) - the renderer has no embedded knowledge of section semantics
- `sectionStyles` is keyed by section `id` (matching `ResumeSection.id`) - absent keys fall back to defaults
- `metadata.version` enables forward-compatible schema evolution without Flyway migrations
- Unknown keys are ignored by both renderers - safe to extend

**Java records for type-safe renderer consumption** (in `export` package):

```java
public record TemplateDefinition(
    String layoutType,                // "single-column" | "two-column" | "modern-accent"
    Map<String, String> cssVariables,
    TemplateLayout layout,
    Map<String, Object> metadata
) {
    /** Compiled-in fallback used when Resume.templateId is null or the referenced template is deleted. */
    public static final TemplateDefinition DEFAULT = new TemplateDefinition(
        "single-column",
        Map.of(
            "--primary-color", "#1f2937",
            "--font-family-sans", "Inter, system-ui, sans-serif",
            "--font-size-base", "11px",
            "--line-height-base", "1.5",
            "--section-spacing", "12px",
            "--page-margin-top", "0.75in",
            "--page-margin-right", "0.75in",
            "--page-margin-bottom", "0.75in",
            "--page-margin-left", "0.75in"
        ),
        new TemplateLayout(
            "name-contact",
            List.of("experience", "education", "skills"),
            null,
            Map.of()
        ),
        Map.of("version", "1.0", "atsCompatible", true, "pageSize", "letter")
    );

    public boolean isTwoColumn()    { return "two-column".equals(layoutType); }
    public boolean isModernAccent() { return "modern-accent".equals(layoutType); }
}

public record TemplateLayout(
    String headerFormat,
    List<String> sectionOrder,        // used by single-column and modern-accent; null for two-column
    TemplateColumns columns,          // used by two-column; null for other layout types
    Map<String, SectionStyle> sectionStyles
) {
    /** Returns ordered section IDs for single-column / modern-accent layouts. */
    public List<String> resolvedSectionOrder() {
        if (columns != null) throw new IllegalStateException(
            "Use columns.left/right for two-column layouts");
        return sectionOrder != null ? sectionOrder : List.of();
    }
}

public record TemplateColumns(
    List<String> left,
    List<String> right
) {}

public record SectionStyle(
    String titleFormat,       // "uppercase" | "bold" | "underline"
    String itemSeparator,     // "bullet" | "dash" | "comma" | "newline"
    boolean showDates,
    boolean showDescriptions
) {}
```

`ExportService` deserializes `Map<String, Object>` to `TemplateDefinition` via `ObjectMapper.convertValue()`. When `Resume.templateId` is null or the template row is missing, `TemplateDefinition.DEFAULT` is used - no additional DB query.

### How Templates Are Applied

**Application model: reference-based (already implemented)**

```
Resume.templateId (UUID) --FK--> resume_templates.id
```

Template definition is never copied into the resume. At render time (preview or export), the template is fetched by ID. `TemplateService` is already annotated with Caffeine `@Cacheable` - no per-request DB cost for repeat renders.

**Template switch flow:**
1. User selects a template in `TemplateGallery`
2. `onApply(templateId)` calls `PUT /api/v1/resumes/{resumeId}` with `{ templateId: "..." }`
3. Backend updates `Resume.templateId` and persists - resume content is unchanged
4. Frontend receives updated `ResumeDto` with new `templateId`
5. `ResumeCanvas` re-fetches template definition and re-renders (optimistic update already wired in `useResumeStore`)

### Browser Preview Rendering Pipeline

**Gap in current code:** `ResumeCanvas` does not accept a `templateId` prop and renders with hardcoded Tailwind classes only. These changes are required when this feature is implemented:

**Updated `ResumeCanvasProps`:**
```typescript
interface ResumeCanvasProps {
  document: ResumeDocumentDto | null
  templateId: string | null   // ADD THIS
  isLoading?: boolean
  state?: "idle" | "streaming" | "diff" | "print-preview"
}
```

**Template application in `ResumeCanvas`:**
```typescript
const [template, setTemplate] = useState<TemplateDto | null>(null)
useEffect(() => {
  if (!templateId) { setTemplate(null); return }
  apiClient.get<TemplateDto>(`/api/v1/resume-templates/${templateId}`)
    .then(setTemplate)
    .catch(() => setTemplate(null))
}, [templateId])

// Inject CSS variables as inline style on the root <article>
const cssVars = template?.templateDefinition?.cssVariables ?? {}
const rootStyle = Object.fromEntries(
  Object.entries(cssVars as Record<string, string>).map(([k, v]) => [k, v])
) as React.CSSProperties
```

**Section rendering with layout rules:**
- Render order driven by `template.layout.sectionOrder`; sections in the document but absent from `sectionOrder` render last, in document order
- `sectionStyles[section.id]` provides `titleFormat`, `itemSeparator`, `showDates`, `showDescriptions`
- Sections with no matching `sectionStyle` entry use safe defaults: `bold`, `bullet`, `true`, `true`
- CSS custom properties injected on root `<article>` - child elements reference via `var(--primary-color)` etc.
- `frontend/src/components/ui/` is never modified - template styling targets wrapper elements only

### Server-Side Export Rendering Pipeline

**New `export` package** (does not exist yet - to be created in the Export epic):

```
src/main/java/com/tsvetanbondzhov/resumeenhancer/export/
    ExportController.java        GET /api/v1/resumes/{id}/export?format=pdf|docx
    ExportService.java           Orchestrates resume + template fetch, renderer dispatch
    ExportFormat.java            enum: PDF, DOCX
    DocumentRenderer.java        interface: byte[] render(ResumeDocument, Map<String,Object>)
    PdfRenderer.java             iText 7 implementation
    DocxRenderer.java            Apache POI implementation
```

**Rendering pipeline:**
```
GET /api/v1/resumes/{resumeId}/export?format=pdf
  --> ExportController
  --> ExportService.exportResume(email, resumeId, PDF)
       --> fetch Resume (assert ownership)
       --> fetch ResumeTemplate by templateId  OR use TemplateDefinition.DEFAULT
       --> ObjectMapper.convertValue(templateDefinition, TemplateDefinition.class)
       --> renderers.get(PDF).render(resume.resumeContent(), rawTemplateDefinition)
  --> PdfRenderer.render(ResumeDocument, Map<String,Object>)
       --> deserialize Map -> TemplateDefinition
       --> new PdfDocument + new Document(pdfDoc, resolvePageSize(template))
       --> setMargins from --page-margin-* values
       --> renderHeader(doc, document, template)
       --> for each section in sectionOrder:
             renderSection with titleFormat, itemSeparator, --section-spacing
       --> doc.close() -> baos.toByteArray()
  --> ResponseEntity<byte[]>  Content-Type: application/pdf
      Content-Disposition: attachment; filename="{resume.name}.pdf"
```

**CSS value parsing in PDF renderer:**
```java
private static float toPoints(String cssValue) {
    if (cssValue == null) return 0f;
    if (cssValue.endsWith("px")) return Float.parseFloat(cssValue.replace("px", "")) * 72f / 96f;
    if (cssValue.endsWith("in")) return Float.parseFloat(cssValue.replace("in", "")) * 72f;
    return 0f;
}
```

Only `px` and `in` units are used in `cssVariables`. `rem` and `em` are unsupported and must be rejected on template save.

**`DocumentRenderer` interface:**
```java
public interface DocumentRenderer {
    byte[] render(ResumeDocument document, Map<String, Object> templateDefinition);
}
```

Both `PdfRenderer` and `DocxRenderer` are `@Component` beans; `ExportService` injects both and selects via `Map<ExportFormat, DocumentRenderer>`.

### Shared Template Descriptor Contract

| Contract point | Browser renderer | PDF/DOCX renderer |
|---|---|---|
| `cssVariables` | Inject as `style` on root `<article>` | Parse values; convert units to points |
| `sectionOrder` | Drives render sequence | Drives render sequence |
| `sectionStyles[id]` | Conditional Tailwind classes | iText/POI paragraph settings |
| `headerFormat` | Conditional JSX branch | Dedicated `renderHeader()` branch |
| `atsCompatible` | Ignored (browser) | Enforce safe fonts if `true` |
| Missing `sectionStyle` | Use defaults | Use defaults |
| Null `templateId` | Hardcoded CSS defaults | `TemplateDefinition.DEFAULT` constant |

### V6 Migration Required

`V5__seed_prebuilt_templates.sql` inserts `'{}'` for all three templates. A **V6 migration** must backfill with real definitions once the schema above is finalised in implementation:

```sql
-- V6__backfill_template_definitions.sql
UPDATE resume_templates
SET template_definition = '{ ... minimal definition ... }'::jsonb
WHERE id = '11111111-0000-0000-0000-000000000001';
-- Repeat for Classic (000002) and Modern (000003)
```

This is a data migration only - no DDL change required.

### Risks

1. **CSS unit parsing in PDF renderer** - unsupported units (e.g., `rem`) silently produce `0f`. Mitigation: validate `cssVariables` values on template save in `TemplateService`.
2. **Font availability in iText** - `--font-family-sans: "Inter"` is meaningless without embedded font files. v1 restricts PDF renderer to iText built-in fonts (Helvetica, Times, Courier); `--font-family-sans` is ignored in PDF export in v1.
3. **Template cache invalidation** - if a prebuilt template is updated, cached versions remain stale. Caffeine TTL must be set explicitly (5 minutes recommended) and `@CacheEvict` added to `TemplateService.updateTemplate()`.

---
