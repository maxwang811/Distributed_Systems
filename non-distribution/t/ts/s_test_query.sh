#!/bin/bash

cd "$(dirname "$0")/.." || exit 1

DIFF=${DIFF:-diff}

cat > d/global-index.txt << 'EOF'
alpha | https://example.com/a 2
alpha beta | https://example.com/a 1
beta | https://example.com/b 3
EOF

if $DIFF <(./query.js alpha) <(printf "%s\n" "alpha | https://example.com/a 2" "alpha beta | https://example.com/a 1") >&2; then
  echo "$0 success: query.js finds matching terms"
  exit 0
else
  echo "$0 failure: query.js output mismatch" >&2
  exit 1
fi
