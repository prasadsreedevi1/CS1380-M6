#!/bin/bash

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

if $DIFF <(cat "$T_FOLDER"/d/sample-readme.md | src/search/parsing/extractReadmeText.js) <(cat "$T_FOLDER"/d/expected-text.txt) >&2;
then
    echo "$0 success: extracted text matches expected"
    exit 0
else
    echo "$0 failure: extracted text does not match"
    exit 1
fi
