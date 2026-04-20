const fs = require('fs');

function loadClusterConfig() {
  const configPath = process.env.CLUSTER_CONFIG || './configs/cluster-4.json';
  if (!fs.existsSync(configPath)) {
    return {
      coordinator: {host: '127.0.0.1', port: 3000},
      workers: [
        {host: '127.0.0.1', port: 3001},
        {host: '127.0.0.1', port: 3002},
        {host: '127.0.0.1', port: 3003},
      ],
    };
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

const cluster = loadClusterConfig();
const coordinator = {
  ip: cluster.coordinator.host,
  port: Number(cluster.coordinator.port || 3000),
};
const workers = (cluster.workers || []).map((w) => ({
  ip: w.host,
  port: Number(w.port || 3001),
}));

const skipWorkerSpawn =
  process.env.SKIP_WORKER_SPAWN === '1' || cluster.skipWorkerSpawn === true;

const distribution = require('./distribution.js')(coordinator);

distribution.node.start(() => {
  console.log('Coordinator up');
  if (skipWorkerSpawn) {
    console.log('SKIP_WORKER_SPAWN: assuming workers already running (remote EC2).');
  }

  function spawnWorker(index, callback) {
    if (index >= workers.length) {
      callback();
      return;
    }
    distribution.local.status.spawn(workers[index], (err) => {
      if (err) {
        callback(err);
        return;
      }
      spawnWorker(index + 1, callback);
    });
  }

  const afterWorkers = (spawnErr) => {
    if (spawnErr) {
      console.error('Worker spawn failed:', spawnErr);
      process.exit(1);
      return;
    }

    const group = {};
    workers.forEach((n) => group[distribution.util.id.getSID(n)] = n);

    distribution.all.groups.put({ gid: 'gitgle' }, group, () => {
      console.log('Group registered');

      const { runCrawl } = require('./src/pipelines/crawlPipeline.js');
      const runtime = {
        store: distribution.gitgle.store,
        executor: distribution.gitgle.mr,
        group: distribution.gitgle,
      };

      const seedFile = process.env.SEED_FILE || cluster.seedFile || './data/seeds/github-repos.txt';
      runCrawl({ seedFile }, runtime, (err, stats) => {
        if (err) {
          console.error('Crawl failed:', err);
          process.exit(1);
        }
        console.log('Crawl stats:', stats);

        distribution.gitgle.store.get(
          { key: 'meta:facebook:react', gid: 'gitgle' },
          (err, val) => {
            if (err) console.error('Verify failed:', err);
            else console.log('Verified repo in store:', val);
            process.exit(0);
          }
        );
      });
    });
  };

  if (skipWorkerSpawn) {
    afterWorkers(null);
  } else {
    spawnWorker(0, afterWorkers);
  }
});