#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./s/collect-results.sh --env ENV [--corpus PATH] [--query-runs N] [--tests-only]

Convenience wrapper around ./s/measure.sh that standardizes output location.

Examples:
  # Laptop performance (documented corpus):
  ./s/collect-results.sh --env laptop --corpus d/corpora/sandbox2.txt --query-runs 50

  # Cloud performance:
  ./s/collect-results.sh --env cloud --corpus d/corpora/sandbox2.txt --query-runs 50

  # Correctness-only (e.g., Gradescope-like environment):
  ./s/collect-results.sh --env gradescope --tests-only
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ENV_NAME=""
CORPUS_FILE=""
QUERY_RUNS=""
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
  echo "--env is required" >&2
  usage
  exit 1
fi

args=(--env "$ENV_NAME")
if [[ -n "$CORPUS_FILE" ]]; then
  args+=(--corpus "$CORPUS_FILE")
fi
if [[ -n "$QUERY_RUNS" ]]; then
  args+=(--query-runs "$QUERY_RUNS")
fi
if [[ "$TESTS_ONLY" -eq 1 ]]; then
  args+=(--tests-only)
fi

(cd "$ROOT_DIR" && ./s/measure.sh "${args[@]}")
