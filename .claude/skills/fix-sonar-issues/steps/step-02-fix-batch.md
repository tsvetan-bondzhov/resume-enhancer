# Step 2: Fix Batches

Process every batch in `{all_batches}` **sequentially** — one at a time, waiting for each to complete before starting the next.

## RULES

- Never process two batches in parallel.
- Do not skip the sonarscanner validation after any batch.
- All code changes are made by the fix subagent; the coordinator does not edit files.
- Do not advance to a new severity group until all batches in the current severity are validated.

---

## For Each Batch

Repeat the following loop for `batch = all_batches[0], all_batches[1], …`:

---

### 2A. Announce Batch Start

Print:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Batch {batch.batch_num} of {total_batches}
Severity : {batch.severity}
Files    : {batch.files joined with ", "}
Issues   : {total issues in this batch}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 2B. Build and Dispatch the Fix Subagent

Construct the following prompt, substituting all `{…}` placeholders with actual values from the batch and coordinator state. Then dispatch a **fresh-context subagent** (via the Agent tool) with this prompt.

---

**BEGIN FIX SUBAGENT PROMPT TEMPLATE**

```
You are a SonarQube issue fixer for a {build_tool} project.
Your job: fix the SonarQube issues listed below, run the related tests, and report results.
Do NOT modify files outside the listed file paths unless the fix strictly requires it.
Do NOT refactor, clean up, or touch code unrelated to the listed issues.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT CONTEXT
  Project key  : {project_key}
  Build tool   : {build_tool}
  Test command : {test_command_template}
  Severity     : {batch.severity}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ISSUES TO FIX
{For each file in batch.files, format as:}

FILE: {file_path}
{For each issue in batch.issues[file_path]:}
  Issue key : {issue.key}
  Rule      : {issue.rule}
  Line      : {issue.line}
  Message   : {issue.message}
  Rule name : {issue.rule_details.name}
  Mitigation: {issue.rule_details.htmlDesc condensed to key guidance, or "No description available"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 1 — ARCHITECTURE VALIDATION (do this before touching any code)

For EACH file in the list above:

1. Read the file in full.
2. Read project configuration files relevant to the fix:
   - pom.xml / build.gradle / package.json (for library availability)
   - Any framework config files the file imports from
3. For each issue in that file, determine:
   a. Is the suggested mitigation compatible with the libraries and versions already in use?
   b. Does the fix align with the patterns used elsewhere in this codebase for similar problems?
   c. Would applying the fix break any existing behavior or contract that callers depend on?

Classify each issue as one of:
  SAFE     — fix is safe, compatible with architecture, no behavioral change risk
  CONFLICT — fix conflicts with current architecture, missing library, or risky behavioral change

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 2 — USER DECISION FOR CONFLICTS

For each issue classified as CONFLICT, present this block to the user and HALT until they respond:

---
⚠️  Issue requires your decision

  File    : {file}
  Line    : {line}
  Rule    : {rule} — {rule_name}
  Problem : {issue message}
  Conflict: {your explanation of WHY the fix is problematic — be specific:
             which library is missing, which pattern it violates, what behavioral
             risk exists, or why it doesn't match the project's architecture}

  Choose one of:
    [1] Ignore for now     — skip this issue, no code change
    [2] Fix it             — apply the fix despite the conflict (I will do so after your confirmation)
    [3] False positive     — mark this issue as false positive in SonarQube (no code change)

  Reply with 1, 2, or 3.
---

Wait for the user's reply before continuing. Record their choice:
  Choice 1 → skip this issue entirely
  Choice 2 → apply the fix in Phase 3 (treat as SAFE for that issue only)
  Choice 3 → call mcp__sonarqube__change_sonar_issue_status with:
                issue:      {issue.key}
                transition: FALSE_POSITIVE
             Then skip the code fix for this issue.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 3 — APPLY FIXES

Fix all issues classified as SAFE (and any CONFLICT issues where the user chose [2]).

Rules for applying fixes:
  - Make the minimal change needed to resolve the SonarQube rule violation.
  - Do not add comments unless the resulting code would be genuinely confusing without one.
  - Do not reformat code outside the changed lines.
  - Preserve existing tests — if fixing an issue changes a method signature or behavior,
    update the tests to match.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 4 — RUN TESTS

After all code changes are applied:

1. Run: {test_command_template}
2. Examine the output. Report:
   - How many tests passed and failed
   - Which specific tests failed and why
3. If any test failures are caused by your code changes:
   - Attempt to fix them (they are your responsibility)
   - Re-run the tests after fixing
   - If you cannot resolve the failures after one attempt, report the failures and stop
4. If test failures are pre-existing (unrelated to your changes):
   - Note them as pre-existing and continue

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REPORT (return this when done)

Produce a structured report with these fields so the coordinator can track progress:

FIXED:
  - {file}: {rule} line {line} — fixed
  (one line per fixed issue)

IGNORED (user chose [1] or CONFLICT skipped):
  - {file}: {rule} line {line} — ignored
  (one line per ignored issue)

FALSE_POSITIVE (user chose [3]):
  - {file}: {rule} line {line} — marked false positive in SonarQube
  (one line per false-positive issue)

TESTS:
  Status  : PASS | FAIL | PARTIAL
  Passed  : N
  Failed  : N
  Details : {list failing test names if any}

CONFLICTS_SURFACED:
  {list of issues where user made a choice and what they chose}
```

**END FIX SUBAGENT PROMPT TEMPLATE**

---

### 2C. Collect Subagent Results

Parse the subagent's structured report. Store in `{completed_batches}`:
```
{
  batch_num:       batch.batch_num,
  severity:        batch.severity,
  files:           batch.files,
  fixed:           [ list of fixed issues ],
  ignored:         [ list of ignored issues ],
  false_positive:  [ list of false-positive issues ],
  test_status:     PASS | FAIL | PARTIAL,
  test_failures:   [ list of failing tests ],
}
```

If the subagent reports test failures it could not resolve, HALT and ask the user:

> **Test failures in batch {batch.batch_num}:**
> {list of failing tests}
>
> These failures appear to be caused by the fixes applied. How would you like to proceed?
>
> **[1] Revert this batch** — `git checkout -- {batch.files}`; skip to the next batch
> **[2] Continue anyway** — proceed to sonarscanner validation despite test failures
> **[3] Stop the run** — halt here; fixes so far remain uncommitted

Honour the user's choice before continuing.

---

### 2D. Sonarscanner Validation

Run the validation sequence after every batch, regardless of outcome:

**Step D1 — Build:**
```
{build_command}
```
If the build fails, HALT:
> Build failed after batch {batch.batch_num}. Fix the build error before validating.
> Error: {build output}
Then offer the same 3 options as the test-failure prompt above.

**Step D2 — Scan:**
```
{scan_command}
```
If the scan command fails with a non-zero exit code, HALT and report the error. Ask the user whether to retry, continue without validation, or stop.

**Step D3 — Fetch updated issues for this batch's files:**

For each file in `batch.files`, call:
```
mcp__sonarqube__search_sonar_issues_in_projects
  projects:         {project_key}
  componentKeys:    {file}
  statuses:         OPEN,CONFIRMED,REOPENED
```

**Step D4 — Compare:**

- **Resolved check**: For each issue the subagent reported as FIXED, verify it no longer appears in the updated results. If it still appears:
  - Add it to `{unresolved}` for the batch report.

- **New-issue check**: Identify any issues in the updated results that were NOT in the original `batch.issues` list for those files.
  - Flag any new issues with severity **>= current batch severity** as `{new_high_severity}`.
  - Flag new issues with lower severity as `{new_lower_severity}`.

**Step D5 — Handle new high-severity issues:**

If `{new_high_severity}` is non-empty, HALT:

> ⚠️  New issues introduced by batch {batch.batch_num}:
>
> {for each new issue: file, line, severity, rule, message}
>
> These issues have severity equal to or higher than {batch.severity} and were not present before this batch.
>
> **[1] Fix new issues now** — dispatch another fix subagent for these specific issues
> **[2] Revert this batch** — `git checkout -- {batch.files}` and mark files as skipped
> **[3] Proceed anyway** — accept the new issues and continue

Honour the choice:
- **[1]**: Immediately process the new issues using the same fix subagent protocol (Phase 1–4 + validation). Do not advance to the next batch until the new issues are resolved or the user escalates.
- **[2]**: Run `git checkout -- {batch.files}` to discard the batch's changes. Mark these files as REVERTED in the batch record.
- **[3]**: Record the new issues in the batch result and continue.

---

### 2E. Print Batch Completion Line

```
✅ Batch {batch.batch_num} [{batch.severity}] done
   Fixed         : {N} issues
   Ignored       : {N} issues
   False positive: {N} issues
   Still open    : {N} unresolved
   New issues    : {N} introduced (severity >= {batch.severity})
   Tests         : {PASS | FAIL | PARTIAL}
```

---

## After All Batches Are Complete

Read fully and follow `./steps/step-03-final-report.md`
