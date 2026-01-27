#!/bin/bash
# Student edge-case test for process.sh

cd "$(dirname "$0")/.." || exit 1

DIFF=${DIFF:-diff}

input="$(
cat << 'EOF'
The—quick, brown! 123
EOF
)"

expected="$(
cat << 'EOF'
quick
brown
EOF
)"

if $DIFF <(echo "$input" | c/process.sh) <(echo "$expected") >&2; then
  echo "$0 success: process.sh strips punctuation and stopwords"
  exit 0
else
  echo "$0 failure: process.sh edge-case mismatch" >&2
  exit 1
fi
