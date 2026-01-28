#!/bin/bash

tmp_file="$(mktemp d/crawl.XXXXXX)"

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

url="$1"
before_urls="$(wc -l < d/urls.txt | tr -d ' ' 2>/dev/null || echo 0)"
before_visited="$(wc -l < d/visited.txt | tr -d ' ' 2>/dev/null || echo 0)"

if [[ -f d/visited.txt ]] && grep -Fxq "$url" d/visited.txt; then
  # #region agent log
  dbg_log "A" "crawl.sh:dedupe" "already visited, skipping" "{\"url\":$(dbg_escape_json "$url")}"
  # #endregion
  rm -f "$tmp_file"
  exit 0
fi

if ! curl -skL --retry 3 --retry-delay 1 --retry-connrefused --connect-timeout 5 --max-time 20 "$1" >"$tmp_file"; then
  # #region agent log
  dbg_log "A" "crawl.sh:curl" "curl failed" "{\"url\":$(dbg_escape_json "$url")}"
  # #endregion
  echo "$1" >>d/visited.txt
  rm -f "$tmp_file"
  exit 1
fi

bytes="$(wc -c < "$tmp_file" | tr -d ' ')"
echo "$1" >>d/visited.txt

c/getURLs.js "$1" <"$tmp_file" | grep -vxf d/visited.txt >>d/urls.txt
c/getText.js <"$tmp_file"

after_urls="$(wc -l < d/urls.txt | tr -d ' ' 2>/dev/null || echo 0)"
after_visited="$(wc -l < d/visited.txt | tr -d ' ' 2>/dev/null || echo 0)"
# #region agent log
dbg_log "A" "crawl.sh:post" "crawl complete" "{\"url\":$(dbg_escape_json "$url"),\"bytes\":$bytes,\"urls_before\":$before_urls,\"urls_after\":$after_urls,\"visited_before\":$before_visited,\"visited_after\":$after_visited}"
# #endregion

rm -f "$tmp_file"
