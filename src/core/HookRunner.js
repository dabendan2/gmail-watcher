/**
 * @file HookRunner.js
 * @description Manages the execution of external hooks as child processes.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class HookRunner {
    /**
     * @param {string} hooksDir - Directory containing hook scripts.
     * @param {string} logDir - Directory for logs (passed as env var to hooks).
     * @param {Function} logger - Logging function (e.g., watcher.log).
     * @param {number} [timeoutMs=180000] - Timeout in ms (default 3 mins).
     */
    constructor(hooksDir, logDir, logger, timeoutMs = 3 * 60 * 1000) {
        this.hooksDir = hooksDir;
        this.logDir = logDir;
        this.logger = logger;
        this.timeoutMs = timeoutMs;
    }

    /**
     * Retrieves a list of executable hook files.
     * @returns {string[]} List of filenames.
     */
    getHooks() {
        if (!fs.existsSync(this.hooksDir)) return [];
        return fs.readdirSync(this.hooksDir).filter(file => {
            return fs.statSync(path.join(this.hooksDir, file)).isFile();
        });
    }

    /**
     * Executes all hooks sequentially with the provided message payload.
     * @param {Array<object>} messages - Array of Gmail message objects.
     */
    async run(messages) {
        if (!messages || messages.length === 0) return;

        const files = this.getHooks();
        if (files.length === 0) return;

        const payload = JSON.stringify(messages);

        for (const file of files) {
            const hookPath = path.join(this.hooksDir, file);
            this.logger('HookRunner', `Running hook: ${file}`);
            
            try {
                let cmd, args;
                if (hookPath.endsWith('.js')) {
                    cmd = 'node';
                    args = [hookPath];
                } else {
                    cmd = hookPath;
                    args = [];
                }

                await new Promise((resolve, reject) => {
                    const child = spawn(cmd, args, {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        env: { ...process.env, LOG_DIR: this.logDir }
                    });

                    child.stdout.on('data', (data) => {
                        const lines = data.toString().split('\n');
                        lines.forEach(line => {
                            if (line.trim()) this.logger(file, line.trim());
                        });
                    });

                    child.stderr.on('data', (data) => {
                        const lines = data.toString().split('\n');
                        lines.forEach(line => {
                            if (line.trim()) this.logger(file, `ERROR: ${line.trim()}`);
                        });
                    });

                    child.on('error', (err) => {
                        this.logger(file, `Spawn error: ${err.message}`);
                        reject(err);
                    });

                    child.on('close', (code) => {
                        this.logger(file, `Finished with code ${code}`);
                        resolve();
                    });

                    child.stdin.write(payload);
                    child.stdin.end();
                    
                    // Timeout logic
                    setTimeout(() => {
                        if (!child.killed && child.exitCode === null) {
                            this.logger(file, 'Timed out, sending SIGTERM...');
                            child.kill('SIGTERM');

                            // Force kill if it doesn't exit within 5 seconds
                            setTimeout(() => {
                                if (child.exitCode === null) {
                                    this.logger(file, 'Still alive, sending SIGKILL...');
                                    child.kill('SIGKILL');
                                }
                            }, 5000); // Don't block event loop
                        }
                    }, this.timeoutMs); 
                });

            } catch (error) {
                this.logger('HookRunner', `Hook ${file} failed: ${error.message}`);
            }
        }
    }
}

module.exports = HookRunner;
