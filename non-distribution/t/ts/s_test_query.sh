#!/bin/bash
# This is a student test

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/../..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

term="check"

cat "$T_FOLDER"/d/d7.txt > d/global-index.txt


if $DIFF <(./query.js "$term") <(cat "$T_FOLDER"/d/d9.txt) >&2;
then
    echo "$0 test 1 success (./query check vs d9.txt)"
else
    echo "$0 test 1 failure (./query check vs d9.txt)"
    exit 1
fi

term="level"
if $DIFF <(./query.js "$term") <(cat "$T_FOLDER"/d/d10.txt) >&2;
then
    echo "$0 test 2 success (./query level vs d10.txt)"
else
    echo "$0 test 2 failure (./query level vs d10.txt)"
    exit 1
fi

echo "$0 all tests passed"
exit 0