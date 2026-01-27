#!/bin/bash
# Student edge-case test for getURLs.js

cd "$(dirname "$0")/.." || exit 1

DIFF=${DIFF:-diff}

base="https://example.com/root"
input="$(
cat << 'EOF'
<html>
  <body>
    <a href="page.html">Relative</a>
    <a href="/abs/path">Absolute</a>
  </body>
</html>
EOF
)"

expected="$(
cat << 'EOF'
https://example.com/abs/path
https://example.com/root/page.html
EOF
)"

if $DIFF <(echo "$input" | c/getURLs.js "$base" | sort) <(echo "$expected" | sort) >&2; then
  echo "$0 success: getURLs.js handles base URL without trailing slash"
  exit 0
else
  echo "$0 failure: getURLs.js edge-case mismatch" >&2
  exit 1
fi
