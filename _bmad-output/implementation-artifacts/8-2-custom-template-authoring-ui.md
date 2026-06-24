# Story 8.2: Custom Template Authoring UI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to create, edit, and delete my own resume templates using a simplified definition editor with a live preview,
so that I can design a layout that reflects my personal style beyond the prebuilt options.

## Scope

**Frontend-only story.** The backend custom-template CRUD API is DONE in story 8.1 — do NOT add or change any Java/backend/Flyway code. This story delivers React UI only: a "My Templates" tab in the editor's `TemplateGallery`, a template editor surface (Name field + JSON definition textarea + live `ResumeCanvas` preview), client-side validation, save/delete flows wired to the existing `/custom` endpoints, accessibility, and Vitest coverage.

**Out of scope (do NOT build):** any new backend endpoint, any change to `TemplateService`/`TemplateController`/migrations, publishing custom templates (custom templates are always `isPublished = false`), a YAML editor (use JSON — no YAML dependency is installed and none should be added), and any new third-party syntax-highlighting/editor library.

## Acceptance Criteria

1. **"My Templates" tab in the gallery.** `TemplateGallery.tsx` gains a fourth tab "My Templates" alongside the existing `All / Minimal / Classic / Modern` tabs. When selected it lists the user's custom templates fetched from `GET /api/v1/resume-templates/custom` and shows a "Create New Template" button. The existing prebuilt tabs and their behavior (fetch from `/api/v1/resume-templates`, apply-on-click, active highlighting) are unchanged. Prebuilt templates must NOT appear in "My Templates"; custom templates must NOT appear in the prebuilt filter tabs.

2. **Create flow opens the editor.** Clicking "Create New Template" opens the template editor surface (a shadcn/ui `Sheet` — see Dev Notes for why Sheet over a route) containing: a **Name** `Input`, a **template definition** JSON `Textarea` pre-seeded with a valid minimal definition, and a **live `ResumeCanvas` preview** that re-renders client-side as the definition changes. No server round-trip is required to preview.

3. **Live preview within 500ms, client-side.** Editing the definition textarea updates the `ResumeCanvas` preview within 500ms (debounced) using the parsed definition — **without** calling the server. The definition format supports at minimum: section ordering, section visibility defaults, typography scale (`--font-size-base`), and color accent (`--accent-color`). Preview uses a real (small) sample `ResumeDocument` so layout/typography/accent changes are visible.

4. **Inline validation blocks invalid saves.** When the definition textarea contains malformed JSON or is missing required fields (`layoutType`, and CSS vars must use `px`/`in` not `rem`/`em` — the backend rejects rem/em with 400), an inline error message appears below the editor with a descriptive message, the Save button is disabled, and `apiClient.post`/`apiClient.put` is NOT called. The live preview falls back to the last valid definition (does not crash) while the text is invalid.

5. **Save (create + edit) wires to `/custom`.** Saving a valid new template calls `POST /api/v1/resume-templates/custom` with `{ name, description, templateDefinition }`; saving an existing custom template calls `PUT /api/v1/resume-templates/custom/{id}`. On success: the editor closes, the template appears/updates in "My Templates", a `toast.success("Template saved")` is shown, and it is immediately applicable to the open resume via the gallery. On failure: `toast.error(...)`, editor stays open, no optimistic removal.

6. **Edit existing custom template.** Each custom template row/card in "My Templates" has an Edit affordance that opens the same editor pre-filled with the template's `name` and a pretty-printed (`JSON.stringify(def, null, 2)`) `templateDefinition`. Saving routes to `PUT` per AC5.

7. **Delete with confirm dialog (UX-DR18, UX-DR19).** Each custom template has a Delete affordance opening a shadcn/ui `Dialog`: title "Delete template", description `Delete '[name]'? Resumes using it will revert to the default template.`. The **Cancel** button is **default-focused** when the dialog opens (UX-DR19) and the close (X) button is hidden (`showCloseButton={false}`). On confirm → `DELETE /api/v1/resume-templates/custom/{id}`, the template is removed from the gallery on 204, `toast.success("Template deleted")`. On failure → `toast.error(...)`, template stays.

8. **Accessibility (NFR19).** Name field, definition textarea, preview region, and all action buttons are keyboard-navigable with correct labels (`<Label htmlFor>` for inputs; `aria-label` for icon/ambiguous buttons). The live preview container has `aria-live="polite"` so screen readers are notified of layout updates. The "Create New Template" button and Edit/Delete affordances have discernible accessible names.

9. **Tests.** A `TemplateEditor.test.tsx` (component) verifies: (a) typing in the definition field triggers a debounced preview update (assert preview re-render / parsed-def applied), (b) saving with an invalid definition shows a validation error and does NOT call `apiClient.post`, (c) saving with a valid definition calls `POST /api/v1/resume-templates/custom` with the correct payload, (d) edit mode calls `PUT .../custom/{id}`. `TemplateGallery.test.tsx` is extended for: "My Templates" tab renders custom templates from `/custom`, "Create New Template" button present, and delete confirm calls `DELETE`. `npm run lint` passes with 0 new errors; `npm run test` green.

## Tasks / Subtasks

- [x] **Task 1 — apiClient + types (no new types needed) (AC: #1, #5)**
  - [x] Confirmed `TemplateDto`, `TemplateRequest`, `TemplateDefinitionDto`, `TemplateCssVariables` exist in `frontend/src/types/api.ts` (lines 438-495). Reused them; no new request type added — `TemplateRequest` is the save payload.
  - [x] All HTTP via `apiClient` (`.get`/`.post`/`.put`/`.delete`) — no raw `fetch`.

- [x] **Task 2 — `TemplateEditor` component (AC: #2, #3, #4, #6, #8)**
  - [x] NEW `frontend/src/components/resume/TemplateEditor.tsx` rendered inside a shadcn/ui `Sheet`. Props: `open`, `template: TemplateDto | null`, `onClose`, `onSaved`.
  - [x] State: `name`, `definitionText`, `lastValidDef`, `validationError`, `isSaving`.
  - [x] Seeded create-mode `definitionText` with `DEFAULT_DEFINITION` (single-column, `--accent-color` + `--font-size-base` in px, `layout.sectionOrder`).
  - [x] Edit-mode pre-fills `name` and `JSON.stringify(template.templateDefinition, null, 2)` (via state initializers; parent passes a changing `key` to remount on open/target change — avoids setState-in-effect lint rule).
  - [x] 500ms debounced parse+validate; on valid set `lastValidDef` + clear error; on invalid set `validationError`, keep last valid def for preview.
  - [x] Layout: left = Name `Input` + definition `Textarea` (`font-mono text-xs`) + inline error `<p className="text-sm text-destructive" role="alert">`; right = live preview. `<Label htmlFor>` on both inputs.
  - [x] Renders `<ResumeCanvas document={SAMPLE_DOC} templateId={null} templatePreview={lastValidDef} />`; preview container has `aria-live="polite"` + `aria-label`.

- [x] **Task 3 — Enable client-side preview in `ResumeCanvas` (AC: #3)**
  - [x] Added OPTIONAL prop `templatePreview?: TemplateDefinitionDto`.
  - [x] When provided, the effective `templateDefinition` is the preview and the network fetch is SKIPPED; a synthesized in-memory `template` drives the existing `cssVars`/`layoutType`/`getOrderedSections` logic unchanged. When absent, behavior is exactly as before — prop is optional/default-undefined so `EditorPage` is unaffected (verified `tsc --noEmit` clean).
  - [x] Existing `templateId` fetch path and its tests unchanged.

- [x] **Task 4 — "My Templates" tab in `TemplateGallery` (AC: #1, #5, #6, #7)**
  - [x] Added `"my"` tab labelled "My Templates" with a separate `GET /api/v1/resume-templates/custom` fetch (own `isCustomLoading`, `cancelled` cleanup guard, Skeleton loading).
  - [x] "Create New Template" `Button` (opens editor create mode), custom templates as apply-able cards reusing `TemplateThumbnail`/`onApply`, per-card Edit + Delete affordances.
  - [x] Apply still routes through the existing `onApply(templateId)` prop (no `EditorPage` change).
  - [x] `onSaved` splices the saved template into the custom list (create appends, edit replaces) so it appears immediately.

- [x] **Task 5 — Delete confirm (AC: #7)**
  - [x] shadcn/ui `Dialog` with `DialogContent showCloseButton={false}`, mirroring `TemplateManager.tsx`: `cancelRef` + `useEffect` focusing Cancel on open (UX-DR19), `deletingId` in-flight guard, `onOpenChange` close guarded.
  - [x] Description: `Delete '${name}'? Resumes using it will revert to the default template.`
  - [x] Confirm → `apiClient.delete('/api/v1/resume-templates/custom/${id}')`, on 204 remove from list + `toast.success("Template deleted")`; on failure `toast.error`.

- [x] **Task 6 — Tests (AC: #9)**
  - [x] NEW `frontend/src/components/resume/TemplateEditor.test.tsx` — covers AC9 (a) debounced preview update (fake timers), (b) invalid JSON + rem/em blocks save & no POST, (c) valid create → POST with exact payload, (d) edit pre-fill → PUT `/custom/{id}`.
  - [x] EXTENDED `frontend/src/components/resume/TemplateGallery.test.tsx` — mocks both endpoints; My Templates lists custom templates, prebuilt excluded, Create button present + opens editor, delete confirm calls `apiClient.delete('/custom/{id}')`.
  - [x] Added `ResumeCanvas.test.tsx` case: `templatePreview` renders without a fetch.
  - [x] `npm run lint` — 0 new errors (15 pre-existing errors in unrelated files); `npx vitest run` — 769/769 green; `tsc --noEmit` clean.

## Dev Notes

### What ALREADY exists (REUSE — do not rebuild)

- **Backend `/custom` API (story 8.1, DONE):** `POST /api/v1/resume-templates/custom` → 201 `TemplateDto`; `GET /api/v1/resume-templates/custom` → 200 `TemplateDto[]` (own only, ownership-scoped); `PUT /api/v1/resume-templates/custom/{templateId}` → 200 (403 if not owner, 404 if missing); `DELETE /api/v1/resume-templates/custom/{templateId}` → 204 (403/404 same). All require auth, NONE require ADMIN. [Source: 8-1-custom-template-data-model-and-crud-api.md AC#2-6]
- **`apiClient`** (`frontend/src/lib/apiClient.ts`): `get/post/put/patch/delete/uploadFile`. Adds JWT `Authorization` from `useAuthStore`, throws `ApiError(status, detail, errors)` on non-2xx, auto-redirects to `/login` on 401, returns `undefined` for 204. Use it for ALL calls. `post(path, body)` / `put(path, body)` JSON-stringify the body. `delete(path)` takes no body.
- **`TemplateDto` / `TemplateRequest` / `TemplateDefinitionDto` / `TemplateCssVariables` / `TemplateLayout` / `TemplateSectionStyle` / `TemplateColumns`** all in `frontend/src/types/api.ts` (~lines 438-493). `TemplateRequest = { name; description: string | null; templateDefinition: Record<string, unknown> }` is the save payload — `TemplateManager.tsx` already uses it for PUT. No new type needed.
- **`TemplateGallery.tsx`** (`frontend/src/components/resume/`): existing 4-tab gallery, `apiClient.get('/api/v1/resume-templates')`, `TemplateThumbnail` (handles `single-column`/`two-column`/`modern-accent`), `onApply(templateId)` callback, active-highlight via `aria-pressed`/`aria-label="Apply X template (active)"`, `Skeleton` while loading, `cancelled` cleanup in effect. EXTEND this file — keep its prebuilt behavior intact.
- **`TemplateManager.tsx`** (`frontend/src/components/admin/`, built in 7.2): the canonical reference for the delete `Dialog` + UX-DR19 Cancel-focus (`cancelRef` + `useEffect`), `sonner` `toast.success/error`, in-flight `deletingId`/`savingEdit` guards, `Skeleton aria-busy` loading, semantic `<table>` with `scope="col"`, and the edit `Dialog` with `<Label htmlFor>` inputs. MIRROR these patterns; do not reinvent.
- **`ResumeCanvas.tsx`** (`frontend/src/components/resume/`): renders a `ResumeDocumentDto` with a template. It currently fetches the template by `templateId`. It applies `cssVariables` as inline CSS custom properties on the root style, reads `layoutType` (`single-column` / `two-column` / `modern-accent`), and orders sections via `getOrderedSections(sections, template)` from `frontend/src/lib/templateUtils.ts`. ADD the optional `templatePreview` prop (Task 3) so an unsaved definition can render without a fetch.
- **`EditorPage.tsx`** hosts `<TemplateGallery activeTemplateId={currentResume?.templateId} onApply={handleApplyTemplate} />` in the left pane. `handleApplyTemplate` PUTs the resume with the new `templateId` (optimistic). No change required to apply a newly-saved custom template — once it has an id and is in the gallery, clicking it applies it. (Note: applied custom template renders in the canvas via the EXISTING `templateId` fetch path — `GET /api/v1/resume-templates/{id}` returns the owner's custom template fine since it's a generic by-id lookup.)
- **`AdminPage.tsx`** + `frontend/src/components/ui/tabs` show the established `Tabs/TabsList/TabsTrigger/TabsContent` usage.

### templateDefinition shape (CRITICAL — bake into the editor + validation)

The JSON definition matches `TemplateDefinitionDto`. Prebuilt seed example (from `V6__backfill_template_definitions.sql`):

```json
{
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
  "metadata": { "version": "1.0", "atsCompatible": true, "pageSize": "letter" }
}
```

- `layoutType` ∈ `single-column` | `two-column` | `modern-accent`. For `two-column`, `layout.columns.left`/`right` arrays of section-type strings drive column assignment.
- **CSS unit rule (HARD):** the backend `TemplateService.validateCssVariables` rejects any `cssVariables` value matching `\d+(rem|em)` with HTTP 400. The editor MUST validate this client-side too (AC4) so users get an inline message before hitting the server. Only `px` and `in` are accepted for sized values.
- `sectionOrder` strings match `section.sectionType` lowercased semantics used by `getOrderedSections` — but visibility/order in the canvas is driven by the user's stored document order for single/modern layouts; `columns` drives two-column. Keep the sample doc's section types consistent with what the layout references.

### Default definition seed (create mode)

Pre-seed the create-mode textarea with a minimal valid `single-column` definition (a trimmed version of the example above) so the preview renders immediately and the user edits from a working baseline. Include at least `layoutType`, `cssVariables` with `--accent-color` and `--font-size-base` in `px`, and a `layout.sectionOrder`.

### Editor surface decision: Sheet, not a route

The epic offers "`TemplateEditorPage.tsx` (or shadcn/ui `Sheet` panel)". **Use a `Sheet`** (or `Dialog` if a `Sheet` primitive is absent under `components/ui/` — check first). Rationale: the editor is launched from inside the editor's left-pane gallery (`EditorPage`), keeping the open resume in context for "apply immediately after save"; a separate route would unmount the editor and lose context. Do NOT add a new router entry. If you choose `Sheet`, verify `frontend/src/components/ui/sheet.tsx` exists; if not, fall back to `Dialog` (which definitely exists) — do NOT create or edit files under `components/ui/`.

### JSON over YAML (dependency constraint)

No YAML parser is installed in `frontend/package.json` and none should be added (project rule: minimal deps, no unnecessary frontend packages). Use a plain `Textarea` + native `JSON.parse` for the definition. "Syntax highlighting" from the epic is downgraded to a monospace `Textarea` (`className="font-mono text-xs"`) — do NOT pull in Monaco/CodeMirror/highlight.js.

### Project rules to honor (from project-context.md)

- All HTTP via `lib/apiClient.ts` only — no raw `fetch()` in components.
- Never edit files under `frontend/src/components/ui/` (shadcn-managed).
- TypeScript strict — no `any`. Use the existing `types/api.ts` interfaces. The save payload cast pattern `template.templateDefinition as unknown as Record<string, unknown>` used in `TemplateManager.tsx` is acceptable for the `TemplateRequest.templateDefinition` field.
- Component files `PascalCase.tsx`; co-locate tests as `<Component>.test.tsx` (Vitest + Testing Library). No test imports from `components/ui/`.
- Errors via `sonner` `toast` (`toast.success`/`toast.error`); per-operation boolean flags (`isSaving`, `deletingId`) — never a single global `isLoading`.
- No new Zustand store needed — the editor is local component state; the gallery owns its custom-template list. Do NOT introduce cross-component shared state for this.

### Source tree components to touch

- NEW: `frontend/src/components/resume/TemplateEditor.tsx`
- NEW: `frontend/src/components/resume/TemplateEditor.test.tsx`
- UPDATE: `frontend/src/components/resume/TemplateGallery.tsx` (add "My Templates" tab, Create button, Edit/Delete affordances, wire editor)
- UPDATE: `frontend/src/components/resume/TemplateGallery.test.tsx` (custom list, create button, delete)
- UPDATE: `frontend/src/components/resume/ResumeCanvas.tsx` (optional `templatePreview` prop, skip fetch when present)
- UPDATE (if needed): `frontend/src/components/resume/ResumeCanvas.test.tsx`
- NO backend, router, Flyway, types/api.ts, or `components/ui/` changes.

### Testing standards summary

- Vitest + `@testing-library/react`. Mock `apiClient` via `vi.mock("@/lib/apiClient", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))` then `vi.mocked(...)` — see `TemplateGallery.test.tsx` and `TemplateManager.test.tsx` for the exact pattern (including `buildTemplate` fixture factory).
- For the debounce assertion use `vi.useFakeTimers()` + `vi.advanceTimersByTime(500)` (and `vi.useRealTimers()` in cleanup), or assert the preview applied the parsed def after the debounce window via `waitFor`.
- Assert the POST payload shape precisely: `expect(apiClient.post).toHaveBeenCalledWith("/api/v1/resume-templates/custom", { name, description, templateDefinition })`.
- Assert invalid-definition path does NOT call `apiClient.post` (negative assertion).

### Project Structure Notes

- New components live under `frontend/src/components/resume/` alongside `TemplateGallery`, `ResumeCanvas` — consistent with the resume editor domain. No structural variance.
- API routes are stable kebab-case under `/api/v1/resume-templates/custom` — match exactly. Path param `{templateId}` is the template's UUID.
- The only cross-file coupling introduced is the `templatePreview` prop on `ResumeCanvas`; keeping it optional preserves the existing `EditorPage` contract — verify `EditorPage.tsx` still compiles unchanged.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-8-custom-template-authoring-deferred.md#Story 8.2]
- [Source: _bmad-output/implementation-artifacts/8-1-custom-template-data-model-and-crud-api.md — /custom endpoints, ownership, TemplateDto reuse, CSS rem/em rejection]
- [Source: frontend/src/components/resume/TemplateGallery.tsx — gallery tabs, TemplateThumbnail, onApply, active highlight, Skeleton, cancelled-effect]
- [Source: frontend/src/components/admin/TemplateManager.tsx — delete Dialog + UX-DR19 cancelRef focus, sonner toasts, in-flight guards, edit Dialog, semantic table, TemplateRequest payload]
- [Source: frontend/src/components/resume/ResumeCanvas.tsx — templateId fetch path, cssVariables→inline style, layoutType, getOrderedSections]
- [Source: frontend/src/lib/templateUtils.ts#getOrderedSections — section ordering / two-column columns]
- [Source: frontend/src/pages/EditorPage.tsx#handleApplyTemplate — apply routes through onApply→PUT resume templateId]
- [Source: frontend/src/lib/apiClient.ts — get/post/put/delete, JWT, ApiError, 204 handling]
- [Source: frontend/src/types/api.ts:438-493 — TemplateDto, TemplateRequest, TemplateDefinitionDto, TemplateCssVariables]
- [Source: src/main/resources/db/migration/V6__backfill_template_definitions.sql — canonical templateDefinition JSON shape]
- [Source: src/main/java/.../template/TemplateService.java#validateCssVariables — rem/em → 400, px/in only]
- [Source: frontend/src/pages/AdminPage.tsx — Tabs/TabsList/TabsTrigger/TabsContent usage]
- [Source: frontend/src/components/resume/TemplateGallery.test.tsx — apiClient mock + buildTemplate fixture test pattern]
- [Source: _bmad-output/project-context.md — frontend rules: apiClient-only, no ui/ edits, sonner toasts, no any, per-op loading flags]

### Review Findings

- [x] [Review][Patch] P1: Unnecessary microtask deferral in `templatePreview` useEffect branch causes an extra render cycle [ResumeCanvas.tsx — templatePreview branch of useEffect ~line 41] — `void Promise.resolve().then(() => setFetchedTemplate(null))` fires on every render where templatePreview is truthy, even though fetchedTemplate is already null; replace with a direct no-op (remove the branch body entirely, since fetchedTemplate is unused when templatePreview is present)
- [x] [Review][Patch] P2: Delete dialog becomes permanently stuck when delete fails — `closeDeleteDialog` is a no-op while `deletingId !== null`, `handleConfirmDelete` catch block does NOT clear `deleteTarget`, so after a failed DELETE the dialog cannot be dismissed (Escape/outside-click also calls `closeDeleteDialog` which is gated) [TemplateGallery.tsx ~line 150 closeDeleteDialog / handleConfirmDelete] — fix: add `setDeleteTarget(null)` inside the catch block (or always in finally after `setDeletingId(null)`)
- [x] [Review][Patch] P3: Old TemplateGallery tests contaminated — `mockGet.mockResolvedValue(templates)` now fires for BOTH fetch calls, so `customTemplates` gets the prebuilt templates array; tests pass accidentally [TemplateGallery.test.tsx — prebuilt-only tests ~line 70–167] — fix: update old tests to use `mockGalleryFetches(templates, [])` helper
- [x] [Review][Patch] P4: Save button briefly enabled during 500ms debounce window for invalid content — `saveDisabled` reads `validationError` which is stale until debounce fires; button can be visually enabled even when definition text is invalid [TemplateEditorPage.tsx ~line 231] — the synchronous re-validate in handleSave prevents actual API call, but AC4 specifies button must be disabled; low severity
- [x] [Review][Patch] P5: Custom templates fetch failure shows "You have no custom templates yet." instead of an error message — `.catch()` in the custom templates effect only sets `isCustomLoading(false)` with no error state [TemplateGallery.tsx ~line 120–136] — fix: add an `isCustomError` state and render an inline error message in `renderMyTemplates()`
- [x] [Review][Patch] P6: Missing router test — unauthenticated access to `/templates/custom/:id/edit` redirect to /login not tested [router/index.test.tsx] — the route is symmetric with /new but the test coverage gap means a future refactor could silently remove auth gating from the edit route
- [x] [Review][Patch] P7: Delete test does not assert the template card is removed from the DOM after successful delete [TemplateGallery.test.tsx ~line 224–249] — the `setCustomTemplates(prev => prev.filter(...))` path is untested behavior
- [x] [Review][Patch] P8: AC4 inline validation error delayed 500ms — `validationError` state is set only inside the debounce timeout (500ms), so the `role="alert"` error text below the textarea does not appear until 500ms after the user types invalid content. AC4 specifies "an inline error message appears below the editor" when the definition is invalid. The Save button IS correctly and immediately disabled (synchronous `rawSaveDisabled`), but the error message that explains why is delayed. Fix: split validation from preview-update debounce — run `validateDefinition` synchronously on every `definitionText` change (set `validationError` immediately), and only debounce the `lastValidDef` update that drives the preview [TemplateEditorPage.tsx — debounce useEffect ~line 164–183]
- [x] [Review][Defer] D1: Stale `customTemplates` list if concurrent edits/deletes from another session [TemplateGallery.tsx] — deferred, pre-existing trade-off inherent to local state management without a cache invalidation strategy
- [x] [Review][Defer] D2: `navigate(-1)` on direct URL load or empty history stack leaves the app on about:blank [TemplateEditorPage.tsx lines 185, 224] — deferred, pre-existing; spec explicitly specifies `navigate(-1)` and Dev Notes confirm it; known SPA limitation
- [x] [Review][Defer] D3: No unsaved-changes warning when user clicks Cancel with edits [TemplateEditorPage.tsx handleCancel] — deferred, pre-existing; not required by any AC

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia, BMad dev-story workflow)
claude-sonnet-4-6 (Amelia, BMad dev-story — fullscreen page rework, 2026-06-24)
claude-sonnet-4-6 (Amelia, BMad dev-story — code review findings P1–P7, 2026-06-24)

### Debug Log References

- Original Sheet implementation: `npm run lint` 15 errors / 5 warnings all pre-existing; `npx vitest run` 769/769 green; `tsc --noEmit` clean.
- Fullscreen page rework: `npm run lint` 13 errors / 5 warnings all pre-existing (0 new); `npx vitest run` 776/776 green (7 new tests); `npx tsc --noEmit` clean.

### Completion Notes List

- Resolved review finding [P1]: Removed unnecessary `void Promise.resolve().then(() => setFetchedTemplate(null))` in ResumeCanvas templatePreview branch — fetchedTemplate is already null in that path, nothing to reset.
- Resolved review finding [P2]: Moved `setDeleteTarget(null)` from the try success path into `finally` in `handleConfirmDelete` — dialog now always dismisses after delete, even on failure.
- Resolved review finding [P3]: Updated all 7 prebuilt-only TemplateGallery tests to call `mockGalleryFetches(templates, [])` instead of `mockGet.mockResolvedValue(templates)` directly — custom-templates fetch now correctly returns empty array in those tests.
- Resolved review finding [P4]: Replaced stale `validationError` in `saveDisabled` with a synchronous inline re-validation of `definitionText` — Save button is now always in sync with current input, not the debounced state.
- Resolved review finding [P5]: Added `isCustomError` boolean state to TemplateGallery; set in custom-templates fetch catch block; `renderMyTemplates()` renders "Failed to load your templates. Please try again." when true.
- Resolved review finding [P6]: Added router test asserting unauthenticated access to `/templates/custom/some-id/edit` redirects to `/login`.
- Resolved review finding [P7]: Extended delete test to assert template card (identified by aria-label) disappears from DOM after successful deletion, covering the `setCustomTemplates(prev => prev.filter(...))` optimistic-removal path.
- Resolved review finding [P8]: Split the single debounced `useEffect` in `TemplateEditorPage.tsx` into two: (1) a synchronous `useEffect` that runs `validateDefinition` immediately on every `definitionText` change and sets `validationError` without delay (inline error message now appears instantly, satisfying AC4); (2) a debounced `useEffect` (500ms) that only updates `lastValidDef` when the definition is valid, preserving the AC3 preview debounce. Both `validationError` and `saveDisabled` now reflect the current input synchronously with no 500ms lag. Tests: 777/777 green.
- All 9 ACs implemented frontend-only; no backend/Flyway/`types/api.ts`/`components/ui/` changes.
- **[2026-06-24 rework]** Sheet-based TemplateEditor replaced with a dedicated fullscreen page (`TemplateEditorPage.tsx`) at routes `/templates/custom/new` and `/templates/custom/:templateId/edit`. The original Dev Notes decision to use a Sheet "to avoid a router change" was explicitly overridden by the user. The sheet decision IS voided; a router change IS now in place.
- Editor is a full-viewport layout: header bar with title + Cancel/Save, left-half editor (Name + JSON textarea + validation), right-half live ResumeCanvas preview — editor and preview are comfortably side-by-side at full screen width.
- Edit mode fetches the template via `GET /api/v1/resume-templates/custom/:templateId` on page mount; cancel/save both navigate back via `navigate(-1)` restoring the user's prior location (gallery/editor).
- TemplateGallery no longer mounts the Sheet; Create New Template and Edit affordances navigate to the new page routes. Gallery re-fetches custom templates on remount when the user returns.
- Old `TemplateEditor.tsx` and `TemplateEditor.test.tsx` deleted (no dead code). New `TemplateEditorPage.tsx` (page) and `TemplateEditorPage.test.tsx` (7 test cases) replace them.
- TemplateGallery test updated: mocks `useNavigate`, asserts navigation calls instead of editor-open state; wraps gallery in `MemoryRouter` for `useNavigate` to work in jsdom.
- Router test extended: mocks `TemplateEditorPage`, asserts the two new routes render the page for authenticated users and redirect unauthenticated users to `/login`.
- JSON definition via monospace `Textarea` + native `JSON.parse` — no YAML/syntax-highlight dependency added.
- Client-side validation rejects malformed JSON, missing `layoutType`, and rem/em CSS units (`/\d+(\.\d+)?(rem|em)\b/i`) before any `apiClient` call — matches the backend px/in-only contract.
- Live preview is debounced 500ms and falls back to the last valid definition while text is invalid (no crash).
- `ResumeCanvas` gained an optional `templatePreview` prop; when present it renders client-side and skips the `templateId` fetch. Existing fetch path and tests untouched.
- Re-initialization on open/edit-target uses a parent-supplied `key` + state initializers instead of a setState-in-effect (avoids the project's `react-hooks/set-state-in-effect` lint error).
- No new Zustand store; editor is local component state, gallery owns the custom-template list.

### File List

- DELETED: `frontend/src/components/resume/TemplateEditor.tsx` (replaced by TemplateEditorPage)
- DELETED: `frontend/src/components/resume/TemplateEditor.test.tsx` (replaced by TemplateEditorPage.test.tsx)
- NEW: `frontend/src/pages/TemplateEditorPage.tsx`
- NEW: `frontend/src/pages/TemplateEditorPage.test.tsx`
- MODIFIED: `frontend/src/components/resume/TemplateGallery.tsx`
- MODIFIED: `frontend/src/components/resume/TemplateGallery.test.tsx`
- MODIFIED: `frontend/src/components/resume/ResumeCanvas.tsx`
- MODIFIED: `frontend/src/components/resume/ResumeCanvas.test.tsx`
- MODIFIED: `frontend/src/router/index.tsx`
- MODIFIED: `frontend/src/router/index.test.tsx`

### Change Log

- 2026-06-24: Story 8.2 code review finding P8 addressed (review) — Split single debounced useEffect into: (1) synchronous validation useEffect that sets `validationError` immediately on every `definitionText` change (inline error now appears without 500ms lag, satisfying AC4); (2) debounced useEffect (500ms) that updates `lastValidDef` only when valid (preserves AC3 preview debounce). Both `validationError` and `saveDisabled` are synchronous with current input. Tests: 777/777 green.
- 2026-06-24: Story 8.2 code review findings addressed (review) — Fixed all P1–P7 findings: P1 removed unnecessary microtask deferral in ResumeCanvas templatePreview branch; P2 moved `setDeleteTarget(null)` to `finally` in `handleConfirmDelete` so delete dialog always closes after failure; P3 updated all 7 old TemplateGallery tests to use `mockGalleryFetches(prebuilt, [])` instead of `mockGet.mockResolvedValue` directly; P4 derived `saveDisabled` from synchronous raw validation of `definitionText` instead of stale `validationError`; P5 added `isCustomError` state to TemplateGallery, set in custom-templates fetch catch, renders inline error message in `renderMyTemplates()`; P6 added router test asserting unauthenticated `/templates/custom/some-id/edit` redirects to `/login`; P7 extended delete test to assert template card disappears from DOM after successful deletion. Tests: 777/777 green, 0 new lint errors on changed files.
- 2026-06-24: Story 8.2 reworked (review, kept) — user-directed change: Sheet/drawer replaced by a fullscreen dedicated route. Deleted `TemplateEditor.tsx` + test; created `TemplateEditorPage.tsx` at `/templates/custom/new` and `/templates/custom/:templateId/edit` behind the existing `ProtectedRoute`. Gallery Create/Edit affordances now use `useNavigate`. Cancel/Save navigate back via `navigate(-1)`. Router extended with two lazy-loaded routes. Tests updated: 776/776 green, 0 new lint errors (13 pre-existing unchanged), `tsc --noEmit` clean. The original Dev Notes Sheet decision is hereby overridden by the user.
- 2026-06-24: Story 8.2 implemented (review) — My Templates tab + Sheet-based `TemplateEditor` (JSON textarea + live `ResumeCanvas` preview via new optional `templatePreview` prop), client-side JSON + rem/em validation, POST/PUT/DELETE wiring to `/custom`, UX-DR19 delete confirm, accessibility, Vitest coverage (29 new/extended assertions, 769 total green).
- 2026-06-24: Story 8.2 created (ready-for-dev) — custom template authoring UI built on the 8.1 `/custom` API. Frontend-only: My Templates tab, Sheet-based TemplateEditor (JSON textarea + live ResumeCanvas preview via new optional `templatePreview` prop), client-side validation (JSON + rem/em CSS rule), POST/PUT/DELETE wiring, UX-DR19 delete confirm, accessibility, Vitest coverage.
