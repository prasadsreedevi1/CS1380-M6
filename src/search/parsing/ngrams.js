// generates n-grams from tokens for phrase-level indexing
// splits words into overlapping groups (unigrams, bigrams, trigrams)
// lets us search for phrases not just single words

function generateNGrams(tokens, ngramSize) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return [];
  }

  const ngrams = [];
  for (let i = 0; i <= tokens.length - ngramSize; i++) {
    const ngram = tokens.slice(i, i + ngramSize).join(' ');
    ngrams.push(ngram);
  }
  return ngrams;
}

function generateAllNGrams(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return [];
  }

  const allNGrams = [];
  // 1-grams (unigrams)
  allNGrams.push(...tokens);
  // 2-grams (bigrams)
  if (tokens.length >= 2) {
    allNGrams.push(...generateNGrams(tokens, 2));
  }
  // 3-grams (trigrams)
  if (tokens.length >= 3) {
    allNGrams.push(...generateNGrams(tokens, 3));
  }
  return allNGrams;
}

module.exports = {
  generateNGrams,
  generateAllNGrams,
};
