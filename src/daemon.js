const fs = require('fs');
const path = require('path');
const GmailWatcher = require('./core/watcher');

// Parse arguments
const args = process.argv.slice(2);
const workdirIndex = args.indexOf('--workdir');
if (workdirIndex === -1 || !args[workdirIndex + 1]) {
  console.error('Missing --workdir argument');
  process.exit(1);
}
const workdir = args[workdirIndex + 1];

// Paths
const configPath = path.join(workdir, 'config.json');
const credsPath = path.join(workdir, 'credentials.json');
const tokenPath = path.join(workdir, 'token.json');
const logDir = workdir; // Use workdir for logs (service.log is handled by spawn, gmail.log by watcher)

// Load Config
if (!fs.existsSync(configPath)) {
  console.error('Config file missing');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Load Project ID from credentials
if (!fs.existsSync(credsPath)) {
  console.error('Credentials file missing');
  process.exit(1);
}
const credentials = JSON.parse(fs.readFileSync(credsPath));
const projectId = (credentials.installed || credentials.web).project_id;

// Initialize Watcher
const watcher = new GmailWatcher({
  gitSha: 'daemon', // Or read from package/git if needed
  projectId: projectId,
  subscriptionName: config.subscription,
  topicName: config.topic,
  port: config.port,
  logDir: logDir,
  tokenPath: tokenPath,
  credentialsPath: credsPath
});

watcher.start().catch(err => {
  console.error('Watcher failed to start:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log(`[PID:${process.pid}] SIGTERM signal received: closing HTTP server`);
  watcher.stop();
  process.exit(0);
});
