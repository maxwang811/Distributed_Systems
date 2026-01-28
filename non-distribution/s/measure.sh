#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./s/measure.sh [--env NAME] [--corpus PATH] [--query-runs N] [--tests-only]

Runs all tests and measures throughput for crawler, indexer, and query.
Outputs results to perf-results/<env>.json and perf-results/<env>-tests.log.

Use --tests-only to collect correctness results without running performance
benchmarks (useful for environments where benchmarking isn't required).
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT_DIR/d"
OUT_DIR="$ROOT_DIR/perf-results"

ENV_NAME="local"
CORPUS_FILE="$DATA_DIR/urls.txt"
QUERY_RUNS=50
TESTS_ONLY=0

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
    --tests-only)
      TESTS_ONLY=1
      shift 1
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
  echo "--env must be non-empty" >&2
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

TEST_STATUS="fail"
if [[ $TEST_EXIT -eq 0 ]]; then
  TEST_STATUS="pass"
fi

# If we only need correctness, write a minimal JSON result and stop.
if [[ "$TESTS_ONLY" -eq 1 ]]; then
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  OUT_JSON="$OUT_DIR/${ENV_NAME}.json"
  cat >"$OUT_JSON" <<EOF
{
  "env": "$ENV_NAME",
  "timestamp_utc": "$timestamp",
  "tests": {
    "status": "$TEST_STATUS"
  },
  "throughput": null
}
EOF
  echo "Wrote results to $OUT_JSON"
  exit 0
fi

# Reset data files
cp -a "$backup_dir/d/stopwords.txt" "$DATA_DIR/stopwords.txt"

# Only copy corpus if it's not already d/urls.txt
if [[ "$CORPUS_FILE" != "$DATA_DIR/urls.txt" ]]; then
  cp -a "$CORPUS_FILE" "$DATA_DIR/urls.txt"
fi

: >"$DATA_DIR/visited.txt"
: >"$DATA_DIR/global-index.txt"
: >"$DATA_DIR/local-index.txt"
: >"$DATA_DIR/content.txt"

URLS=()
while IFS= read -r line; do
  [[ -z "${line//[[:space:]]/}" ]] && continue
  URLS+=("$line")
done < "$DATA_DIR/urls.txt"
URL_COUNT="${#URLS[@]}"

if [[ "$URL_COUNT" -eq 0 ]]; then
  echo "Corpus file is empty" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"

now_s() {
  python3 -c 'import time; print("{:.9f}".format(time.time()))'
}

per_sec() {
  local count="$1"
  local seconds="$2"
  awk -v c="$count" -v s="$seconds" 'BEGIN {printf "%.6f", c / s}'
}

CRAWL_START_S="$(now_s)"
for i in "${!URLS[@]}"; do
  "$ROOT_DIR/crawl.sh" "${URLS[$i]}" >"$tmp_dir/content_$i.txt"
done
CRAWL_END_S="$(now_s)"
CRAWL_SECONDS="$(awk -v a="$CRAWL_START_S" -v b="$CRAWL_END_S" 'BEGIN{printf "%.6f", (b-a)}')"
CRAWL_TPUT="$(per_sec "$URL_COUNT" "$CRAWL_SECONDS")"

: >"$DATA_DIR/global-index.txt"
INDEX_START_S="$(now_s)"
for i in "${!URLS[@]}"; do
  "$ROOT_DIR/index.sh" "$tmp_dir/content_$i.txt" "${URLS[$i]}"
done
INDEX_END_S="$(now_s)"
INDEX_SECONDS="$(awk -v a="$INDEX_START_S" -v b="$INDEX_END_S" 'BEGIN{printf "%.6f", (b-a)}')"
INDEX_TPUT="$(per_sec "$URL_COUNT" "$INDEX_SECONDS")"

QUERIES=("sherlock" "adventure" "hector" "war" "trojan")
TOTAL_QUERIES=$((QUERY_RUNS * ${#QUERIES[@]}))
QUERY_START_S="$(now_s)"
for _ in $(seq 1 "$QUERY_RUNS"); do
  for q in "${QUERIES[@]}"; do
    "$ROOT_DIR/query.js" "$q" >/dev/null
  done
done
QUERY_END_S="$(now_s)"
QUERY_SECONDS="$(awk -v a="$QUERY_START_S" -v b="$QUERY_END_S" 'BEGIN{printf "%.6f", (b-a)}')"
QUERY_TPUT="$(per_sec "$TOTAL_QUERIES" "$QUERY_SECONDS")"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
OUT_JSON="$OUT_DIR/${ENV_NAME}.json"

corpus_basename="$(basename "$CORPUS_FILE")"
corpus_abs="$(cd "$(dirname "$CORPUS_FILE")" && pwd)/$corpus_basename"
corpus_lines="$(grep -v '^[[:space:]]*$' "$CORPUS_FILE" 2>/dev/null | wc -l | tr -d ' ')"
corpus_bytes="$(wc -c <"$CORPUS_FILE" | tr -d ' ')"
corpus_sha256="$(python3 -c 'import hashlib,sys; p=sys.argv[1]; h=hashlib.sha256(); h.update(open(p,"rb").read()); print(h.hexdigest())' "$CORPUS_FILE" 2>/dev/null || echo "")"

cat >"$OUT_JSON" <<EOF
{
  "env": "$ENV_NAME",
  "timestamp_utc": "$timestamp",
  "tests": {
    "status": "$TEST_STATUS"
  },
  "corpus": {
    "path": "$corpus_abs",
    "basename": "$corpus_basename",
    "nonempty_lines": $corpus_lines,
    "bytes": $corpus_bytes,
    "sha256": "$corpus_sha256"
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
      "queries_per_sec": $QUERY_TPUT
    }
  }
}
EOF

echo "Wrote results to $OUT_JSON"
