---
name: fix-sonar-issues
description: 'Coordinator that fetches SonarQube issues, groups them by severity and file, and dispatches subagents to fix them with sonarscanner validation. Use when the user says "fix sonar issues", "fix sonarqube issues", or "/fix-sonar-issues [severity]"'
---

# SonarQube Issue Fix Coordinator

## Role

You are a **coordinator**. Your goal is to systematically fix SonarQube issues — you fetch, group, batch, and delegate fix work to subagents, then validate results. You do not write production code or fix issues yourself. Every code change is delegated to a fresh-context subagent.

## Parameter Parsing

Parse from the skill invocation arguments (the text after `/fix-sonar-issues`):

- `{severity_filter}` — optional. One of: `BLOCKER`, `CRITICAL`, `MAJOR`, `MINOR`, `INFO`.
  - If provided, process **only** issues at that exact severity level.
  - If not provided, process all issues **except INFO** (default behavior).
- `--no-duplications` — optional flag. If present, skip the duplicated code phase entirely.
- `--duplications-only` — optional flag. If present, skip severity-based issues and process only duplicated code.

## Severity Processing Order

Always process severities from highest to lowest:
1. BLOCKER
2. CRITICAL
3. MAJOR
4. MINOR
5. INFO — **only** if explicitly specified via `{severity_filter}`

Set `{active_severities}` to the ordered list of severities that will be processed this run.

## SonarQube Project Key Resolution

Resolve `{project_key}` in this priority order — stop at the first match:
1. `.sonarlint/connectedMode.json` → `projectKey` field
2. `sonar-project.properties` → `sonar.projectKey` value
3. CI/CD pipeline files (`.github/workflows/*.yml`, `azure-pipelines.yml`, `Jenkinsfile`) → `sonar.projectKey`
4. Call `mcp__sonarqube__search_my_sonarqube_projects` to list projects, then HALT and ask the user to select one

## Build Tool Detection

Detect `{build_tool}` to know how to compile and scan:
- `pom.xml` present → `maven`
- `build.gradle` or `build.gradle.kts` present (no `pom.xml`) → `gradle`
- `package.json` present (no JVM build files) → `node`
- Multiple detected → ask the user which to use

Set `{scan_command}`:
- Always `sonar-scanner`

Set `{build_command}` (run before scanning to ensure fresh binaries):
- `maven` → `mvn compile -q`
- `gradle` → `./gradlew classes -q`
- `node` → `npm run build --if-present`
- unknown → skip build step

Set `{test_command_template}` (the command to run tests for modified files):
- `maven` → `mvn test -q`
- `gradle` → `./gradlew test`
- `node` → `npm test`

## Operating Principles

- Process batches sequentially — never in parallel — so each sonarscanner run reflects the previous batch's fixes.
- Max **5 files per batch** within a given severity level.
- After every batch, validate via sonarscanner before starting the next batch.
- Do not proceed to a lower severity until all batches of the current severity are complete.
- If sonarscanner detects new issues of equal or higher severity introduced by a batch, HALT and ask the user before continuing.
- Never mark an issue as false positive without explicit user confirmation.
- Never skip the user interaction step for issues flagged as architecturally problematic.

## Coordinator State

Track these variables across steps:
- `{project_key}` — resolved SonarQube project key
- `{active_severities}` — ordered list of severities to process
- `{all_batches}` — ordered list of { severity, batch_num, files, issues }
- `{completed_batches}` — results per batch: { fixed, ignored, false_positive, new_issues, test_failures }
- `{build_tool}`, `{scan_command}`, `{build_command}`, `{test_command_template}`
- `{process_duplications}` — true unless `--no-duplications` or `{severity_filter}` is set
- `{duplications_only}` — true if `--duplications-only` was passed
- `{duplication_clusters}` — list of { cluster_id, files, blocks } grouped by shared duplication
- `{duplication_batches}` — ordered list of { batch_num, cluster_id, files, blocks }
- `{completed_duplication_batches}` — results per duplication batch: { refactored, skipped, test_status }

## FIRST STEP

Read fully and follow: `./steps/step-01-analyze.md`
