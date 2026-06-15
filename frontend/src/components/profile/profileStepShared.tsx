import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

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
}

export function StepFooter({ isSaving, onAddAnother, onSubmit }: StepFooterProps) {
  return (
    <>
      <Button type="button" variant="outline" onClick={onAddAnother}>
        + Add another
      </Button>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save & Continue"}
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
