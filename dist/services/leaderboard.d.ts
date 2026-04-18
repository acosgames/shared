/**
 * Lets build a leaderboard
 * Types of leaderboards: Division, Global Rank, National Rank, Global Score, National Score, and Stats
 * Modifiers for Division: none
 * Modifiers for National Rank: Season
 * Modifiers for Global Rank: Season
 * Modifiers for High Score: Monthly, All Time
 * Modifiers for Individual Stat: Monthly, All Time
 * Modifiers for Global Stat: Monthly, All Time
 *
 * Leaderboards on Redis:
 * - Global Rank -- Season
 * - National Rank -- Season
 * - High Score -- Monthly, All Time
 */
declare class LeaderboardService {
    constructor(credentials?: any);
    createRedisKey(config: any): any;
    verifyRedisLeaderboard(config: any): Promise<boolean>;
    fullRedisLeaderboardUpdate(config: any): Promise<number>;
    getLeaderboard(config: any): Promise<{
        leaderboard: any[];
        localboard: any[];
        total: number;
    }>;
    getDivisionSoloLeaderboard(config: any): Promise<{
        leaderboard: any;
        localboard: any[];
        total: any;
    }>;
    getDivisionLeaderboard(config: any): Promise<{
        leaderboard: any;
        localboard: any[];
        total: any;
    }>;
    getRankLeaderboard(config: any): any;
    getRedisPlayerRelativeLeaderboard(config: any, player: any): Promise<any>;
    getRedisLeaderboardCount(config: any): Promise<any>;
    formatDateForMySQL(date: any): string;
    getMySQLMonthRange(): {
        startDate: string;
        endDate: string;
    };
    getHighscoreLeaderboard(config: any): any;
    getStatLeaderboard(config: any): Promise<any[] | {
        leaderboard: any[];
        localboard: any[];
        total: number;
    }>;
    updateLeaderboard(config: any, players: any): Promise<any>;
    getAllRanks(config: any, onResults: any): Promise<number>;
    getAllHighScores(config: any): Promise<number>;
    getGameLeaderboardCount(game_slug: any, config: any): Promise<any>;
    getPlayerGameRank(game_slug: any, player: any, config: any): Promise<any>;
    getPlayerGameLeaderboard(config: any): any;
    rankLeaderboard(game_slug: any, shortid: any, displayname: any, config: any): Promise<{}>;
    findGameRankNational(game_slug: any, shortid: any, displayname: any, countrycode: any): Promise<{}>;
    findGameRankGlobal(game_slug: any, shortid: any, displayname: any): Promise<{}>;
    findGameRankDivision(game_slug: any, division_id: any): Promise<{}>;
    updateAllHighscores(game_slug: any): Promise<number>;
    getGameLeaderboardCountHighscore(game_slug: any): Promise<any>;
    getPlayerGameHighscore(game_slug: any, player: any): Promise<any>;
    getPlayerGameLeaderboardHighscore(game_slug: any, player: any, rank: any): Promise<any>;
    findGameLeaderboardHighscore(game_slug: any, shortid: any, displayname: any): Promise<{}>;
}
declare const _default: LeaderboardService;
export default _default;
//# sourceMappingURL=leaderboard.d.ts.map