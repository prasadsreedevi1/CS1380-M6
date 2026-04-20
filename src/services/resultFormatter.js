// formats search results for different output formats
// supports cli, json, and csv output
// handles truncation and escaping for each format

function formatResultForCLI(result, rank) {
  if (!result) {
    return '';
  }

  const lines = [];
  lines.push(`\n${rank}. ${result.owner}/${result.repo}`);
  lines.push(`   URL: ${result.url}`);

  if (result.description) {
    lines.push(`   Description: ${result.description.substring(0, 80)}...`);
  }

  if (result.language) {
    lines.push(`   Language: ${result.language}`);
  }

  if (result.stars) {
    lines.push(`   Stars: ${result.stars}`);
  }

  if (result.score !== undefined) {
    lines.push(`   Score: ${result.score.toFixed(4)}`);
  }

  if (result.snippet) {
    lines.push(`   Match: ${result.snippet.substring(0, 100)}...`);
  }

  if (result.termMetadata) {
    const tm = result.termMetadata;
    const metaStr = [];
    if (tm.frequency) metaStr.push(`freq: ${tm.frequency}`);
    if (tm.density) metaStr.push(`density: ${tm.density}%`);
    if (metaStr.length > 0) {
      lines.push(`   Metadata: ${metaStr.join(', ')}`);
    }
  }

  if (result.docMetadata) {
    const dm = result.docMetadata;
    const metaStr = [];
    if (dm.wordCount) metaStr.push(`${dm.wordCount} words`);
    if (metaStr.length > 0) {
      lines.push(`   Doc: ${metaStr.join(', ')}`);
    }
  }

  return lines.join('\n');
}

function formatResultsForCLI(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return 'No results found.';
  }

  const header = `\nFound ${results.length} result(s):\n`;
  const formatted = results
      .map((result, idx) => formatResultForCLI(result, idx + 1))
      .join('\n');

  return header + formatted + '\n';
}

function formatResultsAsJSON(searchResponse) {
  return JSON.stringify(searchResponse, null, 2);
}

function formatResultsAsCSV(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return 'owner,repo,url,language,stars,score\\n';
  }

  const header = 'owner,repo,url,language,stars,score\\n';
  const rows = results.map(r => {
    const language = r.language || '';
    const description = (r.description || '').replace(/,/g, ';').substring(0, 50);
    return `"${r.owner}","${r.repo}","${r.url}","${language}",${r.stars},${r.score.toFixed(4)}`;
  }).join('\n');

  return header + rows;
}

module.exports = {
  formatResultForCLI,
  formatResultsForCLI,
  formatResultsAsJSON,
  formatResultsAsCSV,
};
