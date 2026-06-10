# Story 4.6: Profile Page Free Navigation and First-Entry Deletion

**Status:** backlog
**Epic:** 4 — Resume Experience Polish & Foundations
**Story Key:** 4-6-profile-page-navigation-and-first-entry-deletion
**Dependencies:** Story 2.2 (done), Story 3.12 (done)

---

## Story

As a user filling in my profile,
I want to freely jump between any section and delete any entry — including the first one in each section,
So that I can edit my profile non-linearly and keep only the information that is relevant to me.

---

## Acceptance Criteria

**AC1 — Clickable step navigation**
**Given** the profile progress indicator `<ol>` is rendered
**When** a user clicks any step label
**Then** `currentStep` is set to that step's index directly (no validation gate); navigation is immediate and does not require completing the current step first

**AC2 — Completed step styling without strikethrough**
**Given** a step has been passed (its index is less than `currentStep`)
**When** the progress indicator renders
**Then** that step uses a subdued/muted style (e.g. `text-zinc-400 font-normal`) — it MUST NOT have `text-decoration: line-through` (no `line-through` Tailwind class) and MUST NOT have a `✓` character prefix; the exact style may be `text-zinc-400 font-normal` or similar muted treatment

**AC3 — Current and unvisited step styling**
**Given** the progress indicator renders
**When** the current step and not-yet-visited steps are displayed
**Then** the current step is visually distinct from unvisited steps (e.g. current: `font-semibold text-zinc-900`; unvisited: `text-zinc-400 font-normal`); all three states (unvisited, completed, current) must be visually distinct from each other

**AC4 — Delete button on all items including the first**
**Given** any step component is rendered (ExperienceStep, EducationStep, SkillsStep, CertificationsStep, LanguagesStep, ProjectsStep, VolunteeringStep)
**When** the step is displayed regardless of how many items exist
**Then** every item — including the first (index 0) — has a delete/remove button; the current guard `entries.length > 1` (or equivalent) that hides the delete button on the sole remaining item is removed

**AC5 — Empty section is valid state**
**Given** a user deletes all items in a step
**When** they click "Save & Continue"
**Then** the step shows an empty state with an "Add [item type]" button (so users are not stuck); the save call proceeds with an empty array for that section; the server accepts this (no frontend validation requiring at least one item)

**AC6 — Tests**
**Given** `ProfilePage.test.tsx` exists (or is created)
**When** tests run
**Then**:
- Clicking step label at index 3 (from an initial `currentStep` of 0) sets `currentStep` to 3
- A completed step (index < currentStep) does not have the CSS class `line-through` in its className
- A completed step does not have text content starting with `✓`
- The first item (index 0) in `ExperienceStep` has a delete button (aria-label `"Remove entry 1"`)

---

## Tasks / Subtasks

### Task 1: Make progress steps clickable (AC: 1)

- [ ] Open `frontend/src/pages/ProfilePage.tsx`
- [ ] In the `<ol>` / `{STEPS.map(...)}` block (around line 236), convert `<li>` to include an `onClick` handler:
  ```tsx
  // BEFORE:
  <li key={label} className={className}>
    {index < currentStep ? `✓ ${label}` : label}
  </li>

  // AFTER:
  <li
    key={label}
    className={`${className} cursor-pointer select-none`}
    onClick={() => setStep(index)}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setStep(index) }}
    aria-label={`Go to step ${label}`}
    aria-current={index === currentStep ? "step" : undefined}
  >
    {label}
  </li>
  ```
- [ ] Remove the `✓ ${label}` prefix from completed steps (AC2 is handled in the same block)

### Task 2: Update completed step styling (AC: 2, 3)

- [ ] In the same `STEPS.map(...)` block, update the `className` assignment:
  ```tsx
  // BEFORE:
  let className = "text-zinc-400"
  if (index < currentStep) {
    className = "text-zinc-500 line-through"
  } else if (index === currentStep) {
    className = "font-medium text-blue-600"
  }

  // AFTER:
  let className = "text-zinc-400 font-normal"           // not yet visited
  if (index < currentStep) {
    className = "text-zinc-400 font-normal"             // completed — muted, no strikethrough
  } else if (index === currentStep) {
    className = "font-semibold text-zinc-900"           // current — highlighted
  }
  ```
  Note: if completed and unvisited share the same style, that is acceptable (they are visually alike but distinguishable from the current step). Alternatively, use `text-zinc-400` for unvisited and `text-zinc-300` for completed, or a subtle `text-blue-400 font-normal` for completed — the key constraint is NO `line-through` and NO `✓` prefix.

### Task 3: Remove first-item delete guard from all step components (AC: 4, 5)

- [ ] **`ExperienceStep.tsx`** (`frontend/src/components/profile/ExperienceStep.tsx`):
  - Remove the `entries.length > 1 &&` guard on the remove button (around line 157)
  - The remove button should always render for every entry
  - After removal, if `entries` becomes empty (`entries.length === 0`), render an empty-state message and an "Add experience" button that calls `addAnother()`
  ```tsx
  // Empty state when all entries deleted:
  {entries.length === 0 && (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-zinc-500">
      No experience added yet.{" "}
      <button type="button" onClick={addAnother} className="text-blue-600 underline">
        Add experience
      </button>
    </div>
  )}
  ```

- [ ] **`EducationStep.tsx`** (`frontend/src/components/profile/EducationStep.tsx`):
  - Remove the equivalent `entries.length > 1 &&` guard
  - Add empty-state with "Add education" button

- [ ] **`SkillsStep.tsx`** (`frontend/src/components/profile/SkillsStep.tsx`):
  - Remove the `skills.length > 1 &&` guard on the remove button (around line 97)
  - Add empty-state with "Add skill" button

- [ ] **`CertificationsStep.tsx`** (`frontend/src/components/profile/CertificationsStep.tsx`):
  - Remove the equivalent guard
  - Add empty-state with "Add certification" button

- [ ] **`LanguagesStep.tsx`** (`frontend/src/components/profile/LanguagesStep.tsx`):
  - Remove the equivalent guard
  - Add empty-state with "Add language" button

- [ ] **`ProjectsStep.tsx`** (`frontend/src/components/profile/ProjectsStep.tsx`):
  - Remove the equivalent guard
  - Add empty-state with "Add project" button

- [ ] **`VolunteeringStep.tsx`** (`frontend/src/components/profile/VolunteeringStep.tsx`):
  - Remove the equivalent guard
  - Add empty-state with "Add volunteering" button

- [ ] **`SummaryStep.tsx`** (`frontend/src/components/profile/SummaryStep.tsx`): no items list — no change needed

### Task 4: Update `handleSubmit` to allow empty arrays (AC: 5)

- [ ] In each step component, confirm `handleSubmit` (or equivalent save handler) does not have a validation that requires `entries.length > 0`. Review each:
  - `ExperienceStep.handleSubmit`: currently calls `validateAll()` which only validates field values within entries; if `entries` is empty, `validated` is `[]`, `hasErrors` is `false`, and `workExperiences: []` is sent — this already works without changes
  - Same pattern applies to other step components — verify and document, no code change expected

### Task 5: Write tests (AC: 6)

- [ ] Check if `frontend/src/pages/ProfilePage.test.tsx` exists; create it if not (it may not exist since ProfilePage is page-level)
- [ ] Write test: **clicking step 3 sets currentStep to 3**
  ```tsx
  it("clicking step label navigates directly to that step", async () => {
    // Render ProfilePage with a non-empty profile (so stepper is visible)
    // Find the step label at index 3 ("Certifications")
    const step = screen.getByRole("button", { name: /Go to step Certifications/i })
    await userEvent.click(step)
    // Assert currentStep is now 3 (CertificationsStep renders)
    expect(screen.getByText(/Certifications/i)).toBeInTheDocument()
  })
  ```
- [ ] Write test: **completed step has no `line-through` class**
  ```tsx
  it("completed steps have no line-through class and no check prefix", () => {
    // Set currentStep to 2 so steps 0 and 1 are completed
    // Check that step 0 li element does not have line-through in className
    const step0 = screen.getByRole("button", { name: /Go to step Experience/i })
    expect(step0.className).not.toContain("line-through")
    expect(step0.textContent).not.toMatch(/^✓/)
  })
  ```
- [ ] Write test: **first item has delete button**
  - Render `ExperienceStep` directly with one entry pre-populated
  - Assert a button with `aria-label="Remove entry 1"` is present in the DOM

---

## Developer Context & Guardrails

### Files to Modify (UPDATE)

| File | Change |
|------|--------|
| `frontend/src/pages/ProfilePage.tsx` | Add `onClick` to `<li>` steps; remove `line-through` + `✓`; update step classNames |
| `frontend/src/components/profile/ExperienceStep.tsx` | Remove `entries.length > 1` guard; add empty state |
| `frontend/src/components/profile/EducationStep.tsx` | Remove guard; add empty state |
| `frontend/src/components/profile/SkillsStep.tsx` | Remove `skills.length > 1` guard; add empty state |
| `frontend/src/components/profile/CertificationsStep.tsx` | Remove guard; add empty state |
| `frontend/src/components/profile/LanguagesStep.tsx` | Remove guard; add empty state |
| `frontend/src/components/profile/ProjectsStep.tsx` | Remove guard; add empty state |
| `frontend/src/components/profile/VolunteeringStep.tsx` | Remove guard; add empty state |

### Files to Create (NEW)

| File | Notes |
|------|-------|
| `frontend/src/pages/ProfilePage.test.tsx` | Page-level tests for navigation + delete behaviour; create only if absent |

### No Backend Changes

This story is **frontend-only**. The backend already accepts empty arrays for all profile section arrays — `PUT /api/v1/profile` with `"workExperiences": []` is valid. No schema or validation changes needed.

---

## Critical Implementation Details

### Current `ProfilePage.tsx` — Progress Indicator Block (lines 232–249)

Current state (confirmed from file read):
```tsx
<ol aria-label="Profile completion steps" className="mb-8 flex gap-4">
  {STEPS.map((label, index) => {
    let className = "text-zinc-400"
    if (index < currentStep) {
      className = "text-zinc-500 line-through"
    } else if (index === currentStep) {
      className = "font-medium text-blue-600"
    }
    return (
      <li key={label} className={className}>
        {index < currentStep ? `✓ ${label}` : label}
      </li>
    )
  })}
</ol>
```

Both problems are in this block: (1) `line-through` class on completed steps (AC2), (2) `✓` prefix on completed steps (AC2), (3) no `onClick` on `<li>` (AC1).

### Current `ExperienceStep.tsx` — Delete Guard (line 157)

```tsx
{/* Show remove button only when more than one entry exists */}
{entries.length > 1 && (
  <button type="button" aria-label={`Remove entry ${index + 1}`} onClick={() => removeEntry(index)} ...>
    ×
  </button>
)}
```

Remove the `entries.length > 1 &&` condition. The same pattern applies to all other step components — search for `entries.length > 1` (or `skills.length > 1`) in each step file.

### `setStep` Is Already Available

`setStep` is already destructured from `useProfileStore()` at the top of `ProfilePage.tsx` (line 46). No new store actions are needed.

### Keyboard Accessibility on Clickable `<li>`

Adding `role="button"`, `tabIndex={0}`, and `onKeyDown` (Enter/Space) to the `<li>` element makes it keyboard-accessible without switching to an `<button>` element (which would affect the `<ol>` list semantics). The `aria-current="step"` attribute is appropriate for the current step in a multi-step wizard.

### Empty State Pattern for Steps

When all entries are deleted from a step, the step must not show an empty form (which would confuse users about whether to fill it in). The empty state should:
1. Show a brief message: "No [type] added yet."
2. Show an inline "Add [type]" link/button that calls the existing `addAnother()` function
3. Still show the "Save & Continue" button (which will submit an empty array — valid per AC5)

This prevents the user from being stuck on a step with no way to proceed or add back entries.

### Validation in `handleSubmit` — Confirmed No Change Needed

`ExperienceStep.handleSubmit` currently:
```tsx
async function handleSubmit() {
  const validated = validateAll()        // returns [] when entries is []
  setEntries(validated)
  const hasErrors = validated.some(...)  // false when validated is []
  if (hasErrors) return                  // does not return
  const workExperiences = validated.map(...)  // []
  await onSaveAndContinue({ workExperiences })  // sends []
}
```
No code change needed in `handleSubmit` for the empty-array case.

---

## Dev Notes

The clickable navigation change makes the profile wizard more forgiving — users who initially enter experience but then realize they want to jump ahead to summary can do so without being gated by incomplete steps. The delete-first-item change removes an inconsistency where the first item was implicitly "locked in" once entered.

The empty-state component per step is important: if a user deletes all entries and the step shows nothing but a "Save & Continue" button, they may be confused about what the step is for. The empty state message and inline add-back button communicates clearly that the section is empty and intentionally so.

The styling change for completed steps (remove `line-through`) brings the UX in line with standard wizard patterns — strikethrough text typically communicates "removed" or "cancelled" rather than "completed". A muted color alone is sufficient to distinguish completed steps from the active one.

---

## File List

### To Create
- `frontend/src/pages/ProfilePage.test.tsx` (if absent)

### To Modify
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/components/profile/ExperienceStep.tsx`
- `frontend/src/components/profile/EducationStep.tsx`
- `frontend/src/components/profile/SkillsStep.tsx`
- `frontend/src/components/profile/CertificationsStep.tsx`
- `frontend/src/components/profile/LanguagesStep.tsx`
- `frontend/src/components/profile/ProjectsStep.tsx`
- `frontend/src/components/profile/VolunteeringStep.tsx`

---

## Change Log
- 2026-06-10: Story created
