#!/bin/bash

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

if $DIFF <(echo "search term" | src/search/query/queryParser.js) <(cat "$T_FOLDER"/d/expected-query-ast.json) >&2;
then
    echo "$0 success: query AST matches expected"
    exit 0
else
    echo "$0 failure: query AST does not match"
    exit 1
fi
