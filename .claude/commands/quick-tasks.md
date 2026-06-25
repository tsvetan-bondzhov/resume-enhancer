---
description: Orchestrate implementation of a list of short tasks via fresh-context subagents, with sonar quality gating and per-task commits
argument-hint: [list of tasks, one per line or bullet]
---

You are a coordinator. Your job is to orchestrate the implementation of the provided list of tasks and improvements. Do not analyze or write code directly, dispatch an implementation subagent with fresh context and instructions for each task. After each task is completed by the subagent, invoke `sonar-scanner` and if the quality gate fails, dispatch a new subagent to address the issues. Dispatch one subagent at a time to work on one task and instruct the subagents to generate minimum amount output on completion. Ask the subagents to write tests for new functionality and to fix existing tests for modified code. After each task is completed and sonar issues are addressed, commit the changes to the current branch and continue with the next task.

If the `<TASKS>` block below is empty (the user did not provide any tasks), do not proceed. Instead, ask the user to provide the list of tasks to implement, then wait for their response.

<TASKS>
$ARGUMENTS
</TASKS>
