#!/bin/bash

cd "$(dirname "$0")/.." || exit 1

DIFF=${DIFF:-diff}

global_file="$(mktemp)"
trap 'rm -f "$global_file"' EXIT

cat >"$global_file" << 'EOF'
alpha | https://example.com/a 2
beta | https://example.com/b 1
EOF

local_index="$(
cat << 'EOF'
alpha | 3 | https://example.com/a
alpha | 1 | https://example.com/c
EOF
)"

expected="$(
cat << 'EOF'
alpha | https://example.com/a 5 https://example.com/c 1
beta | https://example.com/b 1
EOF
)"

if $DIFF <(echo "$local_index" | c/merge.js "$global_file") <(echo "$expected") >&2; then
  echo "$0 success: merge.js combines frequencies"
  exit 0
else
  echo "$0 failure: merge.js output mismatch" >&2
  exit 1
fi
