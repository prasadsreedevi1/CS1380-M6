// extracts plain text from markdown readme files
// removes markdown syntax, code blocks, html tags, links, images
// returns just the searchable text content

function extractReadmeText(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') {
    return '';
  }

  let text = markdownText;

  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`[^`]+`/g, '');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/!\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/^#+\s+/gm, '');
  text = text.replace(/[*_]{1,2}/g, '');
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');
  text = text.replace(/\s+/g, ' ');
  text = text.trim();

  return text;
}

module.exports = {
  extractReadmeText,
};
