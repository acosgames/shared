const DevGameService = require('../services/devgame');
const devgame = new DevGameService();

async function run() {
    console.profile('test push speed');
    let repoName = 'texas-holdem2';
    let templateName = 'tictactoe';
    await devgame.pushGitGameTemplates(repoName, templateName, 'client');

    console.profileEnd('test push speed');
}

run();