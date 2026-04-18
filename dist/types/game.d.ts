export type ScreenType = 1 | 2 | 3;
export interface StatDefinition {
    stat_slug: string;
    algorithm_id: string | null;
    game_slug: string;
    stat_name: string;
    stat_abbreviation: string;
    stat_desc: string;
    icon?: string;
    valueTYPE: number;
    isactive: number;
    scoreboard?: number;
    stat_order?: number;
    tsinsert?: string;
    tsupdate?: string;
}
export interface Game {
    gameid: string;
    game_slug: string;
    version: string;
    displayname: string;
    longdesc: string;
    shortdesc: string;
    latest_version: string;
    db: boolean;
    css: boolean;
    screentype: ScreenType;
    resow: number;
    resoh: number;
    screenwidth: number;
    latest_screentype: ScreenType;
    latest_resow: number;
    latest_resoh: number;
    latest_screenwidth: number;
    latest_db: boolean;
    latest_css: boolean;
    name: string;
    preview_images: string;
    lbscore: number;
    status: string;
    maxplayers: number;
    queueCount?: number;
    stats?: GameStat[];
    achievements?: GameAchievement[];
    tsinsert: Date;
    tsupdate: Date;
}
export interface GameVersion {
    gameid: string;
    version: string;
    status: number;
    screentype: ScreenType;
    resow: number;
    resoh: number;
    screenwidth: number;
    db: number;
    css: number;
}
export interface GameReplay {
    version: string;
    mode: string;
    room_slug: string;
    screentype: ScreenType;
    resow: number;
    resoh: number;
    screenwidth: number;
    css: boolean;
}
export interface GameTeam {
    game_slug: string;
    team_slug: string;
    team_order: number;
    team_name: string;
    minplayers: number;
    maxplayers: number;
    color: string;
    icon: string;
    tsupdate: Date;
    tsinsert: Date;
}
export interface PlayerGameRank {
    shortid: string;
    game_slug: string;
    season: string;
    rating: number;
    win: number;
    loss: number;
    tie: number;
    played: number;
    highscore: number;
    tsinsert: string;
    name?: string;
    preview_images?: string;
    division_id?: string;
    division_season?: string;
    division_name?: string;
    division_playercount?: number;
    vote?: number;
    report?: number;
}
export interface DeveloperGameSimple {
    game_slug: string;
    name: string;
    opensource: boolean;
    preview_images: string;
    tsinsert: string;
}
//# sourceMappingURL=game.d.ts.map