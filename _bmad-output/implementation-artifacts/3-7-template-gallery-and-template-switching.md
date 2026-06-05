# Story 3.7: Template Gallery & Template Switching

Status: done

## Story

As an authenticated user,
I want to browse the prebuilt template library and apply a template to my resume,
So that I can choose a layout that matches my career goals or personal style.

## Acceptance Criteria

**AC1 — Template gallery renders in sidebar**
**Given** the user opens the `TemplateGallery` from the editor sidebar
**When** the gallery renders
**Then** all published prebuilt templates are fetched from `GET /api/v1/resume-templates` and displayed as thumbnail cards in a visual grid with filter tabs: All / Minimal / Classic / Modern (UX-DR10)

**AC2 — Hover preview and active highlight**
**Given** the user hovers over a template thumbnail
**When** the hover state activates
**Then** a ring/border "active" highlight appears on hover; the currently applied template has an "Active" label/badge

**AC3 — One-click apply with `PUT /api/v1/resumes/{id}`**
**Given** the user clicks a template thumbnail
**When** the template is applied
**Then** `PUT /api/v1/resumes/{id}` is called with the new `templateId` alongside the current `name` and `content`; `useResumeStore` `currentResume.templateId` is updated; `ResumeCanvas` re-renders immediately (the current implementation renders identically for all templates — the re-render satisfies the story, per-template styling is an Epic 5/7 concern); a Toast "Template applied" is shown

**AC4 — Skeleton while loading**
**Given** the template list is loading
**When** the API call is in progress
**Then** skeleton placeholder cards are shown in the gallery grid

**AC5 — Currently active template highlighted on open**
**Given** a template was previously applied to a resume
**When** the user opens the template gallery
**Then** the currently active template (`currentResume.templateId`) is highlighted with the active selection style (UX-DR10)

**AC6 — Backend: `UpdateResumeRequest` extended with `templateId`**
**Given** `PUT /api/v1/resumes/{resumeId}` is called with a body including `templateId`
**When** the request is processed
**Then** `resume.templateId` is updated in the database; HTTP 200 is returned with the updated `ResumeDto` including the new `templateId`; name and content are unchanged

## Tasks / Subtasks

---

### Task 1: Backend — Extend `UpdateResumeRequest` to include `templateId` (AC: 6)

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/UpdateResumeRequest.java`
- [x] Add nullable `templateId` field:
  ```java
  public record UpdateResumeRequest(
          @NotBlank String name,
          @NotNull ResumeDocument content,
          UUID templateId   // nullable — null means "keep current"; omit @NotNull intentionally
  ) {}
  ```
  The field is a `java.util.UUID` (nullable). No `@NotNull` — null means "no change to template." Jackson deserializes a missing or `null` JSON key as `null`.

- [x] Edit `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` — update `updateResume` to persist `templateId`:
  ```java
  @Transactional
  public ResumeDto updateResume(String email, UUID resumeId, UpdateResumeRequest request) {
      User user = resolveUser(email);
      Resume resume = resumeRepository.findByIdAndUser(resumeId, user)
              .orElseThrow(() -> new ResumeAccessDeniedException("Access denied or resume not found"));
      resume.setName(request.name());
      resume.setResumeContent(request.content());
      // Only overwrite templateId when explicitly provided — null means "keep existing"
      if (request.templateId() != null) {
          resume.setTemplateId(request.templateId());
      }
      return toDto(resumeRepository.save(resume));
  }
  ```
  **IMPORTANT:** This is an additive change. Existing callers (autosave, Save As) that do NOT send `templateId` will receive `null` in the record, which means `templateId` is unchanged. No regressions.

- [x] Edit `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java` — add test for template switch:
  ```java
  @Test
  void updateResume_updatesTemplateId_whenProvided() {
      // Arrange: existing resume with templateId = null
      // Act: call updateResume with request that includes a non-null templateId
      // Assert: resume.getTemplateId() equals the provided UUID
  }

  @Test
  void updateResume_preservesTemplateId_whenNull() {
      // Arrange: existing resume with templateId = someUuid
      // Act: call updateResume with request.templateId = null
      // Assert: resume.getTemplateId() still equals someUuid (unchanged)
  }
  ```
  Follow existing `@ExtendWith(MockitoExtension.class)` pattern in `ResumeServiceTest.java`.

---

### Task 2: Frontend — Update `useAutosave` to send `templateId` (AC: 3, 6)

- [x] Edit `frontend/src/hooks/useAutosave.ts`
- [x] The autosave PUT body currently sends `{ name, content }`. Extend it to also send `templateId`:
  ```typescript
  apiClient
    .put<ResumeDto>(`/api/v1/resumes/${resumeId}`, {
      name: doc.name,
      content: doc.content,
      templateId: doc.templateId ?? null,
    })
  ```
- [x] **Do NOT change** the dirty-check logic or debounce behavior — this is a one-line addition to the request body only.
- [x] The `useAutosave.test.ts` file does not need updating because it mocks `apiClient.put` to `new Promise(() => {})` and does not assert on the request body. Verify this is still true before skipping.

---

### Task 3: Frontend — Add `setCurrentResumeTemplateId` action to `useResumeStore` (AC: 3, 5)

- [x] Edit `frontend/src/stores/useResumeStore.ts`
- [x] Add to `ResumeState` interface:
  ```typescript
  setCurrentResumeTemplateId: (templateId: string | null) => void
  ```
- [x] Implement (additive only — do NOT modify any existing actions):
  ```typescript
  setCurrentResumeTemplateId: (templateId) =>
    set((state) => {
      if (!state.currentResume) return state
      return {
        ...state,
        currentResume: { ...state.currentResume, templateId },
      }
    }),
  ```
- [x] **Do NOT remove or change** any existing action — this is a single additive method.

---

### Task 4: Frontend — Create `TemplateGallery.tsx` component (AC: 1, 2, 4, 5)

- [x] Create `frontend/src/components/resume/TemplateGallery.tsx`

**Props interface:**
```typescript
interface TemplateGalleryProps {
  activeTemplateId: string | null
  onApply: (templateId: string) => void
}
```

**Imports:**
```typescript
import { useState, useEffect } from "react"
import { apiClient } from "@/lib/apiClient"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { TemplateDto } from "@/types/api"
```

**Full implementation:**
```tsx
export default function TemplateGallery({
  activeTemplateId,
  onApply,
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<TemplateDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    let cancelled = false
    apiClient.get<TemplateDto[]>("/api/v1/resume-templates").then((data) => {
      if (!cancelled) {
        setTemplates(data)
        setIsLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const FILTER_TABS = ["all", "minimal", "classic", "modern"] as const
  type FilterTab = typeof FILTER_TABS[number]

  const filteredTemplates = (tab: FilterTab) =>
    tab === "all"
      ? templates
      : templates.filter((t) =>
          t.name.toLowerCase().includes(tab)
        )

  return (
    <div className="px-3 py-2">
      <p className="text-sm font-medium mb-3">Templates</p>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-3">
          <TabsTrigger value="all" className="flex-1 text-xs">All</TabsTrigger>
          <TabsTrigger value="minimal" className="flex-1 text-xs">Minimal</TabsTrigger>
          <TabsTrigger value="classic" className="flex-1 text-xs">Classic</TabsTrigger>
          <TabsTrigger value="modern" className="flex-1 text-xs">Modern</TabsTrigger>
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
                      {/* Thumbnail placeholder — mini document representation */}
                      <div className="w-full aspect-[1/1.414] bg-zinc-100 rounded-sm mb-1.5 flex flex-col gap-0.5 p-1 overflow-hidden">
                        <div className="h-1 bg-zinc-300 rounded-full w-3/4" />
                        <div className="h-0.5 bg-zinc-200 rounded-full w-full mt-0.5" />
                        <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
                        <div className="h-0.5 bg-zinc-200 rounded-full w-4/6" />
                        <div className="h-1 bg-zinc-300 rounded-full w-1/2 mt-1" />
                        <div className="h-0.5 bg-zinc-200 rounded-full w-full" />
                        <div className="h-0.5 bg-zinc-200 rounded-full w-5/6" />
                      </div>

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
```

**Notes:**
- `Tabs` is already installed in shadcn/ui (`frontend/src/components/ui/tabs.tsx` exists from Story 1.2)
- `cancelled` flag in `useEffect` prevents setState on unmounted component — required pattern for all `apiClient` calls in `useEffect`
- `aria-pressed={isActive}` makes the active template state screen-reader-accessible
- The `aspect-[1/1.414]` A4 ratio on the thumbnail mirrors the A4 ratio in `ResumeCanvas` (UX-DR3)
- Filter logic matches against `t.name.toLowerCase()` — the seed templates are "Minimal", "Classic", "Modern" so the filter tabs map directly; "all" returns all

---

### Task 5: Frontend — Wire `TemplateGallery` into `EditorPage` / sidebar (AC: 1, 3, 5)

The `TemplateGallery` must be accessible from the editor's left sidebar. The `SplitPaneLayout` receives a `leftSlot` prop that currently renders `<SectionsPanel>`. Extend the sidebar to show `TemplateGallery` below `SectionsPanel`.

- [x] Edit `frontend/src/pages/EditorPage.tsx`

**New imports to add:**
```typescript
import TemplateGallery from "@/components/resume/TemplateGallery"
import { toast } from "sonner"  // already imported
```

**New store selectors to add** (alongside existing ones):
```typescript
const setCurrentResumeTemplateId = useResumeStore(
  (state) => state.setCurrentResumeTemplateId
)
```

**New `handleApplyTemplate` callback** (add alongside other handlers):
```typescript
const handleApplyTemplate = useCallback(
  async (templateId: string) => {
    if (!id || !currentResume) return
    // Optimistic update — update store immediately so the gallery highlights correctly
    setCurrentResumeTemplateId(templateId)
    try {
      await apiClient.put<ResumeDto>(`/api/v1/resumes/${id}`, {
        name: currentResume.name,
        content: currentResume.content,
        templateId,
      })
      toast.success("Template applied")
    } catch {
      // Revert optimistic update on failure
      setCurrentResumeTemplateId(currentResume.templateId)
      toast.error("Failed to apply template — please try again")
    }
  },
  [id, currentResume, setCurrentResumeTemplateId]
)
```

**Extend `leftSlot`** — replace the current `leftSlot` value with:
```tsx
leftSlot={
  <div className="overflow-y-auto h-full">
    <SectionsPanel sections={currentResume?.content.sections ?? []} />
    <div className="border-t border-border mt-2 pt-2">
      <TemplateGallery
        activeTemplateId={currentResume?.templateId ?? null}
        onApply={handleApplyTemplate}
      />
    </div>
  </div>
}
```

**CRITICAL layout notes:**
- The `leftSlot` content is placed inside the left column of `SplitPaneLayout`; check `SplitPaneLayout.tsx` — the left column does not have its own `overflow-y-auto`. Add `overflow-y-auto h-full` on the wrapper `div` so the sidebar scrolls when both `SectionsPanel` and `TemplateGallery` exceed the available height.
- Do NOT remove `SectionsPanel` — it stays above `TemplateGallery` in the left sidebar.
- `handleApplyTemplate` uses a direct `apiClient.put` call (not via `useAutosave`) because template switching is a deliberate user action, not a debounced background save. It sends the full `{ name, content, templateId }` payload to satisfy the updated `UpdateResumeRequest` record requirements.
- After the template is applied, `useAutosave` will detect that `currentResume.templateId` changed and may fire a redundant PUT at its next debounce cycle. This is harmless (idempotent) but wasteful. To prevent it, update `lastSavedSnapshotRef` after the explicit PUT — **or** simply accept the redundant PUT (simpler, no regression risk). Accept the redundant PUT for this story.

---

### Task 6: Frontend — Create `TemplateGallery.test.tsx` (AC: 1, 2, 4, 5)

- [x] Create `frontend/src/components/resume/TemplateGallery.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { apiClient } from "@/lib/apiClient"
import type { TemplateDto } from "@/types/api"
import TemplateGallery from "./TemplateGallery"

vi.mock("@/lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

const mockGet = vi.mocked(apiClient.get)

function buildTemplate(overrides?: Partial<TemplateDto>): TemplateDto {
  return {
    id: "template-1",
    name: "Minimal",
    description: null,
    isPrebuilt: true,
    isPublished: true,
    templateDefinition: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("TemplateGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders skeleton while loading (AC4)", () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    render(<TemplateGallery activeTemplateId={null} onApply={vi.fn()} />)
    // Three skeleton elements should be present
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("renders template cards after fetch (AC1)", async () => {
    const templates = [
      buildTemplate({ id: "t1", name: "Minimal" }),
      buildTemplate({ id: "t2", name: "Classic" }),
    ]
    mockGet.mockResolvedValue(templates)
    render(<TemplateGallery activeTemplateId={null} onApply={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByLabelText(/apply minimal template/i)).toBeInTheDocument()
    )
    expect(screen.getByLabelText(/apply classic template/i)).toBeInTheDocument()
  })

  it("marks currently active template with active badge (AC5)", async () => {
    const templates = [
      buildTemplate({ id: "t1", name: "Minimal" }),
      buildTemplate({ id: "t2", name: "Classic" }),
    ]
    mockGet.mockResolvedValue(templates)
    render(<TemplateGallery activeTemplateId="t1" onApply={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByLabelText(/apply minimal template \(active\)/i)).toBeInTheDocument()
    )
    expect(screen.getByLabelText(/apply classic template$/i)).toBeInTheDocument()
  })

  it("calls onApply with templateId when a template is clicked (AC3)", async () => {
    const onApply = vi.fn()
    mockGet.mockResolvedValue([buildTemplate({ id: "t1", name: "Minimal" })])
    render(<TemplateGallery activeTemplateId={null} onApply={onApply} />)
    await waitFor(() => screen.getByLabelText(/apply minimal template/i))
    fireEvent.click(screen.getByLabelText(/apply minimal template/i))
    expect(onApply).toHaveBeenCalledWith("t1")
  })

  it("filters to minimal tab when Minimal tab is clicked (AC1)", async () => {
    const templates = [
      buildTemplate({ id: "t1", name: "Minimal" }),
      buildTemplate({ id: "t2", name: "Classic" }),
    ]
    mockGet.mockResolvedValue(templates)
    render(<TemplateGallery activeTemplateId={null} onApply={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/apply minimal template/i))
    fireEvent.click(screen.getByRole("tab", { name: /minimal/i }))
    await waitFor(() =>
      expect(screen.queryByLabelText(/apply classic template/i)).not.toBeInTheDocument()
    )
    expect(screen.getByLabelText(/apply minimal template/i)).toBeInTheDocument()
  })

  it("shows 'No templates in this category' when filtered list is empty (AC1)", async () => {
    // Only Classic template — clicking Modern tab should show empty state
    mockGet.mockResolvedValue([buildTemplate({ id: "t1", name: "Classic" })])
    render(<TemplateGallery activeTemplateId={null} onApply={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/apply classic template/i))
    fireEvent.click(screen.getByRole("tab", { name: /modern/i }))
    await waitFor(() =>
      expect(screen.getByText(/no templates in this category/i)).toBeInTheDocument()
    )
  })
})
```

---

### Task 7: Lint pass

- [x] From `frontend/` directory, run: `npm run lint`
- [x] Fix any ESLint errors (0 errors required before marking story done)
- [x] Common pitfalls: missing `useCallback` deps, unused imports, `any` type

---

## Dev Notes

### CRITICAL: `UpdateResumeRequest` does NOT currently include `templateId` — backend change required

Inspected `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/UpdateResumeRequest.java`: it currently only has `name` and `content`. Adding `templateId` (nullable) is required to persist template switches. The existing autosave flow (`useAutosave`) currently sends `{ name, content }` only — this works fine today because `null` `templateId` in the record means "preserve existing" (per the guarded `if (request.templateId() != null)` logic added in Task 1).

**No migration needed** — the `resume_templates` table has a `template_id` UUID column on `resumes` that already persists this, and `ResumeService.updateResume` was not previously touching it.

### CRITICAL: Template switching uses a direct `apiClient.put` call, NOT `useAutosave`

`useAutosave` only watches `currentResume.name` and `currentResume.content` for dirty detection. It does NOT watch `templateId`. Therefore, template switching requires an explicit `apiClient.put` call from `handleApplyTemplate` with `{ name, content, templateId }` to persist the change immediately. Do not rely on `useAutosave` to persist the template switch.

After the explicit PUT, `useAutosave` may fire a redundant PUT at its next debounce cycle (because `currentResume` changed via `setCurrentResumeTemplateId`). This redundant PUT is harmless — it is idempotent and will not cause any visible flicker or incorrect state. Accept it for this story without attempting to suppress it.

### CRITICAL: `useAutosave` must send `templateId` in the PUT body

Even though `useAutosave` does not trigger on `templateId` changes, when it DOES fire (on name or content changes), it must include `templateId: doc.templateId ?? null` in the body — otherwise autosave would silently null out a previously applied template. This is the Task 2 fix.

### CRITICAL: `SplitPaneLayout.tsx` left column overflow behavior

Inspected `frontend/src/components/layout/SplitPaneLayout.tsx` — the left column renders `leftSlot` directly inside a `div` with `overflow-hidden`. Adding both `SectionsPanel` and `TemplateGallery` will overflow vertically without `overflow-y-auto h-full` on the wrapper div (added in Task 5). If this is not added, the TemplateGallery will be clipped.

### CRITICAL: The `Tabs` shadcn/ui component is already installed

`frontend/src/components/ui/tabs.tsx` exists (confirmed via file glob). Import from `@/components/ui/tabs` — `TabsList`, `TabsTrigger`, `TabsContent` are available. Do NOT install or re-add.

### CRITICAL: Template filter logic uses `t.name.toLowerCase().includes(tab)`

The three seeded template names are "Minimal", "Classic", and "Modern" (per `V5__seed_prebuilt_templates.sql` from Story 3.2). The filter tabs map to lowercase versions of these names. This is intentional and correct for the seeded data. If new templates are added with names that do not contain the tab keyword (e.g. "Professional Serif"), they will only appear in the "All" tab — this is acceptable behavior.

### CRITICAL: `TemplateDto.id` is a `string` in TypeScript, UUID in Java

`frontend/src/types/api.ts` defines `TemplateDto.id` as `string` (not UUID object). `ResumeDto.templateId` is `string | null`. These are compatible — no conversion needed. The `handleApplyTemplate(templateId: string)` call in `EditorPage` will pass the `template.id` string directly to `apiClient.put` in the PUT body. The Java backend deserializes it as `UUID` via Jackson.

### CRITICAL: `onApply` is called from the gallery component, NOT from within the PUT logic

`TemplateGallery` is a pure display component — it calls `onApply(templateId)` when a card is clicked, and the parent (`EditorPage`) handles the API call. This separation keeps `TemplateGallery` testable without needing to mock `apiClient` in the gallery test's onApply path.

### Not in scope for Story 3.7

- Per-template styling of `ResumeCanvas` — "Minimal", "Classic", "Modern" templates render identically today; per-template typography and layout is an Epic 5/7 concern. `ResumeCanvas` does not need to accept a `template` prop in this story.
- `ResumeSidebarItem` (Story 3.8) — not built yet
- Export button on template cards — Story 5.x
- "My Templates" tab (Story 7.2) — deferred
- ChatPanel (Story 4.3)
- `AIActionBar` (Story 4.x)

### `useResumeStore.updateResumeName` snapshot note

`updateResumeName` (added in Story 3.6) sets `currentResume.name`. The `setCurrentResumeTemplateId` action added in this story sets `currentResume.templateId`. Both use the same immutable Zustand pattern: `set((state) => ({ ...state, currentResume: { ...state.currentResume, ... } }))`. Do not deviate from this pattern.

### Test file location

Co-locate alongside source: `frontend/src/components/resume/TemplateGallery.test.tsx` (same pattern as `ResumeSection.test.tsx`, `DashboardPage.test.tsx`, etc.).

### `TemplateDto` `id` field in skeleton assertions

The `Skeleton` component from shadcn/ui renders a `div` with `data-slot="skeleton"` (confirmed in `frontend/src/components/ui/skeleton.tsx`). Use `document.querySelectorAll('[data-slot="skeleton"]')` to count skeletons in tests.

## File Changes Summary

### New Files (frontend)
| File | Purpose |
|------|---------|
| `frontend/src/components/resume/TemplateGallery.tsx` | Template gallery with filter tabs, thumbnail cards, active highlight, skeleton loading |
| `frontend/src/components/resume/TemplateGallery.test.tsx` | Tests for gallery: loading, render, active highlight, click-to-apply, filter tabs |

### Modified Files (backend)
| File | Changes |
|------|---------|
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/UpdateResumeRequest.java` | Add nullable `UUID templateId` field |
| `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` | Update `updateResume` to persist `templateId` when non-null |
| `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java` | Add 2 test cases for templateId update/preserve behavior |

### Modified Files (frontend)
| File | Changes |
|------|---------|
| `frontend/src/hooks/useAutosave.ts` | Add `templateId: doc.templateId ?? null` to PUT body |
| `frontend/src/stores/useResumeStore.ts` | Add `setCurrentResumeTemplateId` action |
| `frontend/src/pages/EditorPage.tsx` | Import `TemplateGallery`, add `handleApplyTemplate`, extend `leftSlot` |

### No Changes Needed
| File | Reason |
|------|---------|
| `frontend/src/types/api.ts` | `TemplateDto` and `ResumeDto` shapes already correct; no new types needed |
| `frontend/src/components/resume/ResumeCanvas.tsx` | Per-template styling is out of scope for this story |
| `frontend/src/components/layout/SplitPaneLayout.tsx` | No changes needed to the layout component itself |
| `frontend/src/components/ui/*` | Never edited — shadcn-managed |
| Backend `TemplateController.java` | Already implements `GET /api/v1/resume-templates` — no changes needed |
| Backend `TemplateService.java` | Already implements `listPublishedTemplates()` — no changes needed |

## References

- **FR20**: Authenticated users can browse a library of prebuilt resume templates
- **FR21**: Authenticated users can select a template to apply to a resume
- **UX-DR10**: `TemplateGallery` component — visual grid of template thumbnails with hover preview, filter tabs (All / Minimal / Classic / Modern), one-click apply with active selection highlight
- **Story 3.2**: Template API built — `GET /api/v1/resume-templates` returns published templates; `TemplateDto` shape
- **Story 3.4**: `EditorPage.tsx`, `SplitPaneLayout.tsx`, `ResumeCanvas.tsx` structure
- **Story 3.5**: `useResumeStore` immutable update pattern; `SectionsPanel` in `leftSlot`
- **Story 3.6**: `EditorPage.tsx` current state (toolbar, save-as dialog, `handleSaveAs`); `useAutosave.ts` PUT body shape; `updateResumeName` store action pattern
- `frontend/src/types/api.ts` — `TemplateDto`, `ResumeDto` shapes
- `frontend/src/stores/useResumeStore.ts` — `currentResume.templateId` is `string | null`; immutable set pattern
- `frontend/src/hooks/useAutosave.ts` — current PUT body `{ name, content }` needs `templateId` added
- `frontend/src/pages/EditorPage.tsx` — current state (all handlers, leftSlot structure)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/UpdateResumeRequest.java` — currently `name` + `content` only; needs `templateId` added
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` — `updateResume` currently sets `name` + `content` only
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/template/TemplateController.java` — `GET /api/v1/resume-templates` implemented and working

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None

### Completion Notes List

- AC6: `UpdateResumeRequest` extended with nullable `UUID templateId`; `ResumeService.updateResume` guards with `if (templateId != null)` to preserve existing value. 2 new unit tests added and passing (12 total in ResumeServiceTest).
- AC3/6: `useAutosave` PUT body extended with `templateId: doc.templateId ?? null`. Existing 6 tests still pass — mock does not assert body shape.
- AC3/5: `setCurrentResumeTemplateId` action added to `useResumeStore` following immutable Zustand pattern. Additive only.
- AC1/2/4/5: `TemplateGallery.tsx` created with filter tabs (All/Minimal/Classic/Modern), skeleton loading, active badge, A4 thumbnail placeholder, `aria-pressed` for accessibility.
- AC1/3/5: `EditorPage.tsx` wired with `TemplateGallery` in `leftSlot`, `handleApplyTemplate` with optimistic update + revert on error, `Toast` success/error.
- Tests: `TemplateGallery.test.tsx` — 6 tests covering AC1/AC3/AC4/AC5. `EditorPage.test.tsx` updated to route `apiClient.get` calls by URL (templates endpoint returns `[]`).
- Lint: 0 errors. 2 pre-existing warnings unrelated to this story.
- Pre-existing flaky test: `ResumeControllerIntegrationTest.put_updateResume_returns200WithUpdatedContent` fails due to nanosecond timestamp precision race condition — confirmed failing on main branch before this story's changes.

### File List

- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/dto/UpdateResumeRequest.java` (modified)
- `src/main/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeService.java` (modified)
- `src/test/java/com/tsvetanbondzhov/resumeenhancer/resume/ResumeServiceTest.java` (modified)
- `frontend/src/hooks/useAutosave.ts` (modified)
- `frontend/src/stores/useResumeStore.ts` (modified)
- `frontend/src/pages/EditorPage.tsx` (modified)
- `frontend/src/pages/EditorPage.test.tsx` (modified)
- `frontend/src/components/resume/TemplateGallery.tsx` (new)
- `frontend/src/components/resume/TemplateGallery.test.tsx` (new)

### Review Findings

- [x] [Review][Defer] Stale closure in handleApplyTemplate revert path under rapid concurrent template clicks [frontend/src/pages/EditorPage.tsx:131] — deferred, pre-existing React pattern; edge case not in spec scope; no user-visible impact under normal single-click usage
- [x] [Review][Defer] No EditorPage-level integration test for handleApplyTemplate/toast path [frontend/src/pages/EditorPage.test.tsx] — deferred, TemplateGallery.test.tsx covers the onApply callback path; story spec does not require EditorPage-level integration test for this flow

## Change Log

- 2026-06-05: Story 3.7 created — comprehensive context engine analysis completed.
- 2026-06-05: Story 3.7 implemented — all 7 tasks complete, 67 frontend tests + 12 backend unit tests passing, lint 0 errors.
- 2026-06-05: Code review passed — 0 patch findings, 2 deferred edge cases, status → done.
