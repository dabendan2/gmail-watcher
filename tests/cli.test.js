const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const cliPath = path.resolve(__dirname, '../bin/gmail-watcher.js');
const workdir = path.join(os.tmpdir(), 'gmail-watcher-test-' + Date.now());

// Helper to run CLI commands
function run(args) {
  try {
    return execSync(`node ${cliPath} --workdir ${workdir} ${args}`, { encoding: 'utf8' });
  } catch (e) {
    return e.stdout + e.stderr; // Return output even on error
  }
}

describe('Gmail Watcher CLI', () => {
  beforeAll(() => {
    if (!fs.existsSync(workdir)) {
      fs.mkdirSync(workdir, { recursive: true });
    }
  });

  afterAll(() => {
    fs.rmSync(workdir, { recursive: true, force: true });
  });

  test('version command', () => {
    const output = run('--version');
    expect(output).toMatch(/([a-f0-9]{7}|unknown)/);
  });

  describe('Config Command', () => {
    test('config list returns empty object initially', () => {
      const output = run('config list');
      expect(output.trim()).toBe('{}');
    });

    test('config set updates values', () => {
      run('config set port 3000');
      run('config set topic my-topic');
      
      const listOutput = run('config list');
      const config = JSON.parse(listOutput);
      
      expect(config.port).toBe('3000');
      expect(config.topic).toBe('my-topic');
    });
  });

  describe('Auth Command', () => {
    const credsPath = path.join(workdir, 'test-creds.json');
    const tokenPath = path.join(workdir, 'token.json');

    beforeAll(() => {
      fs.writeFileSync(credsPath, JSON.stringify({ installed: { client_id: 'foo', client_secret: 'bar' } }));
    });

    test('auth status fails without token', () => {
      const output = run('auth status');
      expect(output).toContain('Not authenticated');
    });

    // Note: login is interactive, so we can't easily test the full flow via execSync without complex mocking.
    // Instead, we can simulate a successful login by manually creating the token file.

    test('auth status succeeds with token', () => {
      fs.writeFileSync(tokenPath, JSON.stringify({ access_token: 'fake' }));
      const output = run('auth status');
      expect(output).toContain('Authenticated');
    });

    test('auth revoke removes token', () => {
      run('auth revoke');
      expect(fs.existsSync(tokenPath)).toBe(false);
      const output = run('auth status');
      expect(output).toContain('Not authenticated');
    });
  });

  describe('Service Command', () => {
    // We need config, creds, and token for service start checks
    beforeAll(() => {
      run('config set port 4000');
      run('config set topic t');
      run('config set subscription s');
      
      fs.writeFileSync(path.join(workdir, 'credentials.json'), '{}');
      fs.writeFileSync(path.join(workdir, 'token.json'), '{}');
    });

    test('service status when not running', () => {
      const output = run('service status');
      expect(output).toContain('Service is stopped');
    });

    // Start is hard to test fully because it spawns a detached process.
    // But we can test the pre-flight checks by removing a requirement.

    test('service start fails if token missing', () => {
      fs.unlinkSync(path.join(workdir, 'token.json'));
      const output = run('service start');
      expect(output).toContain('Error: token.json not found');
      
      // Restore token
      fs.writeFileSync(path.join(workdir, 'token.json'), '{}');
    });

    test('service start fails if config missing', () => {
      fs.unlinkSync(path.join(workdir, 'config.json'));
      const output = run('service start');
      expect(output).toContain('Error: config.json is invalid');
      
      // Restore config (empty is invalid for required keys)
      fs.writeFileSync(path.join(workdir, 'config.json'), JSON.stringify({ port: '4000', topic: 't', subscription: 's' }));
    });
  });
});
