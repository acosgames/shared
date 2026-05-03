import { StatDefinition } from "../types/game.js";
declare class StatService {
    constructor(credentials?: any);
    updatePlayerStats(meta: any, gamestate: any): Promise<boolean>;
    getPlayerGlobalStats({ shortid, game_slug }: {
        shortid: string;
        game_slug: string;
    }): Promise<any>;
    getUserStatHistory({ shortid, game_slug, stat_slug, days }: {
        shortid: any;
        game_slug: any;
        stat_slug: any;
        days?: number;
    }): Promise<any>;
    getGameStats(game_slug: any, is_solo: any): Promise<StatDefinition[]>;
}
declare const _default: StatService;
export default _default;
//# sourceMappingURL=stats.d.ts.map