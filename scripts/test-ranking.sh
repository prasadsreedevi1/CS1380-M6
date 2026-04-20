#!/bin/bash

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

if $DIFF <(src/search/ranking/score.js "$T_FOLDER"/d/results.json) <(cat "$T_FOLDER"/d/expected-ranked.json) >&2;
then
    echo "$0 success: ranking matches expected"
    exit 0
else
    echo "$0 failure: ranking does not match"
    exit 1
fi
