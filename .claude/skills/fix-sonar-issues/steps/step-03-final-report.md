# Step 3: Final Report

## INSTRUCTIONS

### 1. Aggregate Results

Compile totals across all completed issue batches in `{completed_batches}`:

```
{total_fixed}          = sum of fixed counts across all batches
{total_ignored}        = sum of ignored counts across all batches
{total_false_positive} = sum of false-positive counts across all batches
{total_unresolved}     = sum of still-open issues across all batches
{total_new_issues}     = sum of newly introduced issues across all batches
{total_reverted}       = number of files reverted due to user choice
{test_failures}        = all test failures reported across batches
```

Compile totals across all completed duplication batches in `{completed_duplication_batches}` (if any):

```
{total_refactored}     = sum of extracted blocks across all duplication batches
{total_dup_skipped}    = sum of skipped blocks across all duplication batches
{total_new_files}      = all newly created files across all duplication batches (deduplicated)
{dup_test_failures}    = all test failures reported across duplication batches
```

### 2. Print Final Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SonarQube Fix Run — Final Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project   : {project_key}
Severities: {active_severities joined with ", "}
Batches   : {total issue batches completed} / {total issue batches planned}
Dup batches: {total duplication batches completed} / {total duplication batches planned} (omit if 0)

ISSUE RESULTS SUMMARY:
  ✅ Fixed           : {total_fixed} issues
  ⏭️  Ignored         : {total_ignored} issues
  🚫 False positive  : {total_false_positive} issues
  ⚠️  Still open      : {total_unresolved} issues
  🆕 New issues added: {total_new_issues} issues
  ↩️  Batches reverted: {total_reverted} files

RESULTS BY SEVERITY:
{For each severity in active_severities:}
  {severity}: {fixed}/{total} fixed, {false_positive} false positive, {ignored} ignored, {unresolved} still open

DUPLICATION RESULTS SUMMARY: (omit entire section if {process_duplications} is false or no dup batches ran)
  🔁 Blocks extracted : {total_refactored}
  ⏭️  Blocks skipped   : {total_dup_skipped}
  📄 New files created: {total_new_files joined with ", " or "None"}

FILES MODIFIED:
{list of all modified files across all issue batches and duplication batches, deduplicated}

FILES REVERTED:
{list of files that were reverted, or "None"}

TEST RESULTS:
{If all tests passed across both phases:}
  All tests passed across all batches.
{If any failures:}
  Failures reported in the following batches:
  {for each issue batch with failures: Batch N — {list of failing tests}}
  {for each dup batch with failures: Dup-Batch N — {list of failing tests}}

UNRESOLVED ISSUES:
{If none:}
  No unresolved issues remaining for the targeted severities.
{If any:}
  The following issues remain open (not fixed, not ignored, not false positive):
  {for each unresolved: file, line, rule, message, severity}

NEWLY INTRODUCED ISSUES:
{If none:}
  No new issues were introduced.
{If any and user chose to keep them:}
  The following new issues exist in modified files (introduced during this run):
  {for each: file, line, rule, message, severity}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. Suggest Next Steps

Based on the results, suggest one or more of the following as appropriate:

- If `{total_unresolved}` > 0:
  > Some issues could not be fixed automatically. Consider running `/fix-sonar-issues` again targeting those specific files, or reviewing them manually.

- If `{total_new_issues}` > 0 (and user chose to keep them):
  > New issues were introduced during this run. Run `/fix-sonar-issues` again to address them, or review them in SonarQube.

- If `{test_failures}` is non-empty:
  > Test failures were reported. Review the failing tests listed above before committing.

- If `{total_dup_skipped}` > 0:
  > Some duplicated blocks were skipped (diverged or trivial). Review them in SonarQube's "Duplications" tab if needed.

- If all issues were fixed, all duplications resolved, and all tests passed:
  > All targeted SonarQube issues and duplications have been resolved and tests are passing. Consider committing the changes.

### 4. HALT

Await the user's next instruction. The run is complete.
