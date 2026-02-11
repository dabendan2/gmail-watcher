const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

module.exports = (program) => {
  const service = program.command('service')
    .description('Manage background service');

  service.command('start')
    .description('Start the background service')
    .option('-d, --daemon', 'Run in background', false)
    .action((options, command) => {
      const workdir = command.context && command.context.workdir 
        ? command.context.workdir 
        : (command.parent.parent.opts().workdir || require('os').homedir() + '/.gmail-watcher');

      const pidFile = path.join(workdir, 'service.pid');
      const logFile = path.join(workdir, 'service.log');

      // 1. Pre-flight Checks
      try {
        fs.accessSync(workdir, fs.constants.R_OK | fs.constants.W_OK);
      } catch (e) {
        console.error(`Error: Workdir ${workdir} is not accessible.`);
        process.exit(1);
      }
      
      const credsPath = path.join(workdir, 'credentials.json');
      if (!fs.existsSync(credsPath)) {
        console.error("Error: credentials.json not found in ~/.gmail-watcher/. Please run 'auth login' first.");
        process.exit(1);
      }

      const tokenPath = path.join(workdir, 'token.json');
      if (!fs.existsSync(tokenPath)) {
        console.error("Error: token.json not found in ~/.gmail-watcher/. Please run 'auth login' first.");
        process.exit(1);
      }

      const configPath = path.join(workdir, 'config.json');
      let config = {};
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        console.error("Error: config.json is invalid or missing.");
        process.exit(1);
      }
      
      const requiredKeys = ['topic', 'subscription'];
      for (const key of requiredKeys) {
        if (!config[key]) {
          console.error(`Error: Config key '${key}' is missing. Please run 'config set ${key} <value>'.`);
          process.exit(1);
        }
      }

      // 2. Start Service
      const scriptPath = path.resolve(__dirname, '../../src/daemon.js');
      const logStream = fs.openSync(logFile, 'a');

      const child = spawn('node', [scriptPath, '--workdir', workdir], {
        detached: true,
        stdio: ['ignore', logStream, logStream]
      });

      child.unref();

      fs.writeFileSync(pidFile, String(child.pid));
      console.log(`Service started with PID ${child.pid}`);
    });

  service.command('status')
    .description('Check service status')
    .action((options, command) => {
      const workdir = command.context && command.context.workdir 
        ? command.context.workdir 
        : (command.parent.parent.opts().workdir || require('os').homedir() + '/.gmail-watcher');
        
      const pidFile = path.join(workdir, 'service.pid');

      if (fs.existsSync(pidFile)) {
        const pid = fs.readFileSync(pidFile, 'utf8').trim();
        try {
          process.kill(pid, 0); // Check if process exists
          console.log(`Service is running (PID: ${pid})`);
        } catch (e) {
          console.log('Service is not running (stale PID file)');
          fs.unlinkSync(pidFile);
        }
      } else {
        console.log('Service is stopped');
      }
    });

  service.command('stop')
    .description('Stop the service')
    .action((options, command) => {
      const workdir = command.context && command.context.workdir 
        ? command.context.workdir 
        : (command.parent.parent.opts().workdir || require('os').homedir() + '/.gmail-watcher');
        
      const pidFile = path.join(workdir, 'service.pid');

      if (fs.existsSync(pidFile)) {
        const pid = fs.readFileSync(pidFile, 'utf8').trim();
        try {
          process.kill(pid, 'SIGTERM');
          console.log(`Service stopped (PID: ${pid})`);
          fs.unlinkSync(pidFile);
        } catch (e) {
          console.log(`Failed to stop service (PID: ${pid})`);
        }
      } else {
        console.log('Service is not running');
      }
    });

  service.command('logs')
    .description('Tail logs (service.log + gmail.log)')
    .option('-f, --follow', 'Follow log output')
    .action((options, command) => {
      const workdir = command.context && command.context.workdir 
        ? command.context.workdir 
        : (command.parent.parent.opts().workdir || require('os').homedir() + '/.gmail-watcher');

      const serviceLog = path.join(workdir, 'service.log');
      const gmailLog = path.join(workdir, 'gmail.log');
      
      const filesToTail = [];
      if (fs.existsSync(serviceLog)) filesToTail.push(serviceLog);
      if (fs.existsSync(gmailLog)) filesToTail.push(gmailLog);

      if (filesToTail.length === 0) {
        console.log('No logs found.');
        return;
      }
      
      console.log(`Tailing: ${filesToTail.join(', ')}`);

      const { spawn } = require('child_process');
      const args = options.follow ? ['-f', ...filesToTail] : filesToTail;
      
      // Use stdio inherit to stream directly to console
      spawn('tail', args, { stdio: 'inherit' });
    });

  service.command('clean-logs')
    .description('Clear logs (service.log + gmail.log)')
    .action((options, command) => {
      const workdir = command.context && command.context.workdir 
        ? command.context.workdir 
        : (command.parent.parent.opts().workdir || require('os').homedir() + '/.gmail-watcher');

      const serviceLog = path.join(workdir, 'service.log');
      const gmailLog = path.join(workdir, 'gmail.log');
      
      let cleared = false;
      if (fs.existsSync(serviceLog)) {
        fs.truncateSync(serviceLog, 0);
        console.log('Cleared service.log');
        cleared = true;
      }
      if (fs.existsSync(gmailLog)) {
        fs.truncateSync(gmailLog, 0);
        console.log('Cleared gmail.log');
        cleared = true;
      }
      
      if (!cleared) console.log('No logs to clear.');
    });
};
