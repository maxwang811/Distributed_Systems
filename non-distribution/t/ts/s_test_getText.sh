#!/bin/bash
# Student test for getText.js

T_FOLDER=${T_FOLDER:-t}

cd "$(dirname "$0")/.." || exit 1

DIFF=${DIFF:-diff}

if $DIFF <(cat "$T_FOLDER"/d/d0.txt | c/getText.js | sort) <(sort "$T_FOLDER"/d/d2.txt) >&2; then
  echo "$0 success: getText.js extracts text"
  exit 0
else
  echo "$0 failure: getText.js output mismatch" >&2
  exit 1
fi
