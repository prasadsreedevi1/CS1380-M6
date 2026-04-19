/**
 * command executor - runs external commands
 * to separate spawn process logic from business logic
 */

const { spawn } = require('child_process');

function executeCommand(cmd, args, callback) {
  const proc = spawn(cmd, args, {
    stdio: 'inherit', // the result will be printed directly to the console
    cwd: process.cwd(),
  });

  proc.on('close', (code) => {
    if (code === 0) {
      callback(null);
    } else {
      callback(new Error('Exit code ' + code));
    }
  });

  proc.on('error', (err) => {
    callback(err);
  });
}

module.exports = {
  executeCommand,
};
