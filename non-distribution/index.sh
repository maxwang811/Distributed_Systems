#!/bin/bash

# index.sh runs the core indexing pipeline.

set -o pipefail

# #region agent log
dbg_escape_json() { printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '%s' "\"(escape_failed)\""; }
dbg_log() {
  local runId="${DEBUG_RUN_ID:-run1}"
  local hyp="$1"; shift
  local loc="$1"; shift
  local msg="$1"; shift
  local data_json="${1:-{}}"
  local ts; ts="$(date +%s%3N)"
  local log_path="${DEBUG_LOG_PATH:-/tmp/cs1380-debug.log}"
  printf '{"sessionId":"debug-session","runId":"%s","hypothesisId":"%s","location":%s,"message":%s,"data":%s,"timestamp":%s}\n' \
    "$runId" "$hyp" "$(dbg_escape_json "$loc")" "$(dbg_escape_json "$msg")" "$data_json" "$ts" \
    >>"$log_path" 2>/dev/null || true
}
# #endregion

in_file="$1"
page_url="$2"
in_lines="$(wc -l < "$in_file" | tr -d ' ' 2>/dev/null || echo 0)"
in_bytes="$(wc -c < "$in_file" | tr -d ' ' 2>/dev/null || echo 0)"
before_gi="$(wc -l < d/global-index.txt | tr -d ' ' 2>/dev/null || echo 0)"
# #region agent log
dbg_log "B" "index.sh:entry" "index start" "{\"url\":$(dbg_escape_json "$page_url"),\"in_lines\":$in_lines,\"in_bytes\":$in_bytes,\"gi_lines_before\":$before_gi}"
# #endregion

cat "$1" |
  c/process.sh |
  c/stem.js |
  c/combine.sh |
  c/invert.sh "$2" |
  c/merge.js d/global-index.txt |
  sort -o d/global-index.txt

status=$?
after_gi="$(wc -l < d/global-index.txt | tr -d ' ' 2>/dev/null || echo 0)"
# #region agent log
dbg_log "B" "index.sh:exit" "index done" "{\"url\":$(dbg_escape_json "$page_url"),\"exit\":$status,\"gi_lines_after\":$after_gi}"
# #endregion
