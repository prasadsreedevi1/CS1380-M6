#!/bin/bash

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

if $DIFF <(src/search/query/searchService.js "$T_FOLDER"/d/query.json "$T_FOLDER"/d/index.json) <(cat "$T_FOLDER"/d/expected-results.json) >&2;
then
    echo "$0 success: search results match expected"
    exit 0
else
    echo "$0 failure: search results do not match"
    exit 1
fi
