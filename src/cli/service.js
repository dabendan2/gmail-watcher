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
        } catch (err) {
          fs.unlinkSync(pidFile);
        }
      }

      const scriptPath = path.resolve(__dirname, '../../src/daemon.js');
      
      if (options.daemon) {
        // --- DAEMON MODE ---
        const logFd = fs.openSync(logFile, 'a');
        const child = spawn('node', [scriptPath, '--workdir', workdir], {
          detached: true,
          stdio: ['ignore', logFd, logFd]
        });
        
        // Watch log file for startup status
        console.log('Starting background service...');
        
        const checkPromise = new Promise((resolve, reject) => {
            let logs = '';
            // Tail the log file to check for success/failure
            const tail = spawn('tail', ['-n', '0', '-f', logFile]);
            
            const timeout = setTimeout(() => {
                tail.kill();
                // Assume success if no crash in 3s
                resolve(); 
            }, 3000);

            tail.stdout.on('data', (data) => {
                const chunk = data.toString();
                logs += chunk;
                if (chunk.includes('Listening for messages') || chunk.includes('Watcher started')) {
                    clearTimeout(timeout);
                    tail.kill();
                    resolve();
                }
                // Check for known error patterns
                if (chunk.includes('CRITICAL') || chunk.includes('Start failed') || chunk.includes('Error:')) {
                    clearTimeout(timeout);
                    tail.kill();
                    reject(new Error(`Daemon reported error: ${chunk}`));
                }
            });

            // Also check if child dies immediately
            child.on('exit', (code) => {
                if (code !== 0) {
                    clearTimeout(timeout);
                    tail.kill();
                    // Read recent logs to give context
                    try {
                        const recentLogs = fs.readFileSync(logFile, 'utf8').slice(-500);
                        reject(new Error(`Process exited with code ${code}. Logs:\n${recentLogs}`));
                    } catch(e) {
                        reject(new Error(`Process exited with code ${code}`));
                    }
                }
            });
        });

        try {
            await checkPromise;
            child.unref();
            fs.writeFileSync(pidFile, String(child.pid));
            console.log(`✅ Service started in background (PID: ${child.pid})`);
            process.exit(0);
        } catch (err) {
            console.error('\n❌ 啟動失敗！');
            console.error(err.message);
            // Kill child if it's still alive (e.g. hung but reported error)
            try { process.kill(child.pid, 'SIGKILL'); } catch (e) {}
            process.exit(1);
        }
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
        } catch (err) {
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
        } catch (err) {
          console.log(`Failed to stop service (PID: ${pid})`);
        }
      } else {
        console.log('Service is not running');
      }
    });

  service.command('logs')
    .description('Tail logs (service.log + gmail.log)')
    .option('-f, --follow', 'Follow log output')
    .option('-n, --lines <number>', 'Output the last N lines')
    .action((options, command) => {
      const workdir = command.context && command.context.workdir 
        ? command.context.workdir 
        : (command.parent.parent.opts().workdir || require('os').homedir() + '/.gmail-watcher');

      const serviceLog = path.join(workdir, 'service.log');
      // const gmailLog = path.join(workdir, 'gmail.log'); // Removed
      
      const filesToTail = [];
      if (fs.existsSync(serviceLog)) filesToTail.push(serviceLog);
      // if (fs.existsSync(gmailLog)) filesToTail.push(gmailLog); // Removed

      if (filesToTail.length === 0) {
        console.log('No logs found.');
        return;
      }
      
      const { spawn } = require('child_process');
      const args = [];
      if (options.lines) args.push('-n', options.lines);
      if (options.follow) args.push('-f');
      args.push(...filesToTail);
      
      spawn('tail', args, { stdio: 'inherit' });
    });

  service.command('clean-logs')
    .description('Clear logs (service.log + gmail.log)')
    .action((options, command) => {
      const workdir = command.context && command.context.workdir 
        ? command.context.workdir 
        : (command.parent.parent.opts().workdir || require('os').homedir() + '/.gmail-watcher');

      const serviceLog = path.join(workdir, 'service.log');
      // const gmailLog = path.join(workdir, 'gmail.log');
      
      if (fs.existsSync(serviceLog)) fs.truncateSync(serviceLog, 0);
      // if (fs.existsSync(gmailLog)) fs.truncateSync(gmailLog, 0);
      console.log('Logs cleared.');
    });
};
