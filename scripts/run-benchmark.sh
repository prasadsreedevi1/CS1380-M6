#!/usr/bin/env bash
set -euo pipefail

# Minimal benchmark loop:
# - runs crawl+index test script
# - repeats multiple trials
# - stores logs in results/benchmarks

RUNS="${RUNS:-3}"
FETCH_MODE="${FETCH_MODE:-mock}"
SEED_FILE="${SEED_FILE:-data/seeds/github-repos.txt}"
OUT_DIR="${OUT_DIR:-results/benchmarks}"
STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="${OUT_DIR}/${STAMP}-${FETCH_MODE}"

mkdir -p "${RUN_DIR}"

echo "Benchmark run directory: ${RUN_DIR}"
echo "Runs: ${RUNS}"
echo "Mode: ${FETCH_MODE}"
echo "Seed file: ${SEED_FILE}"

for i in $(seq 1 "${RUNS}"); do
  LOG_FILE="${RUN_DIR}/trial-${i}.log"
  echo "---- Trial ${i}/${RUNS} ----"
  START_MS="$(date +%s%3N)"
  FETCH_MODE="${FETCH_MODE}" SEED_FILE="${SEED_FILE}" node test-index.js | tee "${LOG_FILE}"
  END_MS="$(date +%s%3N)"
  ELAPSED="$((END_MS - START_MS))"
  echo "trial=${i},elapsed_ms=${ELAPSED}" | tee -a "${RUN_DIR}/timings.csv"
done

echo "Done. See logs and timings in ${RUN_DIR}"
