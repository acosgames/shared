declare class StatService {
    constructor(credentials?: any);
    updatePlayerStats(meta: any, gamestate: any): Promise<boolean>;
    getGameStats(game_slug: any, is_solo: any): Promise<StatDefinition[]>;
}
declare const _default: StatService;
export default _default;
//# sourceMappingURL=stats.d.ts.map