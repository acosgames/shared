import DevGameService from '../services/devgame.js';
const devgame = new DevGameService();
async function run() {
    console.profile('test push speed');
    let repoName = 'texas-holdem2';
    let templateName = 'tictactoe';
    await devgame.pushGitGameTemplates(repoName, templateName, 'client');
    console.profileEnd('test push speed');
}
run();
//# sourceMappingURL=pushGitTemplate.js.map