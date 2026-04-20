#!/bin/bash

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

if $DIFF <(src/pipelines/indexPipeline.js merge "$T_FOLDER"/d/index1.json "$T_FOLDER"/d/index2.json) <(cat "$T_FOLDER"/d/expected-merged-index.json) >&2;
then
    echo "$0 success: merged index matches expected"
    exit 0
else
    echo "$0 failure: merged index does not match"
    exit 1
fi
