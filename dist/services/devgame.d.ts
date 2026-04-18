import { GeneralError } from "../util/errorhandler.js";
export default class DevGameService {
    constructor(credentials?: any);
    findGamesByStatus(userid: any): Promise<{}>;
    findGames(userid: any): Promise<any>;
    findGameTemplates(): Promise<any>;
    findDevByGame(gameid: any, shortid: any): Promise<any>;
    findDevByAPIKey(apikey: any): Promise<any>;
    findGame(game: any, user?: any, db?: any): Promise<any | GeneralError>;
    findGameAchievements(game_slug: any, stats: any): Promise<any>;
    findGameStats(game_slug: any): Promise<any>;
    findGameTeams(game_slug: any): Promise<any>;
    updateGameTeams(game_slug: any, teams: any): Promise<any>;
    statusId(name: any): any;
    statusName(id: any): string;
    createGameVersion(db: any, game: any, hasDB: any, hasCSS: any, screentype: any, resow: any, resoh: any, screenwidth: any): Promise<GameVersion>;
    updatePreviewImages(gameid: any, game_slug: any, user: any, images: any): Promise<{}>;
    updateStats(db: any, gameFull: any, apiKey: any, gameSettings: any): Promise<boolean>;
    updateAchievement(game: any, achievement: any, user: any, db: any): Promise<any>;
    updateGame(game: any, user: any, db: any): Promise<any>;
    updateGameAPIKey(game: any, user: any, db: any): Promise<any>;
    deployGame(game: any, user: any, db: any): Promise<{
        version: any;
        status: number;
    }>;
    deleteGame(game: any, user: any): Promise<{
        status: string;
    } | GeneralError>;
    archiveGame(game: any, user: any): Promise<any>;
    createGame(game: any, user: any, db: any): Promise<any>;
    createGameBuilds(game: any, user: any, db: any): Promise<void>;
    pushGitGameTemplates(repoName: any, templateName: any, type: any): Promise<void>;
    inviteToGithub(user: any): Promise<boolean>;
    assignUserToRepo(game: any, user: any, db: any): Promise<import("@octokit/types").OctokitResponse<{
        id: number;
        repository: import("@octokit/openapi-types").components["schemas"]["minimal-repository"];
        invitee: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        inviter: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        permissions: "read" | "write" | "admin" | "triage" | "maintain";
        created_at: string;
        expired?: boolean;
        url: string;
        html_url: string;
        node_id: string;
    }, 201>>;
    createGitHubRepos(game: any, user: any, db: any): Promise<void>;
    deleteGithubRepo(game: any): Promise<void>;
}
//# sourceMappingURL=devgame.d.ts.map