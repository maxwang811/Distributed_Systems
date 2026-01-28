#!/bin/bash
# This is the main entry point of the search engine.
cd "$(dirname "$0")" || exit 1

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

i=1
while true; do
  url="$(sed -n "${i}p" d/urls.txt 2>/dev/null)"
  if [[ -z "$url" ]]; then
    visited_count="$(sort -u d/visited.txt 2>/dev/null | wc -l | tr -d ' ')"
    url_count="$(grep -v '^[[:space:]]*$' d/urls.txt 2>/dev/null | sort -u | wc -l | tr -d ' ')"
    # #region agent log
    dbg_log "D" "engine.sh:counts" "Visited/url counts" "{\"visited\":$visited_count,\"urls\":$url_count}"
    # #endregion
    if [[ "$visited_count" -ge "$url_count" ]]; then
      break
    fi
    sleep 0.05
    continue
  fi
  i=$((i + 1))

  if [[ "$url" == "stop" ]]; then
    # stop the engine if it sees the string "stop" 
    exit;
  fi

  # #region agent log
  dbg_log "D" "engine.sh:loop" "Processing url" "{\"url\":$(dbg_escape_json "$url")}"
  # #endregion

  echo "[engine] crawling $url" >&2
  if ./crawl.sh "$url" >d/content.txt; then
    echo "[engine] indexing $url" >&2
    ./index.sh d/content.txt "$url"
  else
    echo "[engine] crawl failed for $url" >&2
  fi

  visited_count="$(sort -u d/visited.txt 2>/dev/null | wc -l | tr -d ' ')"
  url_count="$(grep -v '^[[:space:]]*$' d/urls.txt 2>/dev/null | sort -u | wc -l | tr -d ' ')"
  # #region agent log
  dbg_log "D" "engine.sh:counts" "Visited/url counts" "{\"visited\":$visited_count,\"urls\":$url_count}"
  # #endregion

  if  [[ "$visited_count" -ge "$url_count" ]]; then
      # stop the engine if it has seen all available URLs
      break;
  fi

done
