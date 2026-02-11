const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

module.exports = (program) => {
  const service = program.command('service')
    .description('Manage background service');

  service.command('start')
    .description('Start the background service')
    .option('-d, --daemon', 'Run in background', false)
    .action(async (options, command) => {
      const workdir = command.context && command.context.workdir 
        ? command.context.workdir 
        : (command.parent.parent.opts().workdir || require('os').homedir() + '/.gmail-watcher');

      const pidFile = path.join(workdir, 'service.pid');
      const logFile = path.join(workdir, 'service.log');

      // Check if already running
      if (fs.existsSync(pidFile)) {
        const oldPid = fs.readFileSync(pidFile, 'utf8').trim();
        try {
          process.kill(oldPid, 0);
          console.error(`Error: Service is already running (PID: ${oldPid})`);
          process.exit(1);
        } catch (e) {
          fs.unlinkSync(pidFile);
        }
      }

      const scriptPath = path.resolve(__dirname, '../../src/daemon.js');
      
      if (options.daemon) {
        // --- DAEMON MODE ---
        const logStream = fs.openSync(logFile, 'a');
        const child = spawn('node', [scriptPath, '--workdir', workdir], {
          detached: true,
          stdio: ['ignore', logStream, logStream]
        });

        // Use a temporary pipe to catch immediate startup errors
        let startupError = '';
        const checkChild = spawn('node', [scriptPath, '--workdir', workdir], {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        const errorPromise = new Promise((resolve) => {
          checkChild.stderr.on('data', (data) => {
            startupError += data.toString();
          });
          checkChild.on('exit', (code) => {
            resolve(code);
          });
          // Timeout after 2 seconds - if it's still running, assume basic init passed
          setTimeout(() => {
            checkChild.kill();
            resolve(0);
          }, 2000);
        });

        const exitCode = await errorPromise;
        if (exitCode !== 0 && startupError) {
          console.error('\n❌ 啟動失敗！日誌摘要：');
          console.error('----------------------------------------');
          console.error(startupError.trim());
          console.error('----------------------------------------');
          console.error('請根據上方提示修正後再試。');
          process.exit(1);
        }

        child.unref();
        fs.writeFileSync(pidFile, String(child.pid));
        console.log(`✅ Service started in background (PID: ${child.pid})`);
      } else {
        // --- FOREGROUND MODE ---
        console.log('Starting service in foreground... (Ctrl+C to stop)');
        const child = spawn('node', [scriptPath, '--workdir', workdir], {
          stdio: 'inherit'
        });
        child.on('exit', (code) => process.exit(code));
      }
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
          process.kill(pid, 0);
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
      
      const { spawn } = require('child_process');
      const args = options.follow ? ['-f', ...filesToTail] : filesToTail;
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
      
      if (fs.existsSync(serviceLog)) fs.truncateSync(serviceLog, 0);
      if (fs.existsSync(gmailLog)) fs.truncateSync(gmailLog, 0);
      console.log('Logs cleared.');
    });
};
