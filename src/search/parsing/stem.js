// reduces words to their root form
// so "running", "runs", "run" all become "run"
// helps find matches even with different word forms

const natural = require('natural');

function stemToken(token) {
  if (!token || typeof token !== 'string') {
    return '';
  }
  return natural.PorterStemmer.stem(token);
}

function stemTokens(tokens) {
  if (!Array.isArray(tokens)) {
    return [];
  }
  return tokens.map(stemToken);
}

module.exports = {
  stemToken,
  stemTokens,
};
