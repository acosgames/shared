
const { Octokit } = require("@octokit/rest");
const credutil = require('../util/credentials');
const credentials = credutil();

const octokit = new Octokit({
    auth: credentials.githubauth.personalAccessToken
});

module.exports = octokit
