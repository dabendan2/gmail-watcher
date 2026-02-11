#!/usr/bin/env node
const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Default workdir
const DEFAULT_WORKDIR = path.join(os.homedir(), '.gmail-watcher');

program
  .option('-v, --version', 'output the version number')
  .option('--workdir <path>', 'specify working directory', DEFAULT_WORKDIR);

// Handle version manually to use git sha
program.on('option:version', () => {
  try {
    const gitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    console.log(gitSha);
  } catch (err) {
    console.log('unknown');
  }
  process.exit(0);
});

// Pass workdir to subcommands via context or global option handling
program.hook('preAction', (thisCommand, actionCommand) => {
  const options = thisCommand.opts();
  const workdir = path.resolve(options.workdir);
  
  if (!fs.existsSync(workdir)) {
    fs.mkdirSync(workdir, { recursive: true });
  }
  
  // Attach context to the action command
  actionCommand.context = { workdir };
});

// Import subcommands
require('../src/cli/config')(program);
require('../src/cli/auth')(program);
require('../src/cli/service')(program);

program.parse(process.argv);
