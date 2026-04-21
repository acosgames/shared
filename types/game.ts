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

export interface GameInfo {
    gameid: string;
    game_slug: string;
    name: string;
    version: string;
    db: boolean;
    season: string;
    visible: boolean;
    latest_version: string;
    ownerid: string;
    minplayers: number;
    maxplayers: number;
    lbscore: number;
    maxteams: number;
    minteams: number;
    shortdesc: string;
    longdesc: string;
    opensource: boolean;
    template: string;
    preview_images: string;
    videourl: string;
    genre: string;
    votes: number;
    status: string;
    tsupdate: string;
    tsinsert: string;
    teamlist?: GameTeam[];
    expires?: number;
    gameSettings?: GameSettings;
}

export interface GameSettingsTeam {
    team_name: string;
    team_slug: string;
    minplayers: number;
    maxplayers: number;
    team_order: number;
    color: string;
}

export interface GameSettingsStat {
    stat_name: string;
    stat_desc: string;
    stat_abbreviation: string;
    valueTYPE: number;
    scoreboard: boolean;
    stat_order: number;
}

export interface GameSettingsItem {

    item_name: string;
    item_desc: string;
    item_slug: string;
    max_uses: number;
    expire_days: number;
    item_order: number;
    item_category: string;

}
export interface GameSettings {
    minplayers: number;
    maxplayers: number;
    minteams: number;
    maxteams: number;
    teams: GameSettingsTeam[],
    screentype: ScreenType,
    resow: number,
    resoh: number,
    screenwidth: number,
    stats: {
        [stat_slug: string]: GameSettingsStat
    },
    items: GameSettingsItem[],
    lastupdate?: Date | string;
}

export interface GameVersion {
    gameid: string;
    version: string;
    db: boolean;
    css: boolean;
    scaled: boolean;
    screentype: ScreenType;
    resow: number;
    resoh: number;
    screenwidth: number;
    status: string;
    tsupdate: string;
    tsinsert: string;
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