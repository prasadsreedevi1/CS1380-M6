/**
 * it manages the search workflow
 * this code is to coordinate parser, executor, and display in one place
 */

const display = require('../ui/display.js');
const parser = require('../parser/optionParser.js');
const executor = require('../executor/commandExecutor.js');

function handleSearch(input) {
  if (!input || input.trim().length === 0) {
    display.showError('[Usage] Type your search query, optionally with filters');
    return;
  }

  const options = parser.extractOptions(input);
  
  const cliArgs = [options.query];
  if (options.language) {
    cliArgs.push('--language', options.language);
  }
  if (options.owner) {
    cliArgs.push('--owner', options.owner);
  }
  if (options.limit) {
    cliArgs.push('--limit', options.limit.toString());
  }

  display.showSearching();
  executor.executeCommand('node', ['src/cli/searchCli.js', ...cliArgs], (err) => {
    if (err) {
      display.showError(err.message);
    } else {
      display.showSuccess();
    }
  });
}

module.exports = {
  handleSearch,
};
