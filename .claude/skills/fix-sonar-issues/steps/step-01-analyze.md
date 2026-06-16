# Step 1: Analyze SonarQube Issues

## RULES

- This step is **read-only** — do not modify any files.
- If the SonarQube MCP is unreachable or returns an error, HALT and tell the user with the error details.
- Security hotspots (a separate SonarQube concept) are **not** handled by this skill; only regular issues are fetched.
- If `{duplications_only}` is true, skip sections 2 and 3 (issue fetching); jump directly to section 4b (duplication fetching).

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

### 5. Build Issue Batch Plan

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

### 4b. Fetch Duplicated Code (skip if `{process_duplications}` is false)

**Step 4b-1 — Find duplicated files:**

Call:
```
mcp__sonarqube__search_duplicated_files
  projectKey: {project_key}
```

Collect all returned files. Each entry contains a file path and a duplication percentage. Discard files with duplication percentage below 5% (noise threshold).

**Step 4b-2 — Fetch duplication blocks per file:**

For each duplicated file returned above, call:
```
mcp__sonarqube__get_duplications
  key: {file_component_key}
```

This returns the duplicated blocks within that file and references to the other files they duplicate. Collect all blocks.

**Step 4b-3 — Cluster files by shared duplication:**

Group files into clusters where every file in a cluster shares at least one duplicated block with another file in the cluster. Use a union-find or simple flood-fill approach:

```
clusters = {}
for each file F with blocks:
  for each block B in F:
    for each duplicate reference D in B:
      merge cluster(F) with cluster(D.file)

{duplication_clusters} = [
  { cluster_id: N, files: [...], blocks: { file: [blocks] } }
  for each connected component
]
```

Sort clusters by total duplicated lines descending (largest impact first).

**Step 4b-4 — Build duplication batch plan:**

Split clusters into batches of **at most 4 files each** (smaller than issue batches because refactoring is more complex):

```
{duplication_batches} = []
dup_batch_num = 1
for cluster in duplication_clusters:
  for chunk of up to 4 files from cluster.files:
    duplication_batches.append({
      batch_num:  dup_batch_num,
      cluster_id: cluster.cluster_id,
      files:      chunk,
      blocks:     { file: cluster.blocks[file] for file in chunk }
    })
    dup_batch_num += 1
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

Duplicated code: (shown only if {process_duplications} is true)
  Files with duplications : M files in K cluster(s) → X batch(es)
  Largest cluster         : N files sharing ~L duplicated lines

Execution plan:
  Batch 1  [BLOCKER]     — file1.java, file2.java, …
  Batch 2  [BLOCKER]     — file6.java, …
  Batch 3  [CRITICAL]    — file10.java, …
  …
  Dup-1    [DUPLICATION] — fileA.java, fileB.java (cluster 1)
  Dup-2    [DUPLICATION] — fileC.java, fileD.java (cluster 2)
  …

Build tool : {build_tool}
Scan cmd   : {scan_command}
```

If zero issues are found for all severities AND no duplications are found (or duplications are skipped), HALT and tell the user: "No open SonarQube issues or duplicated code found. Nothing to fix."

If only issues or only duplications are found, continue with what is available — do not halt.

## NEXT

Read fully and follow `./steps/step-02-fix-batch.md`
