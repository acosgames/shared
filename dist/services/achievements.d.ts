declare class AchievementService {
    constructor(credentials?: any);
    getAchievementDefinitions(game_slug: any, stats: any): Promise<any>;
    getAchievementProgress(game_slug: any, shortid: any, stats: any): Promise<any>;
    claimAchievement(game_slug: any, shortid: any, achievement_slug: any): Promise<boolean | {
        type: string;
        experience: any[];
        previousPoints: number;
        previousLevel: number;
        points: any;
        level: number;
        newLevel: number;
    }>;
    updatePlayerAchievements(meta: any, gamestate: any): Promise<{}>;
    resetAchievementStat(index: any, playerAchievement: any): void;
    updateAchievementStat(index: any, achievement: any, statMap: any, playerAchievement: any, playerStats: any): boolean;
    calculateAchievementProgress(achievement: any, progress: any): {
        value: number;
        maxValue: number;
        percent: number;
    };
    calculateStatProgress(stat_slug: any, goal_valueTYPE: any, goal_valueINT: any, goal_valueFLOAT: any, stat_valueINT: any, stat_valueFLOAT: any, times_in_a_row: any, played: any): false | {
        value: any;
        maxValue: any;
        percent: number;
    };
}
declare const _default: AchievementService;
export default _default;
//# sourceMappingURL=achievements.d.ts.map