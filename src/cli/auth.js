const fs = require('fs');
const path = require('path');
const readline = require('readline');
const AuthHelper = require('../core/AuthHelper');

module.exports = (program) => {
  const auth = program.command('auth')
    .description('Manage authentication');

  const getWorkdir = (command) => {
    return command.context && command.context.workdir 
      ? command.context.workdir 
      : (command.parent.parent.opts().workdir || require('os').homedir() + '/.gmail-watcher');
  };

  auth.command('login')
    .description('Authenticate with Google')
    .requiredOption('--creds <path>', 'Path to credentials.json')
    .action(async (options, command) => {
      const workdir = getWorkdir(command);
      const helper = new AuthHelper(workdir);
      const credsPath = path.resolve(options.creds);

      if (!fs.existsSync(credsPath)) {
        console.error(`Error: Credentials file not found at ${credsPath}`);
        process.exit(1);
      }

      fs.copyFileSync(credsPath, helper.credentialsPath);
      console.log(`Credentials copied to ${helper.credentialsPath}`);

      const { client } = await helper.getClient();
      const authUrl = helper.getAuthUrl(client);

      console.log('Authorize this app by visiting this url:', authUrl);
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('Enter the code from that page here: ', async (code) => {
        rl.close();
        try {
          await helper.saveToken(client, code);
          console.log('Token stored to', helper.tokenPath);
        } catch (err) {
          console.error('Error retrieving access token', err);
          process.exit(1);
        }
      });
    });

  auth.command('status')
    .description('Check authentication status')
    .action(async (options, command) => {
      const workdir = getWorkdir(command);
      const helper = new AuthHelper(workdir);
      
      try {
        const { authenticated } = await helper.getClient();
        if (authenticated) {
          console.log('Authenticated (token.json exists and is valid)');
        } else {
          console.error('Not authenticated (token.json missing)');
          process.exit(1);
        }
      } catch (e) {
        console.error(`Error: ${e.message}`);
        process.exit(1);
      }
    });

  auth.command('revoke')
    .description('Revoke authentication')
    .action((options, command) => {
      const workdir = getWorkdir(command);
      const helper = new AuthHelper(workdir);
      
      if (fs.existsSync(helper.tokenPath)) {
        fs.unlinkSync(helper.tokenPath);
        console.log('Authentication revoked (token.json removed)');
      } else {
        console.log('Nothing to revoke');
      }
    });
};
