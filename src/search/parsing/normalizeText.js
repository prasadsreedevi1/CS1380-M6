// cleans text for indexing
// converts to lowercase, removes special characters, collapses whitespace
// turns messy text into something we can work with

function normalizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
      .toLowerCase()           
      .replace(/[^a-z0-9\s]/g, ' ')  
      .replace(/\s+/g, ' ')   
      .trim();               
}

module.exports = {
  normalizeText,
};
