const fs = require('fs');
const path = require('path');
const GmailWatcher = require('./core/watcher');

// Parse arguments
const args = process.argv.slice(2);
const workdirIndex = args.indexOf('--workdir');
if (workdirIndex === -1 || !args[workdirIndex + 1]) {
  console.error('[System Error] Missing --workdir argument');
  process.exit(1);
}
const workdir = args[workdirIndex + 1];

// Paths
const configPath = path.join(workdir, 'config.json');
const credsPath = path.join(workdir, 'credentials.json');
const tokenPath = path.join(workdir, 'token.json');
const logDir = workdir;

// Load Config
if (!fs.existsSync(configPath)) {
  console.error(`[Config Error] Configuration file missing at ${configPath}. Run 'gmail-watcher config set <key> <value>' to initialize.`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error(`[Config Error] Failed to parse config.json: ${e.message}`);
  process.exit(1);
}

if (!config.subscription) {
  console.error("[Config Error] 'subscription' is missing in config. Run 'gmail-watcher config set subscription <name>' first.");
  process.exit(1);
}
if (!config.topic) {
  console.error("[Config Error] 'topic' is missing in config. Run 'gmail-watcher config set topic <name>' first.");
  process.exit(1);
}

// Load Project ID from credentials
if (!fs.existsSync(credsPath)) {
  console.error(`[Auth Error] Credentials missing at ${credsPath}. Run 'gmail-watcher auth login --creds <path>' first.`);
  process.exit(1);
}

let projectId;
try {
  const credentials = JSON.parse(fs.readFileSync(credsPath));
  const credsData = credentials.installed || credentials.web;
  projectId = credsData.project_id;
  if (!projectId) throw new Error('project_id not found in credentials');
} catch (e) {
  console.error(`[Auth Error] Invalid credentials.json: ${e.message}`);
  process.exit(1);
}

// Initialize Watcher
const watcher = new GmailWatcher({
  gitSha: 'daemon',
  projectId: projectId,
  subscriptionName: config.subscription,
  topicName: config.topic,
  port: config.port,
  logDir: logDir,
  tokenPath: tokenPath,
  credentialsPath: credsPath
});

watcher.start().catch(err => {
  console.error(`[Start Error] Watcher failed to initialize: ${err.message}`);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log(`[PID:${process.pid}] SIGTERM signal received: closing services`);
  watcher.stop();
  process.exit(0);
});
