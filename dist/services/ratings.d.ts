declare class RatingService {
    constructor(credentials?: any);
    createPersonRank(player: any, game_slug: string): Promise<PlayerGameRating>;
    findGroupRatings(shortids: string[], game_slugs: string[]): Promise<{
        playerRatings: Record<string, Record<string, PlayerGameRating>>;
        invalidPlayers: string[];
    }>;
    findPlayerRating(shortid: string, meta: any, game_slug: string): Promise<PlayerGameRating>;
    updateLeaderboard(game_slug: string, players: Record<string, PlayerGameRating>): number | null;
    updateLeaderboardHighscore(game_slug: string, players: Record<string, PlayerGameRating>): number | null;
    updateAllPlayerHighscores(ratings: PlayerGameRating[], isSinglePlayer: boolean): boolean;
    updateAllPlayerRatings(ratings: PlayerGameRating[]): boolean;
    updatePlayerDivision(shortid: string, game_slug: string, season: number, divison_id: number): boolean;
    updatePlayerRating(shortid: string, game_slug: string, ratingData: PlayerGameRating): Promise<boolean>;
    setPlayerRating(shortid: string, game_slug: string, rating: number): void;
    setPlayerHighScore(shortid: string, game_slug: string, highscore: number): void;
    findPlayerRatings(playerShortids: string[], meta: any, game_slug: string): Promise<PlayerGameRating[]>;
    findAvailableDivision(db: any, game_slug: string): Promise<{
        division_id: number;
        season: number;
    }>;
    createDivision(db: any, game_slug: string): Promise<{
        division_id: number;
        season: number;
    }>;
    findUniqueDivisionName(db: any, game_slug: string, season: number): Promise<string>;
}
declare const _default: RatingService;
export default _default;
//# sourceMappingURL=ratings.d.ts.map