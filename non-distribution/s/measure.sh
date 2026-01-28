#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./s/measure.sh [--env local|cloud] [--corpus PATH] [--query-runs N]

Runs all tests and measures throughput for crawler, indexer, and query.
Outputs results to perf-results/<env>.json and perf-results/<env>-tests.log.
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT_DIR/d"
OUT_DIR="$ROOT_DIR/perf-results"

ENV_NAME="local"
CORPUS_FILE="$DATA_DIR/urls.txt"
QUERY_RUNS=50

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_NAME="${2:-}"
      shift 2
      ;;
    --corpus)
      CORPUS_FILE="${2:-}"
      shift 2
      ;;
    --query-runs)
      QUERY_RUNS="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$ENV_NAME" ]]; then
  echo "Missing --env value" >&2
  exit 1
fi

if [[ ! -f "$CORPUS_FILE" ]]; then
  echo "Corpus file not found: $CORPUS_FILE" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

backup_dir="$(mktemp -d)"
cleanup() {
  if [[ -d "$backup_dir/d" ]]; then
    rm -rf "$DATA_DIR"
    cp -a "$backup_dir/d" "$DATA_DIR"
  fi
  rm -rf "$backup_dir"
}
trap cleanup EXIT

cp -a "$DATA_DIR" "$backup_dir/d"

TEST_LOG="$OUT_DIR/${ENV_NAME}-tests.log"
set +e
(cd "$ROOT_DIR" && npm test) >"$TEST_LOG" 2>&1
TEST_EXIT=$?
set -e
if [[ $TEST_EXIT -eq 0 ]]; then
  TEST_STATUS="pass"
else
  TEST_STATUS="fail"
fi

# Reset data files for a clean measurement run.
cp -a "$backup_dir/d/stopwords.txt" "$DATA_DIR/stopwords.txt"
cp -a "$CORPUS_FILE" "$DATA_DIR/urls.txt"
: >"$DATA_DIR/visited.txt"
: >"$DATA_DIR/global-index.txt"
: >"$DATA_DIR/local-index.txt"
: >"$DATA_DIR/content.txt"

mapfile -t URLS < <(grep -v '^[[:space:]]*$' "$CORPUS_FILE")
URL_COUNT="${#URLS[@]}"

if [[ "$URL_COUNT" -eq 0 ]]; then
  echo "Corpus file is empty: $CORPUS_FILE" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"

ns_elapsed() {
  local start_ns="$1"
  local end_ns="$2"
  awk -v s="$start_ns" -v e="$end_ns" 'BEGIN {printf "%.6f", (e - s) / 1000000000}'
}

per_sec() {
  local count="$1"
  local seconds="$2"
  awk -v c="$count" -v s="$seconds" 'BEGIN {if (s==0) {print "inf"} else {printf "%.6f", c / s}}'
}

# Crawler throughput: pages/sec
CRAWL_START_NS="$(date +%s%N)"
for i in "${!URLS[@]}"; do
  url="${URLS[$i]}"
  "$ROOT_DIR/crawl.sh" "$url" >"$tmp_dir/content_$i.txt"
done
CRAWL_END_NS="$(date +%s%N)"
CRAWL_SECONDS="$(ns_elapsed "$CRAWL_START_NS" "$CRAWL_END_NS")"
CRAWL_TPUT="$(per_sec "$URL_COUNT" "$CRAWL_SECONDS")"

# Indexer throughput: pages/sec
: >"$DATA_DIR/global-index.txt"
INDEX_START_NS="$(date +%s%N)"
for i in "${!URLS[@]}"; do
  url="${URLS[$i]}"
  "$ROOT_DIR/index.sh" "$tmp_dir/content_$i.txt" "$url"
done
INDEX_END_NS="$(date +%s%N)"
INDEX_SECONDS="$(ns_elapsed "$INDEX_START_NS" "$INDEX_END_NS")"
INDEX_TPUT="$(per_sec "$URL_COUNT" "$INDEX_SECONDS")"

# Query throughput: queries/sec
QUERIES=("sherlock" "adventure" "hector" "war" "trojan")
TOTAL_QUERIES=$((QUERY_RUNS * ${#QUERIES[@]}))
QUERY_START_NS="$(date +%s%N)"
for _ in $(seq 1 "$QUERY_RUNS"); do
  for q in "${QUERIES[@]}"; do
    "$ROOT_DIR/query.js" "$q" >/dev/null
  done
done
QUERY_END_NS="$(date +%s%N)"
QUERY_SECONDS="$(ns_elapsed "$QUERY_START_NS" "$QUERY_END_NS")"
QUERY_TPUT="$(per_sec "$TOTAL_QUERIES" "$QUERY_SECONDS")"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
OUT_JSON="$OUT_DIR/${ENV_NAME}.json"

cat >"$OUT_JSON" <<EOF
{
  "env": "$ENV_NAME",
  "timestamp_utc": "$timestamp",
  "corpus": {
    "file": "$CORPUS_FILE",
    "count": $URL_COUNT
  },
  "tests": {
    "command": "npm test",
    "status": "$TEST_STATUS",
    "exit_code": $TEST_EXIT,
    "log": "$TEST_LOG"
  },
  "throughput": {
    "crawler": {
      "pages": $URL_COUNT,
      "seconds": $CRAWL_SECONDS,
      "pages_per_sec": $CRAWL_TPUT
    },
    "indexer": {
      "pages": $URL_COUNT,
      "seconds": $INDEX_SECONDS,
      "pages_per_sec": $INDEX_TPUT
    },
    "query": {
      "queries": $TOTAL_QUERIES,
      "seconds": $QUERY_SECONDS,
      "queries_per_sec": $QUERY_TPUT,
      "runs": $QUERY_RUNS,
      "terms": ["sherlock", "adventure", "hector", "war", "trojan"]
    }
  }
}
EOF

echo "Wrote results to $OUT_JSON"
