/**
 * ui display - shows messages to user
 * it keeps all UI code (menu, help, errors) in one place
 */

function showWelcome() {
  console.log('\n');
  console.log('     ██████╗ ██╗████████╗ ██████╗ ██╗     ███████╗');
  console.log('    ██╔════╝ ██║╚══██╔══╝██╔════╝ ██║     ██╔════╝');
  console.log('    ██║  ███╗██║   ██║   ██║  ███╗██║     █████╗');
  console.log('    ██║   ██║██║   ██║   ██║   ██║██║     ██╔══╝');
  console.log('    ╚██████╔╝██║   ██║   ╚██████╔╝███████╗███████╗');
  console.log('     ╚═════╝ ╚═╝   ╚═╝    ╚═════╝ ╚══════╝╚══════╝');
  console.log('\n');
  console.log('           GitHub README Search Engine ');
}

function showMenu() {
  console.log('AVAILABLE FLAGS:\n');
  
  console.log('  --language LANG     Filter by programming language');
  console.log('  --owner OWNER       Filter by repository owner');
  console.log('  --limit N           Maximum results to show (default: 10)\n');
  
  console.log('QUICK EXAMPLES:\n');
  
  console.log('  1. Simple search:');
  console.log('     Gitgle> "React hooks"\n');
  
  console.log('  2. Search with language:');
  console.log('     Gitgle> "REST API" --language JavaScript\n');
  
  console.log('  3. Search with owner:');
  console.log('     Gitgle> "authentication" --owner facebook\n');
  
  console.log('  4. Search with limit:');
  console.log('     Gitgle> "Node.js" --limit 5\n');
  
  console.log('  5. All flags combined:');
  console.log('     Gitgle> "async/await" --language Python --owner django --limit 3\n');
  
  console.log('  Type "help" for more details');
  console.log('  Type "exit" to quit\n');
  
  console.log('============================================================\n');
}

function showDetailedHelp() {
  console.log(`
============================================================
                     GITGLE HELP
============================================================

SEARCH SYNTAX:
  "<query>" [--language LANG] [--owner OWNER] [--limit N]

EXAMPLES:

  Basic search:
    Gitgle> "React hooks"
    Gitgle> "REST API"

  Filter by language:
    Gitgle> "async/await" --language JavaScript
    Gitgle> "concurrency" --language Go

  Filter by repository owner:
    Gitgle> "authentication" --owner facebook
    Gitgle> "database" --owner nodejs

  Limit results:
    Gitgle> "server" --limit 5
    Gitgle> "deployment" --limit 20

  Combine filters:
    Gitgle> "React hooks" --language JavaScript --limit 10
    Gitgle> "testing" --owner facebook --language Python --limit 15

AVAILABLE FILTERS:
  --language LANG     Filter by programming language
  --owner OWNER       Filter by repository owner
  --limit N           Maximum number of results (default: 10)

COMMANDS:
  help                Show this help message
  exit                Exit Gitgle

============================================================
`);
}

function showSearching() {
  console.log('\n⏳  Searching through millions of READMEs...');
  console.log('   ⌛ This may take a moment...\n');
}

function showSuccess() {
  console.log('\n✨ Search complete! Results loaded successfully.\n');
}

function showError(message) {
  console.error(`\n⚠️  Oops! Something went wrong:`);
  console.error(`   ${message}\n`);
}

function showGoodbye() {
  console.log('\n👋 Thanks for using GITGLE!');
  console.log('   Happy searching! 🚀\n');
}

module.exports = {
  showWelcome,
  showMenu,
  showDetailedHelp,
  showSearching,
  showSuccess,
  showError,
  showGoodbye,
};
