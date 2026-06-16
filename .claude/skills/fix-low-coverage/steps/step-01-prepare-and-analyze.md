# Step 1: Prepare and Analyze Coverage

## RULES

- This step generates fresh coverage data then identifies files for improvement.
- Do not modify any source or test files in this step.
- If any preparation command fails, HALT and report the full error output to the user before continuing.
- If sonar-scanner fails due to the quality gate, continue anyway — coverage improvement is the goal, not gate enforcement.
- If the SonarQube MCP is unreachable or returns an error, HALT and tell the user with the error details.

---

## INSTRUCTIONS

### 1. Resolve Project Key

Apply the project key resolution logic from `SKILL.md`. Confirm `{project_key}` is set before continuing.

### 2. Run Preparation Sequence

Run the three commands below **sequentially**. Each must complete before the next starts.

**Step 2a — Backend tests and coverage report:**
```
mvn verify -q
```
Compiles the project, runs all Java tests, and generates the JaCoCo XML report at `target/site/jacoco/jacoco.xml`. If this command exits non-zero, HALT and report the error.

**Step 2b — Frontend tests and coverage report:**
```
npm run test:coverage --prefix frontend
```
Runs all Vitest/Jest tests and generates the lcov report at `frontend/coverage/lcov.info`. If this command exits non-zero, HALT and report the error.

**Step 2c — SonarQube scan:**
```
sonar-scanner
```
Uploads both coverage reports to SonarQube. Wait for the process to finish. If it exits non-zero only due to a quality gate failure, continue. If it exits non-zero for any other reason (authentication error, connection refused, etc.), HALT and report the error.

### 3. Dispatch Analysis Subagent

Dispatch a **fresh-context subagent** with the following prompt, substituting `{project_key}`, `{coverage_threshold}`, and `{max_files}` with the resolved values.

For `{max_files}`: if the user did not specify a limit, substitute the literal text `unlimited` and the subagent should return all files found.

---

**BEGIN ANALYSIS SUBAGENT PROMPT**

```
You are a coverage analysis agent. Your sole job is to call the SonarQube MCP, collect files with low test coverage, and return a structured ranked list. Do not modify any files.

PROJECT CONTEXT
  Project key        : {project_key}
  Coverage threshold : {coverage_threshold}%  (collect files BELOW this line coverage)
  File limit         : {max_files}

TASK

Step 1 — Call the SonarQube MCP to search for files with low coverage:

  mcp__sonarqube__search_files_by_coverage
    projectKey        : {project_key}
    coverageThreshold : {coverage_threshold}

  Collect every file returned. If the tool paginates, fetch all pages.

Step 2 — Filter and sort:
  - Keep only files whose lineCoverage (or equivalent coverage metric) is strictly below {coverage_threshold}%.
  - Sort ascending by lineCoverage (lowest coverage first — these have the highest improvement potential).
  - If the file limit is a number (not "unlimited"), keep only the first {max_files} files after sorting.

Step 3 — Return the result in this exact format (no extra explanation):

FILES_WITH_LOW_COVERAGE:
  1 | {file_path} | coverage: {pct}% | uncovered_lines: {N} | total_lines: {M}
  2 | {file_path} | coverage: {pct}% | uncovered_lines: {N} | total_lines: {M}
  ...

TOTAL_FILES_FOUND: {count before any file-limit cap}
TOTAL_FILES_RETURNED: {count after cap}
```

**END ANALYSIS SUBAGENT PROMPT**

---

Wait for the analysis subagent to return before continuing.

### 4. Parse Analysis Results

Parse the subagent's output into `{coverage_before}`:
```
{coverage_before} = [
  { rank, file_path, line_coverage_pct, uncovered_lines, total_lines }
  for each line in FILES_WITH_LOW_COVERAGE
]
```

If `TOTAL_FILES_RETURNED` is 0 or `FILES_WITH_LOW_COVERAGE` is empty, HALT and tell the user:
```
No files found with coverage below {coverage_threshold}%. Nothing to improve.
```

### 5. Build Batch Plan

Split `{coverage_before}` into batches of at most 5 files each, preserving rank order (lowest coverage first):

```
{all_batches} = []
batch_num = 1
for chunk of up to 5 files from coverage_before (in rank order):
  all_batches.append({
    batch_num : batch_num,
    files     : chunk   ← list of { rank, file_path, line_coverage_pct, uncovered_lines }
  })
  batch_num += 1
```

### 6. Present Analysis Summary

Print:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Coverage Analysis — Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project    : {project_key}
Threshold  : {coverage_threshold}%
Files found: {TOTAL_FILES_FOUND} total, {TOTAL_FILES_RETURNED} selected

Files to improve (lowest coverage first):
  #1  {file_path} — {pct}%  ({uncovered_lines} uncovered lines)
  #2  {file_path} — {pct}%  ({uncovered_lines} uncovered lines)
  ...

Execution plan ({N} batch(es) — all dispatched in parallel):
  Batch 1 : {file1}, {file2}, ...
  Batch 2 : {file6}, ...
  ...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## NEXT

Read fully and follow: `./steps/step-02-improve-batch.md`
