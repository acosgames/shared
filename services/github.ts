
import { Octokit } from "@octokit/rest";
import credutil from "../util/credentials.js";

const credentials = credutil();

const octokit = new Octokit({
    auth: credentials.githubauth.personalAccessToken
});

export default octokit;
