# Distributed Crawl + Index Testing Instructions

This file documents the exact commands and workflow to run and test the distributed crawl/index pipeline in this repository.


## Quick Local Test (single machine)

Run from repo root:

```bash
pkill -f "CS1380-M6/distribution.js" || true
SHARDED_CRAWL=1 SHARD_DIR=data/seeds/shards SHARD_PREFIX=generated-500.shard- CLUSTER_CONFIG=./configs/cluster-local.json SKIP_WORKER_SPAWN=0 npm start
```

---

## Two-Node 

Use `configs/cluster-2.json`.

### Worker (`172.31.35.235`)

```bash
pkill -f "CS1380-M6/distribution.js" || true
cd ~/CS1380-M6
node distribution.js --ip 172.31.35.235 --port 3001
```

### Coordinator (`172.31.37.244`)

```bash
pkill -f "CS1380-M6/distribution.js" || true
cd ~/CS1380-M6
MR_INDEX_TIMEOUT_MS=300000 SHARDED_CRAWL=1 SHARD_DIR=data/seeds/shards SHARD_PREFIX=generated-5k.shard- CLUSTER_CONFIG=./configs/cluster-2.json SKIP_WORKER_SPAWN=1 npm start
```

---

## Full EC2 Cluster Run (5 workers)

Use `configs/cluster-6.json`.

### Start each worker (one terminal per worker)

```bash
pkill -f "CS1380-M6/distribution.js" || true
cd ~/CS1380-M6
node distribution.js --ip <WORKER_PRIVATE_IP> --port 3001
```

### Start coordinator

```bash
pkill -f "CS1380-M6/distribution.js" || true
cd ~/CS1380-M6
MR_INDEX_TIMEOUT_MS=300000 SHARDED_CRAWL=1 SHARD_DIR=data/seeds/shards SHARD_PREFIX=generated-5k.shard- CLUSTER_CONFIG=./configs/cluster-6.json SKIP_WORKER_SPAWN=1 npm start
```

---

## Create Shards

### 500 seeds (5 x 100)

```bash
node scripts/split-seeds.js --input data/seeds/generated-10k.txt --outputDir data/seeds/shards --prefix generated-500 --total 500 --perShard 100
```

### 5,000 seeds (5 x 1,000)

```bash
node scripts/split-seeds.js --input data/seeds/generated-10k.txt --outputDir data/seeds/shards --prefix generated-5k --total 5000 --perShard 1000
```

### 10,000 seeds (10 x 1,000)

```bash
node scripts/split-seeds.js --input data/seeds/generated-10k.txt --outputDir data/seeds/shards --prefix generated-10k --total 10000 --perShard 1000
```

---

## Search Terms That Should Work in Mock Mode

Mock mode data comes from:

- README includes: `mock document for benchmarking distributed crawl and index`
- Description includes: `<repo> repository from <owner>`

Use terms like:

- `mock`
- `benchmarking`
- `distributed`
- `crawl`
- `index`
- exact IDs like `mockowner400` or `mockrepo400`

Note: `repo` is not the same token as `repository` in the current exact-term search path.

---

```

