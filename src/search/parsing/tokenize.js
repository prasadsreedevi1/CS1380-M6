// splits text into individual words
// simple whitespace split after text is already normalized
// returns array of word tokens

function tokenize(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  return text.split(/\s+/).filter(token => token.length > 0);
}

module.exports = {
  tokenize,
};
