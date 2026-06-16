---
name: fix-low-coverage
description: 'Coordinator that identifies files with low test coverage in SonarQube and dispatches parallel subagents to improve coverage. Use when the user says "fix low coverage", "improve test coverage", "fix coverage", or "/fix-low-coverage [threshold]"'
---

# Low Test Coverage Fix Coordinator

## Role

You are a **coordinator**. Your goal is to systematically improve test coverage for files identified by SonarQube as having low coverage. You prepare fresh coverage data, dispatch an analysis subagent to rank the files, batch them, and delegate improvement work to implementation subagents. You do not write production code or tests yourself. Every code change is delegated to a fresh-context subagent.

## Parameter Parsing

Parse from the skill invocation arguments (the text after `/fix-low-coverage`):

- `{coverage_threshold}` — optional integer 0–100. Only files with line coverage **below** this percentage are targeted.
  - Default: **80** (target all files below 80% line coverage).
- `{max_files}` — optional integer. Maximum number of files to process in this run.
  - Default: unlimited (process all files below the threshold).
- `{parallel_pool_size}` — optional integer 1–10. Maximum number of implementation subagents running at the same time.
  - Default: **3**. Lower this value if you hit API rate limits; raise it to finish faster.

## SonarQube Project Key Resolution

Resolve `{project_key}` in this priority order — stop at the first match:
1. `sonar-project.properties` → `sonar.projectKey` value
2. `.sonarlint/connectedMode.json` → `projectKey` field
3. CI/CD pipeline files (`.github/workflows/*.yml`, `azure-pipelines.yml`, `Jenkinsfile`) → `sonar.projectKey`
4. Call `mcp__sonarqube__search_my_sonarqube_projects` to list projects, then HALT and ask the user to select one

## Preparation Commands

Run these in order before analysis and again after all batches complete:

1. **Backend tests + coverage**: `mvn verify -q`
   - Generates `target/site/jacoco/jacoco.xml`
2. **Frontend tests + coverage**: `npm run test:coverage --prefix frontend`
   - Generates `frontend/coverage/lcov.info`
3. **SonarQube scan**: `sonar-scanner`
   - Uploads fresh coverage data to SonarQube
   - If the quality gate fails, continue anyway — this skill is here to improve coverage, not enforce the gate

## Test Commands (used by implementation subagents)

- **Java source files** (`src/main/java/**`): `mvn test -q`
- **Frontend source files** (`frontend/src/**`): `npm test --prefix frontend -- --run`
- **Mixed batch**: run both commands

## Operating Principles

- **Preparation runs first and last**: run all three preparation commands before dispatching the analysis subagent, and again after all implementation batches complete.
- **One analysis subagent, always first**: a fresh-context subagent fetches coverage data from SonarQube via `mcp__sonarqube__search_files_by_coverage` and returns an ordered file list. Wait for it before batching.
- **Implementation batches run in parallel**: since each batch targets different files, all implementation batches are dispatched simultaneously as background agents. Wait for all to complete before the final report step.
- **Max 5 files per batch**: split the ranked file list into chunks of at most 5.
- **Subagents verify tests pass**: every implementation subagent must run the related tests before reporting success.
- **Source files only, never test files**: subagents improve the _test_ files that exercise the listed _source_ files. They must never modify production source code to increase coverage artificially.
- **Never mark coverage as excluded without user confirmation.**

## Coordinator State

Track these variables across steps:
- `{project_key}` — resolved SonarQube project key
- `{coverage_threshold}` — coverage threshold in use
- `{max_files}` — file cap (or "unlimited")
- `{coverage_before}` — list of `{ rank, file_path, line_coverage_pct, uncovered_lines }` from the analysis phase
- `{all_batches}` — ordered list of `{ batch_num, files }`
- `{completed_batches}` — results per batch: `{ batch_num, files_improved, files_skipped, test_files_modified, test_status, test_failures }`

## FIRST STEP

Read fully and follow: `./steps/step-01-prepare-and-analyze.md`
