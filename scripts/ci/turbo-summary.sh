#!/usr/bin/env bash
# Print the latest `turbo run --summarize` result as a Markdown table.
# CI appends the output to $GITHUB_STEP_SUMMARY.
set -euo pipefail

summary=$(ls -t .turbo/runs/*.json 2>/dev/null | head -n 1 || true)
if [[ -z "$summary" ]]; then
  echo "No turbo run summary found. Turbo did not start."
  exit 0
fi

jq -r '
  def status:
    if .execution == null then "not run"
    elif .execution.exitCode == 0 then "passed"
    else "failed (exit \(.execution.exitCode))"
    end;
  def duration:
    if .execution == null then "-"
    else "\((.execution.endTime - .execution.startTime) / 1000) s"
    end;
  "### Turbo tasks",
  "",
  "\(.execution.attempted) tasks, \(.execution.failed) failed, \(.execution.cached) cached.",
  "",
  "| Task | Status | Cache | Duration |",
  "| --- | --- | --- | --- |",
  (.tasks | sort_by(.taskId)[] |
    "| `\(.taskId)` | \(status) | \(.cache.status) | \(duration) |")
' "$summary"
