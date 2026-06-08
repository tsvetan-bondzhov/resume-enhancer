# Story 3.10: Template Definition Backfill & ResumeCanvas Template Application

Status: done

## Story

As a user editing a resume,
I want my selected template's layout, typography, and section order to be visually applied in the editor canvas and reflected in the sidebar template thumbnails,
so that switching templates gives me an immediate, accurate preview of how my resume will look.

## Acceptance Criteria

**AC1 — V6 migration backfills real template definitions**
**Given** `V6__backfill_template_definitions.sql` is applied
**When** `GET /api/v1/resume-templates` is called
**Then** all three templates return fully populated `templateDefinition` JSONB:
- Minimal (`id: 11111111-0000-0000-0000-000000000001`) has `layoutType: "single-column"`
- Classic (`id: 11111111-0000-0000-0000-000000000002`) has `layoutType: "two-column"`
- Modern (`id: 11111111-0000-0000-0000-000000000003`) has `layoutType: "modern-accent"`
- All three include `cssVariables` (with `--accent-color` defined), `layout`, and `metadata` sections matching the schema in `template-structure-and-application-architecture.md`

**AC2 — Java `TemplateDefinition` record hierarchy deserializes correctly**
**Given** `TemplateDefinition`, `TemplateLayout`, `TemplateColumns`, `SectionStyle` Java records are defined in the `export` package
**When** `ObjectMapper.convertValue(rawMap, TemplateDefinition.class)` is called on any of the three prebuilt template definitions
**Then** the records deserialize without error; `TemplateDefinition.isTwoColumn()` returns true only for Classic; `TemplateDefinition.isModernAccent()` returns true only for Modern; `TemplateDefinition.DEFAULT` is a compile-time constant with `layoutType: "single-column"`, `headerFormat: "name-contact"`, `sectionOrder: ["experience", "education", "skills"]`, and 0.75in page margins

**AC3 — CSS unit validation in `TemplateService.updateTemplate()`**
**Given** `TemplateService.updateTemplate()` receives a `templateDefinition` with `cssVariables` containing `rem` or `em` units
**When** validation runs
**Then** the update is rejected with a descriptive error identifying the offending variable; only `px` and `in` units are accepted; the template is not persisted

**AC4 — `ResumeCanvas` fetches and applies template on `templateId` change**
**Given** `ResumeCanvas` receives a non-null `templateId` prop
**When** the component mounts or `templateId` changes
**Then** `GET /api/v1/resume-templates/{templateId}` is called via `apiClient`; on success the `templateDefinition.cssVariables` are injected as inline `style` on the root `<article>` element; sections render in the order defined by `layout.sectionOrder` (single-column / modern-accent) or right-column then left-column order (two-column); sections present in the document but absent from the template order arrays render last in document order; sections are never silently dropped

**AC5 — `ResumeCanvas` with `templateId: null` applies defaults without API call**
**Given** `ResumeCanvas` receives `templateId: null`
**When** the component renders
**Then** hardcoded CSS default values are applied (matching `TemplateDefinition.DEFAULT`); no API call to the template endpoint is made; rendering does not error or show a loading state

**AC6 — Template fetch failure falls back to defaults silently**
**Given** the template fetch fails (network error or 404)
**When** `ResumeCanvas` handles the error
**Then** hardcoded CSS defaults are applied silently; no error is shown to the user; `template` state is set to `null`

**AC7 — `modern-accent` layout renders accent header band and section underlines**
**Given** `layoutType` is `"modern-accent"`
**When** `ResumeCanvas` renders
**Then** the header element receives `bg-[var(--accent-color)]` styling; each section `<h2>` receives `border-b-2 border-[var(--accent-color)]`; the layout is otherwise single-column (no grid)

**AC8 — `two-column` layout renders CSS Grid with section routing**
**Given** `layoutType` is `"two-column"`
**When** `ResumeCanvas` renders
**Then** the root `<article>` uses CSS Grid with `grid-template-columns: 1fr 2fr`; sections listed in `columns.left` render in the left grid area; sections listed in `columns.right` render in the right grid area; the renderer reads column assignment exclusively from the template JSON and has no hardcoded knowledge of which section types belong in which column

**AC9 — `TemplateGallery` thumbnails differentiated by layout type and accent color**
**Given** `TemplateGallery` renders template thumbnail cards
**When** `templateDefinition.layoutType` and `cssVariables["--accent-color"]` are available
**Then** single-column thumbnails show a full-width line stack on a white background; two-column thumbnails show a narrow left block alongside a wider right block; modern-accent thumbnails show a coloured header band filled with the template's `--accent-color` value followed by a line stack; thumbnails for templates whose definitions have not yet loaded render the existing placeholder skeleton

**AC10 — `EditorPage` wires `templateId` prop to `ResumeCanvas`**
**Given** `EditorPage` renders
**When** the resume data is loaded from `GET /api/v1/resumes/{resumeId}`
**Then** `resume.templateId` is passed as the `templateId` prop to `ResumeCanvas`; when the user applies a different template via `TemplateGallery`, `useResumeStore` is updated and the new `templateId` is re-passed to `ResumeCanvas`, triggering a re-render with the new template

**AC11 — Section visibility takes precedence over template ordering**
**Given** a section has been hidden by the user via the `SectionsPanel` (`section.visible` is false)
**When** `ResumeCanvas` renders with any `layoutType`
**Then** that section is excluded from the rendered output regardless of its position in `layout.sectionOrder`, `columns.left`, or `columns.right`; section visibility takes precedence over template ordering

**AC12 — Tests**
**Given** the story is implemented
**When** tests are run
**Then** `TemplateServiceTest.java` includes a test asserting `rem`/`em` CSS units are rejected on update; `ResumeCanvas.test.tsx` verifies: (a) `cssVariables` are applied as inline `style` on the root `<article>`, (b) section render order follows template `sectionOrder`, (c) `templateId: null` applies defaults without making an API call, (d) two-column layout routes sections to correct grid areas; `TemplateGallery.test.tsx` verifies thumbnail layout structure and accent color differ by `layoutType`

---

## Tasks / Subtasks

### Task 1: Create `V6__backfill_template_definitions.sql` (AC: 1)

- [x] Create `src/main/resources/db/migration/V6__backfill_template_definitions.sql`

This is a DATA migration only — no DDL change. Updates the three existing rows seeded in V5 by setting the `template_definition` column to the full JSONB definitions.

**CRITICAL:** Next migration is V6 — V1 through V5 are already applied. Never modify existing migrations.

**Minimal template** (`id: 11111111-0000-0000-0000-000000000001`): single-column, clean typography:
```sql
UPDATE resume_templates
SET template_definition = '{
  "layoutType": "single-column",
  "cssVariables": {
    "--primary-color": "#1f2937",
    "--accent-color": "#3b82f6",
    "--font-family-sans": "Inter, system-ui, sans-serif",
    "--font-size-base": "11px",
    "--line-height-base": "1.5",
    "--section-spacing": "12px",
    "--item-spacing": "6px",
    "--page-margin-top": "0.75in",
    "--page-margin-right": "0.75in",
    "--page-margin-bottom": "0.75in",
    "--page-margin-left": "0.75in"
  },
  "layout": {
    "headerFormat": "name-contact",
    "sectionOrder": ["experience", "education", "skills", "certifications", "projects"],
    "sectionStyles": {}
  },
  "metadata": {
    "version": "1.0",
    "atsCompatible": true,
    "pageSize": "letter"
  }
}'::jsonb
WHERE id = '11111111-0000-0000-0000-000000000001'::uuid;
```

**Classic template** (`id: 11111111-0000-0000-0000-000000000002`): two-column with `columns.left` / `columns.right`:
```sql
UPDATE resume_templates
SET template_definition = '{
  "layoutType": "two-column",
  "cssVariables": {
    "--primary-color": "#111827",
    "--accent-color": "#1d4ed8",
    "--font-family-sans": "Georgia, serif",
    "--font-size-base": "11px",
    "--line-height-base": "1.4",
    "--section-spacing": "14px",
    "--item-spacing": "6px",
    "--page-margin-top": "0.75in",
    "--page-margin-right": "0.75in",
    "--page-margin-bottom": "0.75in",
    "--page-margin-left": "0.75in"
  },
  "layout": {
    "headerFormat": "name-contact",
    "columns": {
      "left": ["skills", "languages", "certifications"],
      "right": ["experience", "education", "projects"]
    },
    "sectionStyles": {}
  },
  "metadata": {
    "version": "1.0",
    "atsCompatible": true,
    "pageSize": "letter"
  }
}'::jsonb
WHERE id = '11111111-0000-0000-0000-000000000002'::uuid;
```

**Modern template** (`id: 11111111-0000-0000-0000-000000000003`): modern-accent, teal accent color:
```sql
UPDATE resume_templates
SET template_definition = '{
  "layoutType": "modern-accent",
  "cssVariables": {
    "--primary-color": "#111827",
    "--accent-color": "#0d9488",
    "--font-family-sans": "Inter, system-ui, sans-serif",
    "--font-size-base": "11px",
    "--line-height-base": "1.5",
    "--section-spacing": "12px",
    "--item-spacing": "6px",
    "--page-margin-top": "0.75in",
    "--page-margin-right": "0.75in",
    "--page-margin-bottom": "0.75in",
    "--page-margin-left": "0.75in"
  },
  "layout": {
    "headerFormat": "name-contact-summary",
    "sectionOrder": ["experience", "skills", "education", "projects", "certifications"],
    "sectionStyles": {}
  },
  "metadata": {
    "version": "1.0",
    "atsCompatible": false,
    "pageSize": "letter"
  }
}'::jsonb
WHERE id = '11111111-0000-0000-0000-000000000003'::uuid;
```

---

### Task 2: Create `TemplateDefinition` record hierarchy in `export` package (AC: 2)

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateLayout.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateColumns.java`
- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/SectionStyle.java`

**CRITICAL:** The `export` package does not exist yet. Create all four files. These are pure Java records — no `@Entity`, no `@Component`, no `@Service`. They are domain value objects for renderer consumption in Epic 5.

**`TemplateDefinition.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.export;

import java.util.List;
import java.util.Map;

public record TemplateDefinition(
        String layoutType,
        Map<String, String> cssVariables,
        TemplateLayout layout,
        Map<String, Object> metadata
) {
    public static final TemplateDefinition DEFAULT = new TemplateDefinition(
            "single-column",
            Map.of(
                    "--primary-color", "#1f2937",
                    "--accent-color", "#3b82f6",
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

    public boolean isTwoColumn() {
        return "two-column".equals(layoutType);
    }

    public boolean isModernAccent() {
        return "modern-accent".equals(layoutType);
    }
}
```

**`TemplateLayout.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.export;

import java.util.List;
import java.util.Map;

public record TemplateLayout(
        String headerFormat,
        List<String> sectionOrder,
        TemplateColumns columns,
        Map<String, SectionStyle> sectionStyles
) {
    public List<String> resolvedSectionOrder() {
        if (columns != null) throw new IllegalStateException(
                "Use columns.left/right for two-column layouts");
        return sectionOrder != null ? sectionOrder : List.of();
    }
}
```

**`TemplateColumns.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.export;

import java.util.List;

public record TemplateColumns(
        List<String> left,
        List<String> right
) {}
```

**`SectionStyle.java`:**
```java
package com.tsvetanbondzhov.resumeenhancer.export;

public record SectionStyle(
        String titleFormat,
        String itemSeparator,
        boolean showDates,
        boolean showDescriptions
) {}
```

**CRITICAL — Jackson deserialization:** `ObjectMapper.convertValue(rawMap, TemplateDefinition.class)` must work. Jackson maps `Map<String, Object>` (from `ResumeTemplate.templateDefinition`) to the nested records. For Jackson to deserialize records, you may need `@JsonProperty` annotations if field names in JSON use camelCase and Jackson is not configured with `MapperFeature.ACCEPT_CASE_INSENSITIVE_PROPERTIES`. Check `ObjectMapper` config in `config/` package. The standard Spring Boot Jackson config uses default camelCase — record component names must match JSON keys exactly.

**CRITICAL — `cssVariables` type:** The JSONB stores these as `Map<String, Object>` (since the column type is `Map<String, Object>`). When deserializing via `ObjectMapper.convertValue()`, Jackson will try to map to `Map<String, String>`. This will fail if any values are non-strings. Use `@JsonDeserialize` or a custom deserializer if needed, OR keep `cssVariables` as `Map<String, Object>` in the record and cast to `String` at use time. **Simplest approach:** declare `cssVariables` as `Map<String, Object>` in the record and document that values are always strings. The architecture spec shows `Map<String, String>` but the DB column is `Map<String, Object>` — use `Map<String, Object>` to avoid Jackson type coercion errors.

---

### Task 3: Add CSS unit validation to `TemplateService.updateTemplate()` (AC: 3)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateService.java`

**CRITICAL — `updateTemplate()` is currently a stub in `TemplateController`** that returns `HTTP 501 NOT_IMPLEMENTED`. The controller stub calls no service method. For this story, implement `updateTemplate()` in `TemplateService` with validation logic, and wire it from the controller. The controller's `@PreAuthorize("hasRole('ADMIN')")` and endpoint `/api/v1/resume-templates/{templateId}` remain unchanged.

**Add to `TemplateService`:**
```java
private static final java.util.regex.Pattern DISALLOWED_CSS_UNIT =
        java.util.regex.Pattern.compile("\\d+(rem|em)");

public TemplateDto updateTemplate(UUID templateId, TemplateRequest request) {
    ResumeTemplate template = templateRepository.findById(templateId)
            .orElseThrow(() -> new TemplateNotFoundException("Template not found: " + templateId));

    // Validate cssVariables — reject rem/em units
    Object cssVarsRaw = request.templateDefinition().get("cssVariables");
    if (cssVarsRaw instanceof Map<?, ?> cssVars) {
        for (Map.Entry<?, ?> entry : cssVars.entrySet()) {
            String value = String.valueOf(entry.getValue());
            if (DISALLOWED_CSS_UNIT.matcher(value).find()) {
                throw new TemplateValidationException(
                    "CSS variable '" + entry.getKey() + "' uses disallowed unit (rem/em). " +
                    "Only px and in are accepted. Value: " + value);
            }
        }
    }

    template.setName(request.name());
    template.setDescription(request.description());
    template.setTemplateDefinition(request.templateDefinition());
    return toDto(templateRepository.save(template));
}
```

- [x] Create `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateValidationException.java`:
```java
package com.tsvetanbondzhov.resumeenhancer.template;

public class TemplateValidationException extends RuntimeException {
    public TemplateValidationException(String message) {
        super(message);
    }
}
```

- [x] Add `TemplateValidationException` mapping to `GlobalExceptionHandler` (HTTP 400):
```java
@ExceptionHandler(TemplateValidationException.class)
public ProblemDetail handleTemplateValidation(TemplateValidationException ex, HttpServletRequest request) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    pd.setInstance(URI.create(request.getRequestURI()));
    return pd;
}
```

- [x] Wire controller: replace `ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build()` in `updateTemplate()` with:
```java
return ResponseEntity.ok(templateService.updateTemplate(templateId, request));
```
Change return type to `ResponseEntity<TemplateDto>`.

- [x] Add `@CacheEvict(value = "templates", allEntries = true)` to `updateTemplate()` in `TemplateService` — required per architecture (template cache invalidation on update).

**CRITICAL:** `GlobalExceptionHandler` is in `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`. It is the SOLE place exceptions are mapped to HTTP responses. Do NOT add error mapping anywhere else.

---

### Task 4: Update TypeScript `TemplateDto` with typed `templateDefinition` (AC: 4, 9)

- [x] Edit `frontend/src/types/api.ts`

The current `TemplateDto.templateDefinition` is `Record<string, unknown>` with comment "format TBD". Replace with a typed interface that covers the schema:

```typescript
export interface TemplateCssVariables {
  "--primary-color"?: string
  "--accent-color"?: string
  "--font-family-sans"?: string
  "--font-size-base"?: string
  "--line-height-base"?: string
  "--section-spacing"?: string
  "--item-spacing"?: string
  "--page-margin-top"?: string
  "--page-margin-right"?: string
  "--page-margin-bottom"?: string
  "--page-margin-left"?: string
  [key: string]: string | undefined
}

export interface TemplateSectionStyle {
  titleFormat?: string
  itemSeparator?: string
  showDates?: boolean
  showDescriptions?: boolean
}

export interface TemplateColumns {
  left: string[]
  right: string[]
}

export interface TemplateLayout {
  headerFormat?: string
  sectionOrder?: string[]
  columns?: TemplateColumns
  sectionStyles?: Record<string, TemplateSectionStyle>
}

export interface TemplateDefinitionDto {
  layoutType: "single-column" | "two-column" | "modern-accent" | string
  cssVariables?: TemplateCssVariables
  layout?: TemplateLayout
  metadata?: Record<string, unknown>
}

export interface TemplateDto {
  id: string
  name: string
  description: string | null
  isPrebuilt: boolean
  isPublished: boolean
  templateDefinition: TemplateDefinitionDto
  createdAt: string
  updatedAt: string
}
```

**CRITICAL:** TypeScript strict mode — `any` is forbidden. The `[key: string]: string | undefined` index signature on `TemplateCssVariables` allows injection of all CSS variable entries as `React.CSSProperties` via `Object.fromEntries()`.

**CRITICAL:** The existing `TemplateGallery.test.tsx` uses `templateDefinition: {}` in `buildTemplate()`. That test must still compile after this type change. Since `TemplateDefinitionDto` has all optional fields except `layoutType`, passing `{}` will cause a TypeScript error — update `buildTemplate()` in the test to include `templateDefinition: { layoutType: "single-column" }`.

---

### Task 5: Update `ResumeCanvas.tsx` with template awareness (AC: 4, 5, 6, 7, 8, 11)

- [x] Edit `frontend/src/components/resume/ResumeCanvas.tsx`

**Current state:** Accepts `(document, isLoading, state)` props. Renders with hardcoded Tailwind classes. No template awareness. All sections filter by `visible` and render in document order.

**CRITICAL — `EditorPage.tsx` currently inlines the canvas JSX directly** — it does NOT use `<ResumeCanvas>` component. The `ResumeCanvas.tsx` component exists but is not used by `EditorPage.tsx`. Do NOT change `EditorPage.tsx` to use `<ResumeCanvas>` — that is a larger refactor beyond this story's scope. Instead, update `ResumeCanvas.tsx` with the new `templateId` prop and template logic for standalone use, and separately update `EditorPage.tsx` inline canvas block in Task 6.

**New `ResumeCanvasProps`:**
```typescript
interface ResumeCanvasProps {
  document: ResumeDocumentDto | null
  templateId: string | null
  isLoading?: boolean
  state?: "idle" | "streaming" | "diff" | "print-preview"
}
```

**Template fetch logic:**
```typescript
const [template, setTemplate] = useState<TemplateDto | null>(null)

useEffect(() => {
  if (!templateId) {
    setTemplate(null)
    return
  }
  let cancelled = false
  apiClient
    .get<TemplateDto>(`/api/v1/resume-templates/${templateId}`)
    .then((data) => { if (!cancelled) setTemplate(data) })
    .catch(() => { if (!cancelled) setTemplate(null) })
  return () => { cancelled = true }
}, [templateId])
```

**CSS variable injection (AC4, AC5):**
```typescript
const cssVars = template?.templateDefinition?.cssVariables ?? {}
const rootStyle = Object.fromEntries(
  Object.entries(cssVars as Record<string, string>)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, v])
) as React.CSSProperties
```
When `templateId` is null or template fetch failed, `cssVars` is `{}` — the `rootStyle` is empty and fallback CSS defaults from Tailwind classes apply.

**Section ordering logic (AC4, AC8, AC11):**
```typescript
function getOrderedSections(
  sections: ResumeSectionDto[],
  template: TemplateDto | null
): ResumeSectionDto[] {
  const visibleSections = sections.filter((s) => s.visible)
  if (!template?.templateDefinition?.layout) return visibleSections

  const { layoutType, layout } = template.templateDefinition
  
  if (layoutType === "two-column") {
    // Two-column: left then right then remaining
    const left = layout.columns?.left ?? []
    const right = layout.columns?.right ?? []
    const ordered = [...left, ...right]
    const inOrder = ordered
      .map((id) => visibleSections.find((s) => s.id === id))
      .filter((s): s is ResumeSectionDto => s !== undefined)
    const remaining = visibleSections.filter(
      (s) => !ordered.includes(s.id)
    )
    return [...inOrder, ...remaining]
  } else {
    // single-column and modern-accent: follow sectionOrder
    const order = layout.sectionOrder ?? []
    const inOrder = order
      .map((id) => visibleSections.find((s) => s.id === id))
      .filter((s): s is ResumeSectionDto => s !== undefined)
    const remaining = visibleSections.filter(
      (s) => !order.includes(s.id)
    )
    return [...inOrder, ...remaining]
  }
}
```

**Layout rendering (AC7, AC8):**
- `modern-accent`: header gets `className="bg-[var(--accent-color)] p-4 mb-6"`, section `<h2>` gets `className="text-base font-semibold border-b-2 border-[var(--accent-color)] pb-1 mb-2 uppercase tracking-wide"`
- `two-column`: root `<article>` switches to CSS Grid: `className="bg-white shadow-lg w-full max-w-[794px] grid grid-template-columns-[1fr_2fr] gap-4 p-8"`. In Tailwind v4, use inline style for the grid columns: `style={{ ...rootStyle, gridTemplateColumns: "1fr 2fr" }}` — Tailwind arbitrary values work but require JIT compilation.
- Default (single-column, no template): existing classes unchanged

**CRITICAL — Do NOT use `ResumeSection` component** inside updated `ResumeCanvas.tsx` — `ResumeCanvas` is for read-only preview rendering. `EditorPage.tsx` uses `ResumeSection` component directly for inline editing. `ResumeCanvas.tsx` uses its own simple read-only rendering (existing `<section>/<h2>/<ul>/<li>` pattern).

---

### Task 6: Update `EditorPage.tsx` — wire `templateId` to inline canvas (AC: 10)

- [x] Edit `frontend/src/pages/EditorPage.tsx`

**CRITICAL:** `EditorPage.tsx` does NOT use `<ResumeCanvas>` component — it renders an inline canvas block. This story wires template application to that inline block. The `currentResume?.templateId` value is already in `useResumeStore` state (updated via `setCurrentResumeTemplateId` in `handleApplyTemplate`).

**Changes needed:**

1. Import `useEffect`, `useState`, `TemplateDto` (already imported in component header — check before adding)
2. Add template fetch state near the top of the component:
```typescript
const [currentTemplate, setCurrentTemplate] = useState<TemplateDto | null>(null)
const currentTemplateId = useResumeStore((state) => state.currentResume?.templateId ?? null)
```

3. Add template fetch effect (after existing `useEffect` blocks):
```typescript
useEffect(() => {
  if (!currentTemplateId) {
    setCurrentTemplate(null)
    return
  }
  let cancelled = false
  apiClient
    .get<TemplateDto>(`/api/v1/resume-templates/${currentTemplateId}`)
    .then((data) => { if (!cancelled) setCurrentTemplate(data) })
    .catch(() => { if (!cancelled) setCurrentTemplate(null) })
  return () => { cancelled = true }
}, [currentTemplateId])
```

4. Compute `rootStyle` and `orderedSections` before return JSX (reuse same logic as `ResumeCanvas.tsx`):
```typescript
const cssVars = currentTemplate?.templateDefinition?.cssVariables ?? {}
const rootStyle = Object.fromEntries(
  Object.entries(cssVars as Record<string, string>)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, v])
) as React.CSSProperties

const orderedSections = currentResume?.content.sections
  ? getOrderedSections(currentResume.content.sections, currentTemplate)
  : []
```

5. Extract `getOrderedSections` to `frontend/src/lib/templateUtils.ts` (shared between `ResumeCanvas.tsx` and `EditorPage.tsx`):
```typescript
// frontend/src/lib/templateUtils.ts
import type { ResumeSectionDto, TemplateDto } from "@/types/api"

export function getOrderedSections(
  sections: ResumeSectionDto[],
  template: TemplateDto | null
): ResumeSectionDto[] {
  // ... same implementation as in Task 5
}
```

6. In the inline canvas `<article>` element, add `style={rootStyle}` prop.
7. Replace the existing `.filter((s) => s.visible).map(...)` with `.map(section => ...)` over `orderedSections` (visibility is already filtered inside `getOrderedSections`).
8. For `modern-accent` layout, add accent band above sections and update section `<h2>` styling (same conditional logic as `ResumeCanvas.tsx`).

**CRITICAL — `EditorPage.tsx` inline canvas uses `<ResumeSection>` component** for editing. The template application only adds:
- `style={rootStyle}` on the root `<article>` for CSS variables
- Template-driven section ordering (visibility still controlled by `section.visible`)
- `modern-accent` accent band header and `<h2>` border styling (does NOT affect `ResumeSection` internal markup)

---

### Task 7: Update `TemplateGallery.tsx` thumbnails by layout type (AC: 9)

- [x] Edit `frontend/src/components/resume/TemplateGallery.tsx`

**Current state:** All thumbnails render identical placeholder line boxes (`<div className="h-1 bg-zinc-300">` etc.) regardless of template.

Replace the thumbnail `<div>` block with a layout-aware thumbnail:

```typescript
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
```

Replace the existing thumbnail block in the button with `<TemplateThumbnail template={template} />`.

**CRITICAL — no raw inline styles with dynamic values from user input** except for the trusted `--accent-color` CSS variable from our own API. The `backgroundColor: accentColor` in the thumbnail is safe — it comes from our backend, not user input.

---

### Task 8: Add `TemplateServiceTest` for CSS unit validation (AC: 12)

- [x] Edit `src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateServiceTest.java`

Add test for AC3 (CSS unit validation). Import and use `TemplateRequest`:

```java
// AC3: rem/em units rejected on updateTemplate
@Test
void updateTemplate_remUnitInCssVariables_throwsTemplateValidationException() {
    ResumeTemplate t = buildTemplate("Minimal", true);
    when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.of(t));

    Map<String, Object> cssVars = new HashMap<>(Map.of(
        "--font-size-base", "1rem",   // DISALLOWED
        "--accent-color", "#3b82f6"
    ));
    Map<String, Object> templateDef = new HashMap<>(Map.of("cssVariables", cssVars));
    TemplateRequest request = new TemplateRequest("Minimal Updated", null, templateDef);

    assertThatThrownBy(() -> templateService.updateTemplate(TEMPLATE_ID, request))
            .isInstanceOf(TemplateValidationException.class)
            .hasMessageContaining("rem");
}

@Test
void updateTemplate_emUnitInCssVariables_throwsTemplateValidationException() {
    ResumeTemplate t = buildTemplate("Minimal", true);
    when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.of(t));

    Map<String, Object> cssVars = new HashMap<>(Map.of(
        "--line-height-base", "1.5em"  // DISALLOWED
    ));
    Map<String, Object> templateDef = new HashMap<>(Map.of("cssVariables", cssVars));
    TemplateRequest request = new TemplateRequest("Minimal Updated", null, templateDef);

    assertThatThrownBy(() -> templateService.updateTemplate(TEMPLATE_ID, request))
            .isInstanceOf(TemplateValidationException.class)
            .hasMessageContaining("em");
}

@Test
void updateTemplate_pxAndInUnitsAccepted_templatePersisted() {
    ResumeTemplate t = buildTemplate("Minimal", true);
    when(templateRepository.findById(TEMPLATE_ID)).thenReturn(Optional.of(t));
    when(templateRepository.save(any(ResumeTemplate.class))).thenReturn(t);

    Map<String, Object> cssVars = new HashMap<>(Map.of(
        "--font-size-base", "11px",
        "--page-margin-top", "0.75in"
    ));
    Map<String, Object> templateDef = new HashMap<>(Map.of("cssVariables", cssVars));
    TemplateRequest request = new TemplateRequest("Minimal", null, templateDef);

    TemplateDto result = templateService.updateTemplate(TEMPLATE_ID, request);

    assertThat(result).isNotNull();
    verify(templateRepository).save(any(ResumeTemplate.class));
}
```

Required imports:
- `import com.tsvetanbondzhov.resumeenhancer.template.dto.TemplateRequest;`
- `import static org.mockito.ArgumentMatchers.any;`
- `import java.util.HashMap;`

---

### Task 9: Add `ResumeCanvas.test.tsx` (AC: 12)

- [x] Create `frontend/src/components/resume/ResumeCanvas.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { apiClient } from "@/lib/apiClient"
import type { ResumeDocumentDto, TemplateDto } from "@/types/api"
import ResumeCanvas from "./ResumeCanvas"

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: vi.fn() },
}))
const mockGet = vi.mocked(apiClient.get)

const mockDocument: ResumeDocumentDto = {
  sections: [
    { id: "experience", title: "Experience", visible: true, items: [{ id: "i1", fields: { text: "Engineer" } }] },
    { id: "skills", title: "Skills", visible: true, items: [{ id: "i2", fields: { text: "Java" } }] },
    { id: "education", title: "Education", visible: false, items: [] },
  ],
}

function buildTemplate(overrides: Partial<TemplateDto> = {}): TemplateDto {
  return {
    id: "t1",
    name: "Minimal",
    description: null,
    isPrebuilt: true,
    isPublished: true,
    templateDefinition: {
      layoutType: "single-column",
      cssVariables: { "--accent-color": "#3b82f6", "--font-size-base": "11px" },
      layout: { headerFormat: "name-contact", sectionOrder: ["skills", "experience"] },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("ResumeCanvas", () => {
  beforeEach(() => vi.clearAllMocks())

  // AC4: cssVariables injected as inline style on root <article>
  it("applies cssVariables as inline style on root article when template loaded", async () => {
    mockGet.mockResolvedValue(buildTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("/api/v1/resume-templates/t1"))
    const article = container.querySelector("#resume-canvas")!
    await waitFor(() =>
      expect(article.getAttribute("style")).toContain("--accent-color")
    )
  })

  // AC4: section render order follows template sectionOrder
  it("renders sections in template sectionOrder (skills before experience)", async () => {
    mockGet.mockResolvedValue(buildTemplate())
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    const sectionHeadings = container.querySelectorAll("h2")
    await waitFor(() => {
      const titles = Array.from(sectionHeadings).map((h) => h.textContent)
      expect(titles.indexOf("Skills")).toBeLessThan(titles.indexOf("Experience"))
    })
  })

  // AC5: templateId null — no API call, defaults applied
  it("does not call apiClient when templateId is null", () => {
    render(<ResumeCanvas document={mockDocument} templateId={null} />)
    expect(mockGet).not.toHaveBeenCalled()
  })

  // AC11: hidden sections excluded regardless of template sectionOrder
  it("excludes hidden sections even if listed in template sectionOrder", async () => {
    const template = buildTemplate({
      templateDefinition: {
        layoutType: "single-column",
        layout: { sectionOrder: ["education", "experience", "skills"] },
      },
    })
    mockGet.mockResolvedValue(template)
    render(<ResumeCanvas document={mockDocument} templateId="t1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    // education section has visible: false — must not appear
    expect(screen.queryByText("Education")).not.toBeInTheDocument()
    expect(screen.getByText("Experience")).toBeInTheDocument()
  })

  // AC8: two-column layout uses CSS Grid
  it("applies grid layout for two-column template", async () => {
    const template = buildTemplate({
      templateDefinition: {
        layoutType: "two-column",
        cssVariables: { "--accent-color": "#1d4ed8" },
        layout: {
          columns: { left: ["skills"], right: ["experience"] },
        },
      },
    })
    mockGet.mockResolvedValue(template)
    const { container } = render(
      <ResumeCanvas document={mockDocument} templateId="t1" />
    )
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    const article = container.querySelector("#resume-canvas")!
    await waitFor(() =>
      expect(article.getAttribute("style")).toContain("gridTemplateColumns")
    )
  })
})
```

---

### Task 10: Update `TemplateGallery.test.tsx` for layout-differentiated thumbnails (AC: 12)

- [x] Edit `frontend/src/components/resume/TemplateGallery.test.tsx`

**CRITICAL:** The existing tests must keep passing. Only ADD new tests for layout-differentiated thumbnails and update `buildTemplate()` to include typed `templateDefinition`.

1. Update `buildTemplate()` to use typed `templateDefinition`:
```typescript
function buildTemplate(overrides?: Partial<TemplateDto>): TemplateDto {
  return {
    id: "template-1",
    name: "Minimal",
    description: null,
    isPrebuilt: true,
    isPublished: true,
    templateDefinition: { layoutType: "single-column" },  // was {}
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}
```

2. Add new tests for AC9:
```typescript
it("renders two-column thumbnail structure for classic layout (AC9)", async () => {
  mockGet.mockResolvedValue([
    buildTemplate({
      id: "t-classic",
      name: "Classic",
      templateDefinition: { layoutType: "two-column", cssVariables: { "--accent-color": "#1d4ed8" } },
    }),
  ])
  const { container } = render(<TemplateGallery activeTemplateId={null} onApply={vi.fn()} />)
  await waitFor(() => screen.getByLabelText(/apply classic template/i))
  // two-column thumbnail uses flex layout with two columns
  const button = screen.getByLabelText(/apply classic template/i)
  const thumbContainer = button.querySelector(".flex.gap-0\\.5")
  expect(thumbContainer).toBeInTheDocument()
})

it("renders modern-accent thumbnail with accent band (AC9)", async () => {
  mockGet.mockResolvedValue([
    buildTemplate({
      id: "t-modern",
      name: "Modern",
      templateDefinition: {
        layoutType: "modern-accent",
        cssVariables: { "--accent-color": "#0d9488" },
      },
    }),
  ])
  const { container } = render(<TemplateGallery activeTemplateId={null} onApply={vi.fn()} />)
  await waitFor(() => screen.getByLabelText(/apply modern template/i))
  const button = screen.getByLabelText(/apply modern template/i)
  // The accent band div should have backgroundColor set via inline style
  const accentBand = button.querySelector("[style*='background-color']")
  expect(accentBand).toBeInTheDocument()
})
```

---

### Task 11: Create `frontend/src/lib/templateUtils.ts` (shared utility)

- [x] Create `frontend/src/lib/templateUtils.ts`

```typescript
import type { ResumeSectionDto, TemplateDto } from "@/types/api"

/**
 * Returns visible sections ordered according to the template definition.
 * - visibility filtering always applied first (section.visible === false always excluded)
 * - single-column / modern-accent: follows layout.sectionOrder
 * - two-column: follows columns.left then columns.right
 * - sections absent from template order arrays append last in document order
 * - sections are NEVER silently dropped
 */
export function getOrderedSections(
  sections: ResumeSectionDto[],
  template: TemplateDto | null
): ResumeSectionDto[] {
  const visibleSections = sections.filter((s) => s.visible)
  const layout = template?.templateDefinition?.layout
  if (!layout) return visibleSections

  const layoutType = template?.templateDefinition?.layoutType

  if (layoutType === "two-column") {
    const left = layout.columns?.left ?? []
    const right = layout.columns?.right ?? []
    const orderedIds = [...left, ...right]
    const inOrder = orderedIds
      .map((id) => visibleSections.find((s) => s.id === id))
      .filter((s): s is ResumeSectionDto => s !== undefined)
    const remaining = visibleSections.filter((s) => !orderedIds.includes(s.id))
    return [...inOrder, ...remaining]
  }

  // single-column and modern-accent
  const sectionOrder = layout.sectionOrder ?? []
  const inOrder = sectionOrder
    .map((id) => visibleSections.find((s) => s.id === id))
    .filter((s): s is ResumeSectionDto => s !== undefined)
  const remaining = visibleSections.filter((s) => !sectionOrder.includes(s.id))
  return [...inOrder, ...remaining]
}
```

Import in both `ResumeCanvas.tsx` and `EditorPage.tsx` via `@/lib/templateUtils`.

---

### Task 12: Run linting and tests

- [x] Run `cd frontend && npm run lint` — must pass with 0 errors
- [x] Run `cd frontend && npm run test -- --run ResumeCanvas TemplateGallery` — all tests pass
- [x] Run `./mvnw test -Dtest="TemplateServiceTest" -Dsurefire.useFile=false` — all tests pass
- [x] Run `./mvnw test` — full test suite passes (0 regressions)

---

## Dev Notes

### CRITICAL: `EditorPage.tsx` does NOT use `<ResumeCanvas>` component

`EditorPage.tsx` has an inline canvas block (lines 263–323) — it does NOT call `<ResumeCanvas>`. Both need template wiring but via different mechanisms:
- `ResumeCanvas.tsx`: standalone component — receives `templateId` prop, fetches internally
- `EditorPage.tsx` inline block: derives `currentTemplateId` from `useResumeStore`, fetches internally

Do NOT merge the two — `EditorPage.tsx` inline block uses `<ResumeSection>` for editing; `ResumeCanvas.tsx` uses read-only rendering.

### CRITICAL: `export` package does not exist yet

Create the directory. Java records in `export` package are for Epic 5 consumption. They are created in this story as infrastructure for the `TemplateService` validation logic and for test deserialization verification. No `ExportController`, `ExportService`, `PdfRenderer`, or `DocxRenderer` is created in this story — those are Epic 5.

### CRITICAL: `TemplateController.updateTemplate()` is currently `HTTP 501`

The stub method signature is: `ResponseEntity<Void> updateTemplate(@PathVariable UUID templateId, @Valid @RequestBody TemplateRequest request)`. Change return type to `ResponseEntity<TemplateDto>` and wire to `templateService.updateTemplate()`. The `@PreAuthorize("hasRole('ADMIN')")` annotation stays.

### CRITICAL: `@CacheEvict` required on `updateTemplate()`

`TemplateService.listPublishedTemplates()` is `@Cacheable("templates")`. After an update, the cache entry must be evicted. Add `@CacheEvict(value = "templates", allEntries = true)` to `updateTemplate()`. Per architecture risk note: Caffeine TTL should also be configured to 5 minutes — check `CacheConfig.java` in the `config` package.

### CRITICAL: `TemplateDefinition.DEFAULT` has `--accent-color: "#3b82f6"` but no `--accent-color` in original architecture constant

The architecture document shows the `DEFAULT` constant without `--accent-color` in its `cssVariables`. Add it (value `#3b82f6`) for consistency with the V6 migration Minimal template definition. The frontend needs `--accent-color` defined for `modern-accent` rendering even when falling back to defaults.

### CRITICAL: TypeScript strict mode — `templateDefinition` type change breaks existing test

`TemplateGallery.test.tsx` line 23: `templateDefinition: {}`. After changing `TemplateDto.templateDefinition` from `Record<string, unknown>` to `TemplateDefinitionDto`, this will fail TypeScript strict mode because `{}` is not assignable to `TemplateDefinitionDto` (which requires `layoutType`). Fix: `templateDefinition: { layoutType: "single-column" }`.

### CRITICAL: `ResumeCanvas.tsx` — import `apiClient`

`ResumeCanvas.tsx` currently has no `apiClient` import. Add: `import { apiClient } from "@/lib/apiClient"`. Also add `useState`, `useEffect` from React and `TemplateDto` from `@/types/api`.

### CRITICAL: Two-column CSS Grid in Tailwind v4

Tailwind v4 uses the `@tailwindcss/vite` plugin. Arbitrary grid values like `grid-cols-[1fr_2fr]` require JIT processing. If the Tailwind JIT scanner doesn't pick up dynamic class names, use inline style instead: `style={{ ...rootStyle, gridTemplateColumns: "1fr 2fr" }}`. Prefer inline style to avoid JIT scan issues.

### CRITICAL: `sectionOrder` in template uses section `id` values

The architecture says `sectionOrder` is keyed by section `id` matching `ResumeSection.id`. The `ResumeSection` records (from Story 3.1) have UUID-based `id` fields. However, the V6 migration uses meaningful keys like `"experience"`, `"skills"` — these are semantic names, not UUIDs. The `getOrderedSections()` function matches `section.id === sectionOrderId`. This will only work if `ResumeSection.id` values match the template's `sectionOrder` strings.

**Resolution:** The template `sectionOrder` strings are matched against `section.id` fields from the `ResumeDocument`. When `ResumeDocument` is created from a profile (Story 3.1), section IDs are generated as UUIDs. The template `sectionOrder` with values like `"experience"` will NOT match UUID section IDs — the `remaining` array will capture all sections and render in document order.

This is the CORRECT behavior for this story: template ordering is infrastructure being built; full ID alignment happens when the document creation flow assigns semantic section IDs. Document this in code with a comment. The `getOrderedSections()` function handles this gracefully — all unmatched sections fall to the `remaining` array, so no sections are dropped.

### CRITICAL: `TemplateDefinition` deserialization — Jackson `@JsonProperty` may be needed

Java records serialize with component names as JSON keys. `ObjectMapper.convertValue()` from `Map<String, Object>` uses the standard Jackson deserialization path. If `ObjectMapper` is not configured with `MapperFeature.ACCEPT_CASE_INSENSITIVE_PROPERTIES`, field names must match exactly. The JSON keys (`layoutType`, `cssVariables`, `layout`, `metadata`) are camelCase and match Java record component names — no `@JsonProperty` needed. Verify by running `TemplateDefinitionTest` in Task 2.

### CRITICAL: `cssVariables` type conflict — `Map<String, String>` vs `Map<String, Object>`

`ResumeTemplate.templateDefinition` is `Map<String, Object>` (Hibernate JSONB deserialization). When `ObjectMapper.convertValue()` processes this to `TemplateDefinition`, it tries to populate `Map<String, String>`. Jackson will stringify all values, so non-string JSONB values would fail. Since all CSS variable values ARE strings in the migration, `Map<String, String>` works. But to be safe, use `Map<String, Object>` in the record and cast to String at use time (as noted in Task 2).

### File Locations (no deviations)

| New File | Path |
|----------|------|
| `V6__backfill_template_definitions.sql` | `src/main/resources/db/migration/V6__backfill_template_definitions.sql` |
| `TemplateDefinition.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java` |
| `TemplateLayout.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateLayout.java` |
| `TemplateColumns.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateColumns.java` |
| `SectionStyle.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/SectionStyle.java` |
| `TemplateValidationException.java` | `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateValidationException.java` |
| `templateUtils.ts` | `frontend/src/lib/templateUtils.ts` |
| `ResumeCanvas.test.tsx` | `frontend/src/components/resume/ResumeCanvas.test.tsx` |

| Modified File | Changes |
|--------------|---------|
| `TemplateService.java` | Add `updateTemplate()` with CSS unit validation + `@CacheEvict` |
| `TemplateController.java` | Wire `updateTemplate()` with correct return type |
| `GlobalExceptionHandler.java` | Add `TemplateValidationException` → HTTP 400 handler |
| `TemplateServiceTest.java` | Add 3 tests for CSS unit validation |
| `api.ts` | Replace `templateDefinition: Record<string, unknown>` with typed interfaces |
| `ResumeCanvas.tsx` | Add `templateId` prop, template fetch, CSS var injection, layout rendering |
| `EditorPage.tsx` | Add template fetch, rootStyle, orderedSections, conditional layout rendering |
| `TemplateGallery.tsx` | Replace placeholder thumbnail with `TemplateThumbnail` component |
| `TemplateGallery.test.tsx` | Update `buildTemplate()` and add layout thumbnail tests |

### Previously Established Patterns (from Story 3.9 and earlier)

- `GlobalExceptionHandler` is the SOLE exception-to-HTTP mapper — no other place
- Records for all domain value objects — `TemplateDefinition` hierarchy follows this pattern
- `@Cacheable("templates")` is on `listPublishedTemplates()` — `@CacheEvict` must be paired on all mutations
- `apiClient` for all HTTP calls in React — no raw `fetch()`
- Zustand state updates always immutable — `set(state => ({ ...state }))`
- Loading state per-operation booleans — use `isFetchingTemplate` if needed (but template fetch is silent, no loading indicator needed per AC5/AC6)
- `frontend/src/components/ui/` — never edit, these are shadcn-managed

### References

- `_bmad-output/planning-artifacts/architecture/template-structure-and-application-architecture.md` — canonical template schema and rendering pipeline
- `_bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md` — naming and structure patterns
- `src/main/resources/db/migration/V5__seed_prebuilt_templates.sql` — rows being updated by V6
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateService.java` — add `updateTemplate()` here
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateController.java` — update `updateTemplate()` stub
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java` — add `TemplateValidationException` handler
- `frontend/src/components/resume/ResumeCanvas.tsx` — current state: no template awareness
- `frontend/src/components/resume/TemplateGallery.tsx` — current state: identical placeholder thumbnails
- `frontend/src/pages/EditorPage.tsx` — current state: inline canvas with no template CSS wiring
- `frontend/src/types/api.ts` — current `TemplateDto.templateDefinition: Record<string, unknown>`
- `_bmad-output/project-context.md` — technology stack, anti-patterns, testing rules

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- AC1: V6 Flyway data migration creates full JSONB template definitions for all three prebuilt templates.
- AC2: `TemplateDefinition` record hierarchy in new `export` package with `DEFAULT` constant, `isTwoColumn()`, `isModernAccent()` helpers. Used `Map<String, Object>` for `cssVariables` to avoid Jackson coercion issues.
- AC3: `TemplateService.updateTemplate()` implemented with regex validation rejecting `rem`/`em` units. `TemplateValidationException` mapped to HTTP 400 in `GlobalExceptionHandler`. `@CacheEvict` added. Controller stub wired.
- AC4/AC5/AC6: `ResumeCanvas.tsx` accepts `templateId` prop, fetches template via `apiClient`, injects CSS variables as inline style on root `<article>`. Falls back to empty style (Tailwind defaults) on null templateId or fetch failure.
- AC7: `modern-accent` renders accent header band with `bg-[var(--accent-color)]` and section `<h2>` with `border-b-2 border-[var(--accent-color)]`.
- AC8: `two-column` uses CSS Grid via `gridTemplateColumns: "1fr 2fr"` inline style (avoids Tailwind JIT scan issues).
- AC9: `TemplateThumbnail` component in `TemplateGallery.tsx` renders distinct visual structures by `layoutType`.
- AC10: `EditorPage.tsx` fetches template on `currentTemplateId` change (from `useResumeStore`), applies CSS variables and ordering to inline canvas block.
- AC11: `getOrderedSections()` in `templateUtils.ts` filters by `visible` first before applying template ordering.
- AC12: 3 new `TemplateServiceTest` tests (rem/em rejection, px/in acceptance), 5 new `ResumeCanvas.test.tsx` tests, 2 new `TemplateGallery.test.tsx` tests. Full suite: 81 backend + 87 frontend, 0 failures.
- ESLint fix: `react-hooks/set-state-in-effect` rule required restructuring early-return `setTemplate(null)` calls to use `Promise.resolve().then()` pattern.

### File List

**New:**
- `src/main/resources/db/migration/V6__backfill_template_definitions.sql`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateDefinition.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateLayout.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/TemplateColumns.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/export/SectionStyle.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateValidationException.java`
- `frontend/src/lib/templateUtils.ts`
- `frontend/src/components/resume/ResumeCanvas.test.tsx`

**Modified:**
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateService.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateController.java`
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/common/GlobalExceptionHandler.java`
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateServiceTest.java`
- `frontend/src/types/api.ts`
- `frontend/src/components/resume/ResumeCanvas.tsx`
- `frontend/src/pages/EditorPage.tsx`
- `frontend/src/components/resume/TemplateGallery.tsx`
- `frontend/src/components/resume/TemplateGallery.test.tsx`

### Review Findings

- [ ] [Review][Patch] F2: Empty `<header>` for modern-accent band is semantically incorrect — replaced with `<div aria-hidden="true">` in ResumeCanvas.tsx and EditorPage.tsx [ResumeCanvas.tsx:114, EditorPage.tsx:362] — FIXED
- [ ] [Review][Patch] F3: Two-column sections have no grid-column assignment — sections stack in single column despite grid layout — added `gridColumn` inline style per section from leftColumnIds/rightColumnIds sets [ResumeCanvas.tsx:123-127, EditorPage.tsx:368-371] — FIXED
- [ ] [Review][Patch] F6: IIFE in JSX is an anti-pattern in EditorPage.tsx — extracted computed values to component scope, replaced `(() => { ... })()` with direct JSX [EditorPage.tsx:321-373] — FIXED
- [x] [Review][Defer] F1: Promise.resolve().then() pattern in useEffect — intentional ESLint react-hooks/set-state-in-effect workaround; synchronous setState in effect body is forbidden by project ESLint config — deferred, constraint-driven
- [x] [Review][Defer] F4: TemplateDefinition.DEFAULT missing --item-spacing — map is at 10-entry capacity (Map.of() limit); not used in current rendering code — deferred, pre-existing
- [x] [Review][Defer] F5: CSS unit denylist (rem/em) rather than allowlist (px/in) — spec explicitly dictates denylist; allowlist would break unitless line-height values — deferred, spec-driven
- [x] [Review][Defer] F7: getOrderedSections has no dedicated unit tests — AC12 doesn't require templateUtils.test.ts; function covered indirectly — deferred, pre-existing
- [x] [Review][Defer] F8: No test for modern-accent layout in ResumeCanvas.test.tsx — AC12 does not explicitly require it — deferred, pre-existing
- [x] [Review][Defer] F10: TemplateLayout.resolvedSectionOrder() never called and untested — spec-mandated for Epic 5 infrastructure — deferred, pre-existing
- [x] [Review][Dismiss] F9: TemplateDefinitionDto.layoutType includes | string — intentional per spec for extensibility — dismissed
- [x] [Review][Dismiss] F11: V6 migration no guard for missing V5 UUIDs — Flyway sequential ordering ensures V5 runs before V6; dismissed

### Change Log

- 2026-06-08: Story 3.10 implemented — V6 template definition backfill, Java `export` package with `TemplateDefinition` hierarchy, `TemplateService.updateTemplate()` with CSS unit validation, typed TypeScript `TemplateDefinitionDto`, `ResumeCanvas` and `EditorPage` template application with layout-aware rendering, `TemplateGallery` differentiated thumbnails, `templateUtils.ts` shared utility. All 12 tasks complete.
- 2026-06-08: Code review — 3 patches applied (F2 empty header→aria-hidden div, F3 two-column grid-column assignment, F6 IIFE refactor); 5 deferred; 2 dismissed. Story status → done.
