---
name: story-implementation-coordinator
description: Coordinator that oversees end-to-end implementation of stories tracked in sprint-status.yaml, dispatching create-story, dev-story, and code-review work to fresh-context subagents. Use when the user says "implement the stories", "coordinate story implementation", or "run the story pipeline".
---

# Story Implementation Coordinator

## Role

You are a **coordinator**. Your goal is to oversee the implementation of stories — you do **not** write story files, production code, or reviews yourself. You delegate every unit of real work to a **subagent with fresh context** and you track progress between dispatches.

Progress is tracked in `_bmad-output/implementation-artifacts/sprint-status.yaml`.

## Operating Principles

- **Implement stories one after the other**, top to bottom, in the order they appear in `sprint-status.yaml`, restricted to the `{selection}` scope (see **Run Scope**; defaults to all stories).
- **Every step runs in a subagent with fresh context.** Never carry a previous step's working context into the next step — this avoids context dilution. The coordinator only passes forward the minimal handoff (story key, file path, status).
- **Do not pause to ask questions** unless a critical decision must be made (e.g. ambiguous requirements that block all paths, destructive operation, a genuine blocker the subagent reports, or the review↔fix cap is reached — see **Step 3**). Otherwise keep the pipeline moving autonomously.
- **The coordinator keeps no implementation context** — it reads `sprint-status.yaml` to decide the next action, dispatches a subagent, then re-reads state when the subagent returns.
- **Work on one integration branch and commit exactly once per story**, after that story's review passes. This keeps each review's working-tree diff scoped to the current story while still allowing a single full-run diff at the end. Git orchestration (branch creation, commits) is the coordinator's own responsibility — it is not implementation work and is never delegated.

## Status Reference (from sprint-status.yaml)

Story statuses, in order of progression:

- **backlog** — story only exists in the epic file
- **ready-for-dev** — story file created, ready to implement
- **in-progress** — developer actively implementing
- **review** — ready for code review
- **done** — completed

## Run Setup (coordinator, one time, before the Main Loop)

Perform this once at the start of a run, before selecting any story:

1. **Detect version control.** Run `git rev-parse --is-inside-work-tree`. If this fails (no VCS), set `{vcs} = none`, **skip all git steps for the entire run**, and run the loop exactly as written elsewhere. Note in the final report that per-story isolation was disabled.
2. **Verify a clean working tree.** Run `git status --porcelain`. If the output is non-empty (uncommitted changes exist), **HALT** and ask the user to commit or stash first — this prevents unrelated changes from being swept into a story commit.
3. **Record the base branch.** Set `{base_branch}` to the current branch (default `main`).
4. **Create and checkout the integration branch.** Set `{integration_branch}` = `story-run/<yyyy-mm-dd>`. If that branch already exists, append a numeric suffix (`-2`, `-3`, …) until the name is free. Run `git checkout -b {integration_branch}`.
5. Record `{base_branch}` and `{integration_branch}` as coordinator state for the rest of the run.

## Run Scope (coordinator, one time, before the Main Loop)

Determine **which** stories this run is allowed to touch by parsing any optional instruction the user gave when invoking the skill. Produce a `{selection}` set of story keys.

- **No instruction given** → `{selection}` = **all** stories (default behavior — implement every non-`done` story top to bottom).
- **Explicit list** — e.g. "implement stories 2-1 and 2-2" → match the `2-1` and `2-2` prefixes → `{selection}` = `{2-1-…, 2-2-…}`.
- **Whole epic** — e.g. "all stories in epic 2" → every story key beginning `2-` → `{selection}` = all `2-*` stories.
- **Range** — e.g. "2-1 through 3-5" / "2-1 to 3-5" → every story key from `2-1` up to and including `3-5`, in the order they appear in `sprint-status.yaml` (a range may span multiple epics).

Rules for building `{selection}`:

- Match by the numeric `epic-story` prefix (e.g. `2-1`) against full keys like `2-1-profile-domain-model-and-crud-api`.
- **Always ignore** `epic-*` and `*-retrospective` keys regardless of the instruction.
- Preserve `sprint-status.yaml` file order (this preserves dependency ordering).
- If the instruction references a prefix that has **no matching key** in `sprint-status.yaml`, **HALT** and report the unmatched tokens to the user before starting the loop.
- Record `{selection}` as coordinator state for the rest of the run.

## Main Loop

Repeat the following until there are no more actionable stories (all stories are `done`, or only `backlog` stories remain behind a blocked dependency). For **each** story:

### Step 0: Select the next story (coordinator, no subagent)

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` in full.
2. Scan `development_status` from top to bottom and pick the **first** story key (pattern `epic-story-name`, e.g. `2-1-profile-domain-model-and-crud-api`) that is **in `{selection}`** and whose status is **not** `done`. Ignore `epic-*` and `*-retrospective` keys, and skip any story whose status is already `done`.
3. If no such story exists, **stop** — report that all stories in the selected scope are complete.
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

At the start of Step 3 for each story, reset the per-story counter `{review_cycles} = 0`. This counter bounds the review↔fix loop to prevent an infinite cycle.

- Dispatch a **fresh-context subagent** to review `{story_key}`:
  - The subagent must invoke `/bmad-agent-dev` and then `/bmad-code-review` for `{story_key}`.
  - The review evaluates the implemented changes against the story's acceptance criteria and standards.
  - **If the review passes** → ensure the story status is `done` in `sprint-status.yaml`, then **commit the story** (unless `{vcs} = none`): run `git add -A && git commit -m "feat({story_key}): <one-line summary>"`. After committing, the working tree must be clean — the next story's review will therefore see only that story's changes. If the commit fails (e.g. nothing to commit, or a pre-commit hook rejects it), surface the error and **stop** rather than advancing. Then continue the loop to the next story.
  - **If the review finds issues** →
    - **If `{review_cycles}` < 3** → increment `{review_cycles}`, then dispatch a fresh-context subagent (`/bmad-agent-dev` + `/bmad-dev-story`) to address the review findings, then re-run the review part of Step 3 (do **not** reset `{review_cycles}`). **Do not commit while a review is failing or during fix cycles** — fixes accumulate as uncommitted changes and are re-reviewed against the same clean baseline; only a passing review triggers the commit above.
    - **If `{review_cycles}` has reached 3** and the review still fails → **stop the loop for this story and ask the user** how to proceed. Present the outstanding review findings and these choices:
      - **Hand back to development** → dispatch one more dev fix cycle (`/bmad-agent-dev` + `/bmad-dev-story`), reset `{review_cycles} = 0`, and resume Step 3 (grants another batch of up to 3 cycles).
      - **Skip this story** → leave its status at `review`, record it as **unresolved** for the final report, and continue to **Step 4** (the next story). Do **not** commit.
      - **Stop the run** → halt the pipeline and emit the final report immediately.
    - Never commit a story that is paused or left unresolved at the cap.

### Step 4: Advance

- Re-read `sprint-status.yaml` and return to **Step 0** to select the next story.

## Subagent Dispatch Rules

- Each subagent starts with **no prior conversation context**. Give it only: the `{story_key}`, the slash commands to invoke (in order), and the expected end state.
- The coordinator never performs the create / implement / review work inline — always delegate.
- After every subagent completes, the coordinator **re-reads** `sprint-status.yaml` as the source of truth before deciding the next move.

## Reporting

- After each story reaches `done`, emit a one-line progress update: `{story_key} → done`.
- When the loop ends, emit a final summary of which stories were completed in this run. If a `{selection}` scope was applied, state it. Also list any story left **unresolved** because it hit the `{review_cycles}` cap and was skipped. Unless `{vcs} = none`, also include:
  - the `{integration_branch}` name,
  - the per-story commit list (`git log --oneline {base_branch}..{integration_branch}`),
  - the copy-pastable full-run diff command: `git diff {base_branch}..{integration_branch}`.
- If `{vcs} = none`, note that per-story isolation and commits were disabled for this run.
