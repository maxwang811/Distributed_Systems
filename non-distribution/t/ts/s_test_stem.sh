#!/bin/bash
# Student test for stem.js

cd "$(dirname "$0")/.." || exit 1

DIFF=${DIFF:-diff}

input="$(
cat << 'EOF'
running

runs
studies
EOF
)"

expected="$(
cat << 'EOF'
run
run
studi
EOF
)"

if $DIFF <(echo "$input" | c/stem.js) <(echo "$expected") >&2; then
  echo "$0 success: stem.js basic stemming works"
  exit 0
else
  echo "$0 failure: stem.js output mismatch" >&2
  exit 1
fi
