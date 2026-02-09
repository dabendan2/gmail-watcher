const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const TOKEN_PATH = path.join(__dirname, '../token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const code = '4/0ASc3gC1yhIANQHEPWvHcyFL-Db-Re22k2E83-7F64uWJYsERQZfeh4ZbFyeF1wZvBfc_7w';

async function saveToken() {
    const content = fs.readFileSync(CREDENTIALS_PATH);
    const credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    const { tokens } = await oAuth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('Token updated with new scopes and stored to', TOKEN_PATH);
}

saveToken().catch(console.error);
