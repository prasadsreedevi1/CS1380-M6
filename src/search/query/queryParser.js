// parses user search queries into structured form
// extracts filter terms like lang: and owner:
// normalizes and stems the remaining text

const {normalizeText} = require('../parsing/normalize-text.js');
const {tokenize} = require('../parsing/tokenize.js');
const {stemTokens} = require('../parsing/stem.js');

function parseQuery(queryString) {
  if (!queryString || typeof queryString !== 'string') {
    return {
      terms: [],
      rawQuery: '',
    };
  }

  let query = queryString.trim();
  let language = null;
  let owner = null;

  const languageMatch = query.match(/lang:(\S+)/i);
  if (languageMatch) {
    language = languageMatch[1];
    query = query.replace(/lang:\S+/i, '').trim();
  }

  const ownerMatch = query.match(/owner:(\S+)/i);
  if (ownerMatch) {
    owner = ownerMatch[1];
    query = query.replace(/owner:\S+/i, '').trim();
  }

  const normalized = normalizeText(query);
  const tokens = tokenize(normalized);
  const stemmed = stemTokens(tokens);

  return {
    terms: stemmed,
    language,
    owner,
    rawQuery: queryString,
  };
}

module.exports = {
  parseQuery,
};
