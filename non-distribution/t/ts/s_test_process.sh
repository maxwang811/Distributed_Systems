#!/bin/bash
# Student test for process.sh

T_FOLDER=${T_FOLDER:-t}

cd "$(dirname "$0")/.." || exit 1

DIFF=${DIFF:-diff}

if $DIFF <(cat "$T_FOLDER"/d/d2.txt | c/process.sh | sort) <(sort "$T_FOLDER"/d/d3.txt) >&2; then
  echo "$0 success: process.sh normalizes and filters"
  exit 0
else
  echo "$0 failure: process.sh output mismatch" >&2
  exit 1
fi
