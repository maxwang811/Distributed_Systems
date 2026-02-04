#!/bin/bash

cd "$(dirname "$0")/.." || exit 1

DIFF=${DIFF:-diff}

missing_file="$(mktemp)"
rm -f "$missing_file"

local_index="$(
cat << 'EOF'
gamma | 2 | https://example.com/g
alpha | 1 | https://example.com/a
EOF
)"

expected="$(
cat << 'EOF'
alpha | https://example.com/a 1
gamma | https://example.com/g 2
EOF
)"

if $DIFF <(echo "$local_index" | c/merge.js "$missing_file") <(echo "$expected") >&2; then
  echo "$0 success: merge.js handles missing global index file"
  exit 0
else
  echo "$0 failure: merge.js edge-case mismatch" >&2
  exit 1
fi
