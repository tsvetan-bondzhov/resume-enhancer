import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

// ─── Generic submit helper ─────────────────────────────────────────────────────
// Runs the standard validateAll → setEntries → hasErrors-guard →
// buildPayload → onSaveAndContinue sequence shared by every profile step.

export async function runSubmit<TState, TPayload>(
  validateAll: () => TState[],
  setEntries: Dispatch<SetStateAction<TState[]>>,
  hasErrors: (validated: TState[]) => boolean,
  buildPayload: (validated: TState[]) => TPayload,
  onSaveAndContinue: (payload: TPayload) => Promise<void>,
): Promise<void> {
  const validated = validateAll()
  setEntries(validated)
  if (hasErrors(validated)) return
  await onSaveAndContinue(buildPayload(validated))
}

// ─── Generic updateField factory ──────────────────────────────────────────────
// Returns an updateField function that updates a single field on the draft at
// the given index, and clears the corresponding error for any field listed in
// `clearableErrorKeys`.  Supports both string and boolean field values.

export function makeUpdateField<
  TDraft extends { id: string },
  TErrors extends Partial<Record<keyof Omit<TDraft, "id">, string>>,
>(
  setEntries: Dispatch<SetStateAction<Array<{ draft: TDraft; errors: TErrors }>>>,
  clearableErrorKeys: ReadonlyArray<keyof TErrors>,
) {
  return function updateField(
    index: number,
    field: keyof Omit<TDraft, "id">,
    value: string | boolean,
  ) {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const newDraft = { ...entry.draft, [field]: value }
        const newErrors = { ...entry.errors }
        if (clearableErrorKeys.includes(field)) {
          delete newErrors[field as keyof TErrors]
        }
        return { draft: newDraft, errors: newErrors }
      }),
    )
  }
}

// ─── Generic handleBlur factory ───────────────────────────────────────────────
// Returns a handleBlur function that validates a single required text field
// on blur and sets a field-specific error message when the value is empty.
// `fieldLabels` maps each field name to its human-readable label used in the
// error message (e.g. { jobTitle: "Job title", company: "Company" }).

export function makeHandleBlur<
  TDraft extends { id: string; [key: string]: unknown },
  TErrors extends Partial<Record<string, string>>,
>(
  setEntries: Dispatch<SetStateAction<Array<{ draft: TDraft; errors: TErrors }>>>,
  fieldLabels: Partial<Record<string, string>> | string,
) {
  return function handleBlur(index: number, field: keyof Omit<TDraft, "id"> & string) {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const value = entry.draft[field] as string
        if (!value.trim()) {
          const message =
            typeof fieldLabels === "string"
              ? fieldLabels
              : `${fieldLabels[field] ?? field} is required`
          return {
            ...entry,
            errors: { ...entry.errors, [field]: message },
          }
        }
        return entry
      }),
    )
  }
}

// ─── Generic addAnother factory ───────────────────────────────────────────────
// Returns an addAnother function that appends a fresh empty entry to the list.

export function makeAddAnother<TDraft extends { id: string }, TErrors>(
  setEntries: Dispatch<SetStateAction<Array<{ draft: TDraft; errors: TErrors }>>>,
  emptyDraft: () => TDraft,
  emptyErrors: TErrors,
) {
  return function addAnother() {
    setEntries((prev) => [...prev, { draft: emptyDraft(), errors: emptyErrors }])
  }
}

// ─── Generic removeEntry factory ──────────────────────────────────────────────
// Returns a removeEntry function that removes the entry at the given index.

export function makeRemoveEntry<TDraft, TErrors>(
  setEntries: Dispatch<SetStateAction<Array<{ draft: TDraft; errors: TErrors }>>>,
) {
  return function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }
}

// ─── Entry card header ─────────────────────────────────────────────────────────
// Renders the "Entry N" label and the remove (×) button used by every profile step.

interface EntryCardHeaderProps {
  readonly index: number
  readonly onRemove: () => void
}

export function EntryCardHeader({ index, onRemove }: EntryCardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-zinc-600">
        Entry {index + 1}
      </span>
      <button
        type="button"
        aria-label={`Remove entry ${index + 1}`}
        onClick={onRemove}
        className="text-sm text-red-500 hover:text-red-700"
      >
        ×
      </button>
    </div>
  )
}

// ─── Step footer ───────────────────────────────────────────────────────────────
// Renders the "+ Add another" outline button and the "Save & Continue" submit
// button used by every profile step.

interface StepFooterProps {
  readonly isSaving: boolean
  readonly onAddAnother: () => void
  readonly onSubmit: () => void
  readonly submitLabel?: string
}

export function StepFooter({ isSaving, onAddAnother, onSubmit, submitLabel = "Save & Continue" }: StepFooterProps) {
  return (
    <>
      <Button type="button" variant="outline" onClick={onAddAnother}>
        + Add another
      </Button>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={isSaving}>
          {isSaving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </>
  )
}

// ─── Start / End date grid ─────────────────────────────────────────────────────
// Renders the two-column date grid used by steps that have start/end dates.
// Pass `endDateDisabled` for steps that support an "isCurrent" toggle.
// Pass custom `startId` / `endId` when the step needs non-default element IDs.

interface DateRangeGridProps {
  readonly startId: string
  readonly endId: string
  readonly startValue: string
  readonly endValue: string
  readonly endDateDisabled?: boolean
  readonly onStartChange: (value: string) => void
  readonly onEndChange: (value: string) => void
}

export function DateRangeGrid({
  startId,
  endId,
  startValue,
  endValue,
  endDateDisabled = false,
  onStartChange,
  onEndChange,
}: DateRangeGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <label htmlFor={startId} className="text-sm font-medium">
          Start Date
        </label>
        <Input
          id={startId}
          type="date"
          value={startValue}
          onChange={(e) => onStartChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor={endId} className="text-sm font-medium">
          End Date
        </label>
        <Input
          id={endId}
          type="date"
          value={endValue}
          disabled={endDateDisabled}
          onChange={(e) => onEndChange(e.target.value)}
        />
      </div>
    </div>
  )
}

// ─── Empty state banner ────────────────────────────────────────────────────────
// Shown when the entries list is empty. Provides a dashed-border prompt with a
// link that triggers the "add another" action.

interface EmptyStateProps {
  readonly message: string
  readonly addLabel: string
  readonly onAdd: () => void
}

export function EmptyState({ message, addLabel, onAdd }: EmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-zinc-500">
      {message}{" "}
      <button type="button" onClick={onAdd} className="text-blue-600 underline">
        {addLabel}
      </button>
    </div>
  )
}

// ─── Required text field ───────────────────────────────────────────────────────
// Renders a labelled Input with a required asterisk and an optional inline
// validation error message below the field.

interface RequiredFieldProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly placeholder: string
  readonly error?: string
  readonly onChange: (value: string) => void
  readonly onBlur: () => void
}

export function RequiredField({
  id,
  label,
  value,
  placeholder,
  error,
  onChange,
  onBlur,
}: RequiredFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label} <span className="text-red-500">*</span>
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

// ─── Date range + current-toggle + Description block ──────────────────────────
// Combines DateRangeGrid and CurrentToggleAndDescription into one unit.
// Used by steps that have start/end dates and an "isCurrent" toggle
// (experience, volunteering, projects).

interface EntryDateRangeAndActivityProps {
  readonly entryId: string
  readonly startValue: string
  readonly endValue: string
  readonly isCurrent: boolean
  readonly currentLabel: string
  readonly descriptionValue: string
  readonly descriptionPlaceholder: string
  readonly onStartChange: (v: string) => void
  readonly onEndChange: (v: string) => void
  readonly onCurrentChange: (checked: boolean) => void
  readonly onDescriptionChange: (v: string) => void
}

export function EntryDateRangeAndActivity({
  entryId,
  startValue,
  endValue,
  isCurrent,
  currentLabel,
  descriptionValue,
  descriptionPlaceholder,
  onStartChange,
  onEndChange,
  onCurrentChange,
  onDescriptionChange,
}: EntryDateRangeAndActivityProps) {
  return (
    <>
      <DateRangeGrid
        startId={`startDate-${entryId}`}
        endId={`endDate-${entryId}`}
        startValue={startValue}
        endValue={endValue}
        endDateDisabled={isCurrent}
        onStartChange={onStartChange}
        onEndChange={onEndChange}
      />

      <CurrentToggleAndDescription
        entryId={entryId}
        isCurrentChecked={isCurrent}
        currentLabel={currentLabel}
        descriptionValue={descriptionValue}
        descriptionPlaceholder={descriptionPlaceholder}
        onCurrentChange={onCurrentChange}
        onDescriptionChange={onDescriptionChange}
      />
    </>
  )
}

// ─── Current-toggle + Description block ───────────────────────────────────────
// Renders the "I am currently …" checkbox and the free-text Description
// textarea. Used by steps that track an ongoing activity (experience,
// volunteering, projects).

interface CurrentToggleAndDescriptionProps {
  readonly entryId: string
  readonly isCurrentChecked: boolean
  readonly currentLabel: string
  readonly descriptionValue: string
  readonly descriptionPlaceholder: string
  readonly onCurrentChange: (checked: boolean) => void
  readonly onDescriptionChange: (value: string) => void
}

export function CurrentToggleAndDescription({
  entryId,
  isCurrentChecked,
  currentLabel,
  descriptionValue,
  descriptionPlaceholder,
  onCurrentChange,
  onDescriptionChange,
}: CurrentToggleAndDescriptionProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`isCurrent-${entryId}`}
          checked={isCurrentChecked}
          onCheckedChange={(checked) => onCurrentChange(checked === true)}
        />
        <label htmlFor={`isCurrent-${entryId}`} className="text-sm font-medium">
          {currentLabel}
        </label>
      </div>

      <div className="space-y-2">
        <label htmlFor={`description-${entryId}`} className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id={`description-${entryId}`}
          value={descriptionValue}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={descriptionPlaceholder}
          rows={3}
        />
      </div>
    </>
  )
}
