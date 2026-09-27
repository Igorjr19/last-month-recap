---
description: Suggest the next unblocked GitHub issue to work on
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh api:*), Bash(gh pr list:*), Bash(git status:*), Bash(git branch:*)
---

Suggest the next issue to work on. Read only: do not edit files, create branches or change issues.

## Steps

1. Fetch open issues with their metadata. Plain `gh issue view` fails on this repo (Projects classic deprecation), so always pass `--json`:

   ```sh
   gh issue list --state open --limit 200 \
     --json number,title,labels,milestone,body,assignees
   ```

2. Find which issues are blocked. An issue's dependencies are the `- #<n>` lines under its `## Depends on` heading. An issue is **unblocked** when every dependency is closed. Check a dependency's state with `gh issue view <n> --json state -q .state` when it is not in the open list.

3. Skip issues that already have an open PR (`gh pr list --state open --json number,title,headRefName,body`, match `#<n>` in the body or the issue number in the branch name) and issues labelled `type:epic` (they get split before work starts).

4. Rank the unblocked issues by:
   1. Milestone, lowest first (`M0` before `M1`, and so on).
   2. Priority label: `priority:p1`, then `p2`, then `p3`.
   3. Issue number, lowest first.

5. Report:
   - The recommended issue: number, title, milestone, labels, and a two or three line summary of its Tasks and Acceptance criteria.
   - The next two or three candidates, one line each.
   - Blocked issues in the current milestone, with what blocks them.
   - Any local state that matters: uncommitted changes or a checked-out feature branch (`git status -sb`).

End with: `Run /issue <n> to start.`
