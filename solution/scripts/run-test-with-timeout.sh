#!/usr/bin/env bash
# Runs a test command with wall-clock timeout, captures output, kills the process group.
# Usage: run-test-with-timeout.sh '<inner shell command>'
# Exit 124 = timed out; otherwise propagates the test command exit code.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: run-test-with-timeout.sh '<command>'" >&2
  exit 2
fi

TIMEOUT_SEC="${TEST_TIMEOUT_SEC:-60}"
TAIL_LINES="${TEST_OUTPUT_TAIL_LINES:-100}"
INNER=$1

log="$(mktemp)"
trap 'rm -f "$log"' EXIT

set +e
timeout --kill-after=5 "$TIMEOUT_SEC" setsid bash -lc "$INNER" >"$log" 2>&1
rc=$?
set -e

if [[ "$rc" -eq 0 ]]; then
  cat "$log"
  exit 0
fi

if [[ "$rc" -eq 124 ]]; then
  echo "TEST RUN TIMED OUT. The test process did not settle within ${TIMEOUT_SEC} seconds."
  echo "Check for render/update loops, unresolved async work, recurring timers, or other non-terminating behavior."
  if [[ -s "$log" ]]; then
    echo "--- Last ${TAIL_LINES} lines of captured output ---"
    tail -n "$TAIL_LINES" "$log"
  fi
  exit 124
fi

cat "$log"
exit "$rc"
