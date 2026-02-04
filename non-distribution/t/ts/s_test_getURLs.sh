#!/bin/bash

T_FOLDER=${T_FOLDER:-t}

cd "$(dirname "$0")/.." || exit 1

DIFF=${DIFF:-diff}

url="https://cs.brown.edu/courses/csci1380/sandbox/1/level_1a/index.html"

if $DIFF <(cat "$T_FOLDER"/d/d0_nohref.txt | c/getURLs.js "$url" | sort) <(sort "$T_FOLDER"/d/d1_nohref.txt) >&2; then
  echo "$0 success: getURLs.js extracts links with href"
  exit 0
else
  echo "$0 failure: getURLs.js output mismatch" >&2
  exit 1
fi
