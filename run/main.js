#!/usr/bin/env node

/**
 * entry point, it starts the search engine
 * it initializes app, shows menu, waits for user commands
 */

const readline = require('readline');
const display = require('./ui/display.js');
const processor = require('./commands/processor.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function initialize() {
  console.clear();
  display.showWelcome();
  display.showMenu();
  prompt();
}

function prompt() {
  rl.question('Gitgle> ', (input) => {
    processor.processCommand(input.trim());
    
    if (process.exitCode !== 0) {
      prompt();
    }
  });
}

initialize();
