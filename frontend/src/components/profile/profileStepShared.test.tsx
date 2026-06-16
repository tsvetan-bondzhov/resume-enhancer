import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import {
  EntryCardHeader,
  StepFooter,
  DateRangeGrid,
  EmptyState,
  RequiredField,
  CurrentToggleAndDescription,
} from "./profileStepShared"

// ─── EntryCardHeader ──────────────────────────────────────────────────────────

describe("EntryCardHeader", () => {
  it("renders the correct entry number (1-based)", () => {
    render(<EntryCardHeader index={0} onRemove={vi.fn()} />)
    expect(screen.getByText("Entry 1")).toBeInTheDocument()
  })

  it("calls onRemove when × button is clicked", () => {
    const onRemove = vi.fn()
    render(<EntryCardHeader index={2} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole("button", { name: /remove entry 3/i }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})

// ─── StepFooter ───────────────────────────────────────────────────────────────

describe("StepFooter", () => {
  it("shows 'Save & Continue' when not saving", () => {
    render(<StepFooter isSaving={false} onAddAnother={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByRole("button", { name: /save & continue/i })).toBeInTheDocument()
  })

  it("shows 'Saving...' when saving", () => {
    render(<StepFooter isSaving={true} onAddAnother={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument()
  })

  it("calls onAddAnother when '+ Add another' button is clicked", () => {
    const onAddAnother = vi.fn()
    render(<StepFooter isSaving={false} onAddAnother={onAddAnother} onSubmit={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /\+ add another/i }))
    expect(onAddAnother).toHaveBeenCalledTimes(1)
  })
})

// ─── DateRangeGrid ────────────────────────────────────────────────────────────

describe("DateRangeGrid", () => {
  it("calls onStartChange when start date input changes (line 92)", () => {
    const onStartChange = vi.fn()
    render(
      <DateRangeGrid
        startId="start"
        endId="end"
        startValue=""
        endValue=""
        onStartChange={onStartChange}
        onEndChange={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: "2023-01-15" } })
    expect(onStartChange).toHaveBeenCalledWith("2023-01-15")
  })

  it("calls onEndChange when end date input changes (line 105)", () => {
    const onEndChange = vi.fn()
    render(
      <DateRangeGrid
        startId="start"
        endId="end"
        startValue=""
        endValue=""
        onStartChange={vi.fn()}
        onEndChange={onEndChange}
      />
    )
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: "2024-06-30" } })
    expect(onEndChange).toHaveBeenCalledWith("2024-06-30")
  })

  it("disables end date input when endDateDisabled=true (branch line 51)", () => {
    render(
      <DateRangeGrid
        startId="start"
        endId="end"
        startValue=""
        endValue=""
        endDateDisabled={true}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/end date/i)).toBeDisabled()
  })

  it("does not disable end date input when endDateDisabled=false (default)", () => {
    render(
      <DateRangeGrid
        startId="start"
        endId="end"
        startValue=""
        endValue=""
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/end date/i)).not.toBeDisabled()
  })
})

// ─── EmptyState ───────────────────────────────────────────────────────────────

describe("EmptyState", () => {
  it("renders message and add label text", () => {
    render(
      <EmptyState message="No entries yet." addLabel="Add one" onAdd={vi.fn()} />
    )
    expect(screen.getByText("No entries yet.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /add one/i })).toBeInTheDocument()
  })

  it("calls onAdd when the add link button is clicked (line 123)", () => {
    const onAdd = vi.fn()
    render(
      <EmptyState message="No entries." addLabel="Add entry" onAdd={onAdd} />
    )
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})

// ─── RequiredField ────────────────────────────────────────────────────────────

describe("RequiredField", () => {
  it("renders label with required asterisk", () => {
    render(
      <RequiredField
        id="title"
        label="Job Title"
        value=""
        placeholder="Enter title"
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/job title/i)).toBeInTheDocument()
  })

  it("shows error message when error prop is provided", () => {
    render(
      <RequiredField
        id="title"
        label="Job Title"
        value=""
        placeholder="Enter title"
        error="This field is required"
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />
    )
    expect(screen.getByText("This field is required")).toBeInTheDocument()
  })

  it("does not show error message when error prop is absent", () => {
    render(
      <RequiredField
        id="title"
        label="Job Title"
        value=""
        placeholder="Enter title"
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />
    )
    expect(screen.queryByText("This field is required")).not.toBeInTheDocument()
  })
})

// ─── CurrentToggleAndDescription ─────────────────────────────────────────────

describe("CurrentToggleAndDescription", () => {
  it("calls onCurrentChange with true when checkbox is checked (line 203)", () => {
    const onCurrentChange = vi.fn()
    render(
      <CurrentToggleAndDescription
        entryId="entry-1"
        isCurrentChecked={false}
        currentLabel="I am currently working here"
        descriptionValue=""
        descriptionPlaceholder="Describe your role"
        onCurrentChange={onCurrentChange}
        onDescriptionChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("checkbox"))
    expect(onCurrentChange).toHaveBeenCalledWith(true)
  })

  it("calls onDescriptionChange when textarea value changes (line 217)", () => {
    const onDescriptionChange = vi.fn()
    render(
      <CurrentToggleAndDescription
        entryId="entry-2"
        isCurrentChecked={false}
        currentLabel="I am currently working here"
        descriptionValue=""
        descriptionPlaceholder="Describe your role"
        onCurrentChange={vi.fn()}
        onDescriptionChange={onDescriptionChange}
      />
    )
    fireEvent.change(screen.getByPlaceholderText("Describe your role"), {
      target: { value: "Built microservices" },
    })
    expect(onDescriptionChange).toHaveBeenCalledWith("Built microservices")
  })

  it("renders the current label text", () => {
    render(
      <CurrentToggleAndDescription
        entryId="entry-3"
        isCurrentChecked={true}
        currentLabel="I am currently volunteering here"
        descriptionValue="Some description"
        descriptionPlaceholder="Describe"
        onCurrentChange={vi.fn()}
        onDescriptionChange={vi.fn()}
      />
    )
    expect(screen.getByText("I am currently volunteering here")).toBeInTheDocument()
  })
})
