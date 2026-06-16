# Step 3: Final Report

## INSTRUCTIONS

### 1. Re-run Preparation Sequence

Run all three commands **sequentially** to push the new test results to SonarQube. If any command fails, note the failure in the report but continue to the reporting step — do not abort.

**Step 1a — Backend tests and coverage (now includes new tests):**
```
mvn verify -q
```

**Step 1b — Frontend tests and coverage (now includes new tests):**
```
npm run test:coverage --prefix frontend
```

**Step 1c — SonarQube scan:**
```
sonar-scanner
```
If the scanner exits non-zero only because the quality gate still fails, continue anyway — coverage may have improved even if the gate threshold has not yet been reached.

---

### 2. Fetch Fresh Coverage Statistics

After the scan completes, call the SonarQube MCP to retrieve the updated coverage for the files that were targeted in this run:

```
mcp__sonarqube__search_files_by_coverage
  projectKey        : {project_key}
  coverageThreshold : {coverage_threshold}
```

Collect all files still below the threshold into `{coverage_after}`.

For each file in `{coverage_before}`, compute the delta:
```
For file F in coverage_before:
  after_pct = coverage_after[F.file_path].line_coverage_pct
               if F is NOT in coverage_after → file has reached/exceeded threshold, use threshold value or last known
  delta     = after_pct - F.line_coverage_pct
  status    = IMPROVED   if delta > 0
              REACHED    if F was below threshold and is now at or above it
              UNCHANGED  if delta == 0
              REGRESSED  if delta < 0
```

---

### 3. Print Final Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Low Coverage Fix Run — Final Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project    : {project_key}
Threshold  : {coverage_threshold}%
Batches    : {count of completed_batches} / {count of all_batches}

COVERAGE CHANGES (per file):
  {file_path}
    Before : {before_pct}%  →  After: {after_pct}%  ({+delta}%)  [{IMPROVED|REACHED|UNCHANGED|REGRESSED}]
  ...

SUMMARY:
  Files targeted                : {count of all files across all batches}
  Files improved                : {count where status is IMPROVED or REACHED}
  Files now meeting threshold   : {count where status is REACHED}
  Files still below threshold   : {count of files still in coverage_after}
  Files unchanged               : {count where status is UNCHANGED}
  Files regressed               : {count where status is REGRESSED}

TEST RESULTS ACROSS ALL BATCHES:
{If all batches reported PASS:}
  All tests passed.
{If any batch reported FAIL or PARTIAL:}
  Failures reported in:
  {for each batch with failures:}
    Batch {N} — {list of failing test names and error summary}

TEST FILES CREATED OR MODIFIED:
{list all test file paths across all completed_batches, deduplicated}
{If none: "None"}

SKIPPED FILES:
{for each file in any batch's files_skipped:}
  {source_file_path} — {reason}
{If none: "None"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 4. Suggest Next Steps

Emit relevant suggestions based on the results:

- If any files are still below `{coverage_threshold}%`:
  > {N} file(s) are still below {coverage_threshold}%. Run `/fix-low-coverage {coverage_threshold}` again to attempt further improvement, or review them manually in SonarQube.

- If any test failures were reported:
  > Test failures were reported in one or more batches. Review the failing tests listed above before committing changes.

- If any files regressed:
  > {N} file(s) show a coverage regression. Verify the test files for those sources were not accidentally modified.

- If all targeted files now meet or exceed the threshold and all tests pass:
  > All targeted files now meet the {coverage_threshold}% coverage threshold and tests are passing. Consider committing the new test files.

---

### 5. HALT

Await the user's next instruction. The run is complete.
