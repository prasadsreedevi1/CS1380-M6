#!/bin/bash

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

if $DIFF <(cat "$T_FOLDER"/d/sample-text.txt | src/search/parsing/tokenize.js | sort) <(sort "$T_FOLDER"/d/expected-tokens.txt) >&2;
then
    echo "$0 success: tokens match expected"
    exit 0
else
    echo "$0 failure: tokens do not match"
    exit 1
fi
