function extractSnippet(term, content, contextLength = 100) {
  if (!content || !term) return { snippet: '', highlighted: '', position: -1 };

  const lowerContent = content.toLowerCase();
  const position = lowerContent.indexOf(term.toLowerCase());

  if (position === -1) {
    const shortContent = content.substring(0, contextLength * 2).trim();
    return { snippet: shortContent, highlighted: shortContent, position: -1 };
  }

  const startPos = Math.max(0, position - contextLength);
  const endPos = Math.min(content.length, position + term.length + contextLength);
  let snippet = content.substring(startPos, endPos);
  if (startPos > 0) snippet = '...' + snippet;
  if (endPos < content.length) snippet += '...';

  const highlighted = snippet.replace(new RegExp(`(${term})`, 'gi'), '**$1**');
  return { snippet: snippet.trim(), highlighted: highlighted.trim(), position };
}

function extractMultipleSnippets(terms, content, maxSnippets = 3) {
  if (!content || !terms || terms.length === 0) return [];

  const snippets = [];
  const seenPositions = new Set();

  for (const term of terms) {
    if (snippets.length >= maxSnippets) break;
    const snippet = extractSnippet(term, content, 80);
    if (snippet.position >= 0 && !seenPositions.has(snippet.position)) {
      seenPositions.add(snippet.position);
      snippets.push({ term, snippet: snippet.snippet, highlighted: snippet.highlighted, position: snippet.position });
    } else if (snippet.position === -1 && snippets.length === 0) {
      snippets.push({ term, snippet: snippet.snippet, highlighted: snippet.highlighted, position: snippet.position });
    }
  }

  return snippets;
}

function generateExcerpt(content, maxLength = 200, highlights = []) {
  if (!content) return { excerpt: '', wordCount: 0, charCount: 0, highlighted: '' };

  const excerpt = content.substring(0, maxLength).trim();
  let highlighted = excerpt;
  highlights.forEach(term => {
    highlighted = highlighted.replace(new RegExp(`(${term})`, 'gi'), '**$1**');
  });

  const wordCount = content.split(/\s+/).length;
  const charCount = content.length;
  return {
    excerpt: excerpt + (content.length > maxLength ? '...' : ''),
    wordCount: wordCount,
    charCount: charCount,
    highlighted: highlighted + (content.length > maxLength ? '...' : ''),
  };
}

function extractTermMetadata(term, content) {
  if (!content || !term) return { frequency: 0, density: 0, firstOccurrence: -1, lastOccurrence: -1 };

  const lowerContent = content.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let frequency = 0, index = 0, firstOccurrence = -1, lastOccurrence = -1;

  while ((index = lowerContent.indexOf(lowerTerm, index)) !== -1) {
    frequency++;
    if (firstOccurrence === -1) firstOccurrence = index;
    lastOccurrence = index;
    index += lowerTerm.length;
  }

  const totalWords = content.split(/\s+/).length;
  const density = totalWords > 0 ? (frequency / totalWords) * 100 : 0;
  return {
    frequency: frequency,
    density: parseFloat(density.toFixed(2)),
    firstOccurrence: firstOccurrence,
    lastOccurrence: lastOccurrence,
    averagePosition: firstOccurrence >= 0 ? Math.round((firstOccurrence + lastOccurrence) / 2) : -1,
  };
}

function scoreSnippet(snippet, term) {
  if (snippet.position === -1) return 50;

  let score = 100;
  if (snippet.position > 5000) score -= 10;
  else if (snippet.position > 2000) score -= 5;
  if (snippet.snippet.startsWith('...') || snippet.snippet.endsWith('...')) score -= 5;

  return Math.max(50, Math.min(100, score));
}

module.exports = {
  extractSnippet,
  extractMultipleSnippets,
  generateExcerpt,
  extractTermMetadata,
  scoreSnippet,
};
