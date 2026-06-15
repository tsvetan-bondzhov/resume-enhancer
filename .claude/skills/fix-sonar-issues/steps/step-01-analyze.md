# Step 1: Analyze SonarQube Issues

## RULES

- This step is **read-only** — do not modify any files.
- If the SonarQube MCP is unreachable or returns an error, HALT and tell the user with the error details.
- Security hotspots (a separate SonarQube concept) are **not** handled by this skill; only regular issues are fetched.

## INSTRUCTIONS

### 1. Resolve Project Key and Build Tool

Apply the project key resolution and build tool detection logic from `SKILL.md`. Confirm both are set before continuing. If project key cannot be resolved automatically, HALT and ask the user.

### 2. Fetch Issues Per Severity

For each severity in `{active_severities}`, call:

```
mcp__sonarqube__search_sonar_issues_in_projects
  projects:   {project_key}
  severities: <current severity>
  statuses:   OPEN,CONFIRMED,REOPENED
```

Collect all returned issues. Page through results if the tool returns pagination info (fetch until no more pages). Do this for all severities before moving to step 3.

### 3. Fetch Rule Mitigation Details

For each **unique rule key** found across all issues, call:

```
mcp__sonarqube__show_rule
  key: <rule_key>
```

Cache the result by rule key as `{rule_details[rule_key]}`. This gives the subagent detailed mitigation guidance. If `show_rule` fails for a key, log the failure and continue (the subagent will work without that rule's description).

### 4. Enrich and Group Issues

For each issue, attach the cached rule details so the fix subagents receive complete context.

Build `{issues_by_severity}`: a map keyed by severity → map keyed by file path → list of issues.

Example structure:
```
BLOCKER:
  src/main/java/com/example/Foo.java:
    - { key, rule, message, line, rule_details }
    - { key, rule, message, line, rule_details }
CRITICAL:
  src/main/java/com/example/Bar.java:
    - { key, rule, message, line, rule_details }
```

### 5. Build Batch Plan

For each severity in `{active_severities}` (in order), split its files into batches of **at most 5 files each**:

```
{all_batches} = []
batch_num = 1
for severity in active_severities:
  files = sorted(issues_by_severity[severity].keys())  # sort for determinism
  for chunk of up to 5 files:
    all_batches.append({
      severity:    severity,
      batch_num:   batch_num,
      files:       chunk,
      issues:      { file: issues_by_severity[severity][file] for file in chunk }
    })
    batch_num += 1
```

### 6. Present Analysis Summary

Display to the user:

```
SonarQube Issues — Analysis Summary
=====================================
Project : {project_key}
Scanning: {active_severities joined with ", "}

Issues found:
  BLOCKER  : N issues in M files → X batch(es)
  CRITICAL : N issues in M files → X batch(es)
  MAJOR    : N issues in M files → X batch(es)
  MINOR    : N issues in M files → X batch(es)

Total: N issues across M files in X batch(es)

Execution plan:
  Batch 1  [BLOCKER]  — file1.java, file2.java, …
  Batch 2  [BLOCKER]  — file6.java, …
  Batch 3  [CRITICAL] — file10.java, …
  …

Build tool : {build_tool}
Scan cmd   : {scan_command}
```

If zero issues are found for all severities, HALT and tell the user: "No open SonarQube issues found for severities: {active_severities}. Nothing to fix."

## NEXT

Read fully and follow `./steps/step-02-fix-batch.md`
