#!/usr/bin/env sh
# Run on each worker EC2 (SSH into that box). Uses this instance's private IP.
# Example: PRIVATE_IP=172.31.43.183 ./scripts/start-worker.sh
set -e
IP="${1:-$PRIVATE_IP}"
PORT="${2:-3001}"
if [ -z "$IP" ]; then
  echo "usage: PRIVATE_IP=172.31.x.x $0   OR   $0 172.31.x.x [port]"
  exit 1
fi
cd "$(dirname "$0")/.."
exec node distribution.js --ip "$IP" --port "$PORT"
