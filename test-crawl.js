const distribution = require('./distribution.js')({ ip: '127.0.0.1', port: 3000 });

distribution.node.start(() => {
  console.log('Coordinator up');

  const n1 = { ip: '127.0.0.1', port: 3001 };
  const n2 = { ip: '127.0.0.1', port: 3002 };
  const n3 = { ip: '127.0.0.1', port: 3003 };

  distribution.local.status.spawn(n1, () =>
    distribution.local.status.spawn(n2, () =>
      distribution.local.status.spawn(n3, () => {
        const group = {};
        [n1, n2, n3].forEach(n => group[distribution.util.id.getSID(n)] = n);

        distribution.all.groups.put({ gid: 'gitgle' }, group, () => {
          console.log('Group registered');

          const { runCrawl } = require('./src/pipelines/crawlPipeline.js');
          const runtime = {
            store: distribution.gitgle.store,
            executor: distribution.gitgle.mr,
            group: distribution.gitgle,
          };

          runCrawl({ seedFile: './data/seeds/github-repos.txt' }, runtime, (err, stats) => {
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
      })
    )
  );
});