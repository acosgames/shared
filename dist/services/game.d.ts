import { GeneralError } from "../util/errorhandler.js";
import { Game, GameReplay, GameTeam, PlayerGameRank } from "../types/game.js";
declare class GameService {
    constructor(credentials?: any);
    reportGame(game_slug: string, shortid: string, report: number | null): Promise<any>;
    rateGame(game_slug: string, shortid: string, vote: boolean, previousVote: boolean | null): Promise<number>;
    ratingToRank(rating: number): string;
    getGameSiteMap(): Promise<{
        game_slug: string;
    }[]>;
    findGames(): Promise<Game[]>;
    findGameReplays(game_slug: string): Promise<GameReplay[]>;
    findGame(game_slug: string, ignoreExtra?: boolean): Promise<Game | null>;
    findGameVotes(game_slug: string): Promise<number>;
    findGameTeams(game_slug: string): Promise<GameTeam[]>;
    updateVotes(game_slug: string, votes: number): Promise<void>;
    getAllGamesQueueCount(): Promise<Record<string, number>>;
    getGameQueueCount(game_slug: string): Promise<number>;
    findGamePerson(game_slug: string, shortid: string, displayname: string): Promise<{
        game: Game;
        player: PlayerGameRank;
    } | GeneralError>;
}
declare const _default: GameService;
export default _default;
//# sourceMappingURL=game.d.ts.map