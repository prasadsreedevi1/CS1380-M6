/**
 * command processor - recognizes user commands
 * to keep routing logic (help, exit) separate from search logic
 */

const display = require('../ui/display.js');
const searchHandler = require('../search/handler.js');

function processCommand(input) {
  if (!input || input.trim().length === 0) {
    return;
  }

  const command = input.toLowerCase();

  switch (command) {
    case 'exit':
      display.showGoodbye();
      process.exit(0);
      break;
    case 'help':
      display.showDetailedHelp();
      break;
    default:
      searchHandler.handleSearch(input); // treat as search query
  }
}

module.exports = {
  processCommand,
};
