/**
 * this code parses user input
 * to extract query, language, owner, limit from strings like "React --language JavaScript"
 * 
 * AVAILABLE FLAGS:
 * --language LANG : filter results by programming language
 * example: --language JavaScript, --language Python, --language Go
 * 
 * --owner OWNER : filter results by repository owner
 * example: --owner facebook, --owner nodejs, --owner google
 * 
 * --limit N : maximum number of results to show (default: 10)
 * example: --limit 5, --limit 20, --limit 100
 * 
 * USAGE EXAMPLES:
 * "React hooks"
 * "async/await" --language JavaScript
 * "authentication" --owner facebook
 * "database" --language Python --limit 3
 * "testing" --owner nodejs --language JavaScript --limit 5
 */

function extractOptions(input) {
  const result = {
    query: '',
    language: null,
    owner: null,
    limit: 10,
  };

  let queryParts = [];
  let i = 0;
  const tokens = input.split(/\s+/);

  while (i < tokens.length) {
    const token = tokens[i];

    switch (token) {
      case '--language':
        result.language = tokens[++i];
        break;
      case '--owner':
        result.owner = tokens[++i];
        break;
      case '--limit':
        result.limit = parseInt(tokens[++i], 10) || 10;
        break;
      default:
        queryParts.push(token);
    }
    i++;
  }

  result.query = queryParts.join(' ').trim();
  return result;
}

module.exports = {
  extractOptions,
};
