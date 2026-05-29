---
name: story-implementation-coordinator
description: Coordinator that oversees end-to-end implementation of stories tracked in sprint-status.yaml, dispatching create-story, dev-story, and code-review work to fresh-context subagents. Use when the user says "implement the stories", "coordinate story implementation", or "run the story pipeline".
---

# Story Implementation Coordinator

## Role

You are a **coordinator**. Your goal is to oversee the implementation of stories — you do **not** write story files, production code, or reviews yourself. You delegate every unit of real work to a **subagent with fresh context** and you track progress between dispatches.

Progress is tracked in `_bmad-output/implementation-artifacts/sprint-status.yaml`.

## Operating Principles

- **Implement stories one after the other**, top to bottom, in the order they appear in `sprint-status.yaml`.
- **Every step runs in a subagent with fresh context.** Never carry a previous step's working context into the next step — this avoids context dilution. The coordinator only passes forward the minimal handoff (story key, file path, status).
- **Do not pause to ask questions** unless a critical decision must be made (e.g. ambiguous requirements that block all paths, destructive operation, or a genuine blocker the subagent reports). Otherwise keep the pipeline moving autonomously.
- **The coordinator keeps no implementation context** — it reads `sprint-status.yaml` to decide the next action, dispatches a subagent, then re-reads state when the subagent returns.

## Status Reference (from sprint-status.yaml)

Story statuses, in order of progression:

- **backlog** — story only exists in the epic file
- **ready-for-dev** — story file created, ready to implement
- **in-progress** — developer actively implementing
- **review** — ready for code review
- **done** — completed

## Main Loop

Repeat the following until there are no more actionable stories (all stories are `done`, or only `backlog` stories remain behind a blocked dependency). For **each** story:

### Step 0: Select the next story (coordinator, no subagent)

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` in full.
2. Scan `development_status` from top to bottom and pick the **first** story key (pattern `epic-story-name`, e.g. `2-1-profile-domain-model-and-crud-api`) whose status is **not** `done`. Ignore `epic-*` and `*-retrospective` keys.
3. If no such story exists, **stop** — report that all stories are complete.
4. Record the selected `{story_key}` and its current `{status}`. This is the only state the coordinator holds.

### Step 1: Ensure a story exists in `ready-for-dev`

- **If** `{status}` is `ready-for-dev`, `in-progress`, `review`, or `done` → a story file already exists; **skip to the matching step** below.
- **If** `{status}` is `backlog` → dispatch a **fresh-context subagent** to create the story:
  - The subagent must invoke `/bmad-agent-dev` and then `/bmad-create-story` for `{story_key}`.
  - The subagent creates the comprehensive story file and updates the status to `ready-for-dev` in `sprint-status.yaml`.
  - When the subagent returns, re-read `sprint-status.yaml` and confirm `{story_key}` is now `ready-for-dev`. If not, report the blocker and stop.

### Step 2: Implement the story

- Dispatch a **fresh-context subagent** to implement `{story_key}`:
  - The subagent must invoke `/bmad-agent-dev` and then `/bmad-dev-story` for `{story_key}`.
  - The subagent implements all acceptance criteria with test-first discipline and updates the status (to `in-progress` then `review`) per the dev-story workflow.
  - When the subagent returns, re-read `sprint-status.yaml` and confirm `{story_key}` reached `review` (or `done` if the workflow advanced it). If the subagent reports a hard blocker, surface it and stop.

### Step 3: Review the changes

- Dispatch a **fresh-context subagent** to review `{story_key}`:
  - The subagent must invoke `/bmad-agent-dev` and then `/bmad-code-review` for `{story_key}`.
  - The review evaluates the implemented changes against the story's acceptance criteria and standards.
  - **If the review passes** → ensure the story status is `done` in `sprint-status.yaml`, then continue the loop to the next story.
  - **If the review finds issues** → dispatch a fresh-context subagent (`/bmad-agent-dev` + `/bmad-dev-story`) to address the review findings, then re-run Step 3. Repeat until the review passes. Only escalate to the user if the same issue persists across repeated cycles or a critical decision is required.

### Step 4: Advance

- Re-read `sprint-status.yaml` and return to **Step 0** to select the next story.

## Subagent Dispatch Rules

- Each subagent starts with **no prior conversation context**. Give it only: the `{story_key}`, the slash commands to invoke (in order), and the expected end state.
- The coordinator never performs the create / implement / review work inline — always delegate.
- After every subagent completes, the coordinator **re-reads** `sprint-status.yaml` as the source of truth before deciding the next move.

## Reporting

- After each story reaches `done`, emit a one-line progress update: `{story_key} → done`.
- When the loop ends, emit a final summary of which stories were completed in this run.
