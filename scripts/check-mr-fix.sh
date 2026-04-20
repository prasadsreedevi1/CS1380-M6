#!/usr/bin/env sh
# Run on coordinator AND each worker from repo root. Exits 0 if MR includes RPC key fix.
set -e
cd "$(dirname "$0")/.."
if grep -q keysPayload src/runtime/all/mr.js; then
  echo "OK: src/runtime/all/mr.js includes keysPayload (map RPC fix)."
  exit 0
fi
echo "BAD: mr.js is missing keysPayload — git pull / use branch with latest MR fix."
exit 1
