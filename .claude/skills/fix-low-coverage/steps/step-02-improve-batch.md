# Step 2: Improve Coverage — Pool-Based Parallel Batch Dispatch

Process all batches in `{all_batches}` using a sliding pool: dispatch up to `{parallel_pool_size}` batches simultaneously, and as each one completes start the next queued batch immediately. Continue until all batches are done.

## RULES

- Never run more than `{parallel_pool_size}` implementation subagents at the same time.
- As soon as a running subagent finishes, immediately dispatch the next queued batch (if any remain) to keep the pool full.
- Wait for the entire pool to drain before proceeding to step 3.
- Do not modify any files yourself — all code changes are made by subagents.
- If a subagent reports unresolvable test failures, record the failure and continue — do not block other batches or the final report.

---

## 2A. Announce Dispatch

Print:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dispatching {N} coverage batch(es) in parallel
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {for each batch: Batch {N} — {file1}, {file2}, ...}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 2B. Build and Dispatch ALL Implementation Subagents Simultaneously

For **each** batch in `{all_batches}`, construct the prompt below — substituting all `{…}` placeholders with actual values — and dispatch it as a **background subagent**. Dispatch all batches before waiting for any to return.

---

**BEGIN COVERAGE IMPROVEMENT SUBAGENT PROMPT TEMPLATE**

```
You are a test coverage improvement agent for a Java + TypeScript project.
Your job: add or improve tests for the listed source files to increase line coverage. Do NOT modify production source files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT CONTEXT
  Project key      : {project_key}
  Batch            : {batch.batch_num} of {total_batches}
  Project root     : C:\Users\tseko\Documents\Projects\resume-enhancer
  Java test path   : src/test/java/...   (mirrors src/main/java/... — class name appended with "Test")
  TS test path     : same directory as source file, or frontend/src/test/
  Java test cmd    : mvn test -q
  TS test cmd      : npm test --prefix frontend -- --run
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILES TO IMPROVE (in this batch)
{For each file in batch.files:}
  Source file       : {file.file_path}
  Current coverage  : {file.line_coverage_pct}%
  Uncovered lines   : {file.uncovered_lines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 1 — GATHER COVERAGE DETAILS

For EACH source file listed above:

1. Derive the component key for the SonarQube MCP call:
   - Component key format: {project_key}:{file.file_path}
     Example: "Resume-Enhancer:src/main/java/com/example/Foo.java"

2. Call the SonarQube MCP to get line-level coverage details:
   mcp__sonarqube__get_file_coverage_details
     key: <component_key_from_step_1>

   This returns which specific lines and branches are uncovered.

3. Read the source file in full to understand the code.

4. Locate the existing test file:
   - Java source (src/main/java/com/pkg/ClassName.java)
     → look for src/test/java/com/pkg/ClassNameTest.java
   - TypeScript source (frontend/src/components/Foo.tsx)
     → look for frontend/src/components/Foo.test.tsx  OR  frontend/src/test/Foo.test.tsx
   If a test file exists, read it in full to understand the existing test style and avoid duplicating tests.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 2 — PLAN TEST IMPROVEMENTS

For each file, using the uncovered lines and branches from Phase 1:

1. Identify the code paths that are not yet covered (e.g. else branches, exception paths, edge cases).
2. Design minimal test cases that exercise those specific paths. Prioritise:
   - Lines/branches with 0 hits
   - Error-handling paths (catch blocks, guard clauses)
   - Edge cases (null inputs, empty collections, boundary values)
3. Decide where to add the tests:
   - Prefer adding to the existing test file
   - Create a new test file only if none exists
4. Classify files that cannot be meaningfully tested (e.g. pure DTOs with no logic, auto-generated code):
   - Mark as SKIP with a brief reason

IMPORTANT constraints:
- Do NOT modify production source files — only test files
- Do NOT delete or weaken existing tests
- Do NOT write trivial tests that add no real assertion (e.g. testing only object construction with no behaviour)
- Match the existing test style: imports, mocking framework, assertion library, naming conventions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 3 — IMPLEMENT TESTS

Write the tests planned in Phase 2.

For Java:
- Add new @Test methods to the existing *Test.java class, or create the file if it does not exist.
- Use the same imports and mocking approach (Mockito, Spring test slices, etc.) as existing tests in the same package.

For TypeScript:
- Add new test cases (it/test blocks) to the existing *.test.ts(x) file, or create one if it does not exist.
- Use the same testing library and mocking approach as existing tests in that directory.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 4 — RUN AND VERIFY TESTS

After all test changes for this batch are in place:

1. Determine the test command:
   - All files are Java (src/main/java/**) → run: mvn test -q
   - All files are frontend (frontend/src/**) → run: npm test --prefix frontend -- --run
   - Mixed → run both commands in sequence

2. Run the test command(s).

3. Evaluate the result:
   - All tests pass → proceed to REPORT
   - Any test fails:
     a. If the failure is in a test you just wrote → fix the test and re-run once
     b. If still failing after one fix attempt → keep the fix attempt, report the failure; do NOT revert
     c. If the failure is pre-existing (exists in a test you did not touch) → note as pre-existing, continue

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REPORT (return this when done — use this exact structure)

BATCH: {batch.batch_num}

FILES_IMPROVED:
  - {source_file_path} | tests_added: {N} | targeted_lines: {line_numbers or range}
  (one entry per file where tests were written)

FILES_SKIPPED:
  - {source_file_path} | reason: {why no tests could be meaningfully added}
  (one entry per skipped file; omit section if none)

TEST_FILES_MODIFIED:
  - {test_file_path} | action: created | OR action: modified
  (one entry per test file that was created or changed; omit section if none)

TEST_RUN:
  command : {the command(s) run}
  status  : PASS | FAIL | PARTIAL
  passed  : {N}
  failed  : {N}
  failures: {list of failing test names and error summary, or "none"}
```

**END COVERAGE IMPROVEMENT SUBAGENT PROMPT TEMPLATE**

---

## 2C. Wait for All Subagents

Wait until every background subagent has returned. As each one completes, print a one-line summary:
```
Batch {N} complete — {M} file(s) improved | tests: {PASS|FAIL|PARTIAL}
```

---

## 2D. Collect All Batch Results

For each completed subagent, parse the structured report and append to `{completed_batches}`:
```
{
  batch_num          : batch.batch_num,
  files_improved     : [ { source_file_path, tests_added, targeted_lines } ],
  files_skipped      : [ { source_file_path, reason } ],
  test_files_modified: [ { test_file_path, action } ],
  test_status        : PASS | FAIL | PARTIAL,
  test_failures      : [ { test_name, error_summary } ]
}
```

---

## NEXT

Read fully and follow: `./steps/step-03-final-report.md`
