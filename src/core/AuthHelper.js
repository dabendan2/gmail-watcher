const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/pubsub'
];

/**
 * Common OAuth2 authentication helper
 */
class AuthHelper {
  constructor(workdir) {
    this.workdir = workdir;
    this.credentialsPath = path.join(workdir, 'credentials.json');
    this.tokenPath = path.join(workdir, 'token.json');
  }

  async getClient() {
    if (!fs.existsSync(this.credentialsPath)) {
      throw new Error(`Credentials missing at ${this.credentialsPath}`);
    }

    const content = fs.readFileSync(this.credentialsPath);
    const credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (!fs.existsSync(this.tokenPath)) {
      return { client: oAuth2Client, authenticated: false };
    }

    const token = fs.readFileSync(this.tokenPath);
    oAuth2Client.setCredentials(JSON.parse(token));
    return { client: oAuth2Client, authenticated: true };
  }

  getAuthUrl(client) {
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
  }

  async saveToken(client, code) {
    return new Promise((resolve, reject) => {
      client.getToken(code, (err, token) => {
        if (err) return reject(err);
        client.setCredentials(token);
        fs.writeFileSync(this.tokenPath, JSON.stringify(token));
        resolve(token);
      });
    });
  }
}

module.exports = AuthHelper;
