export type ScreenType = 1 | 2 | 3;

/**
 * StatDefinition represents the definition of a statistic for a game, including its slug, display name, description, and how it should be calculated and displayed. This is used to define the various stats that can be tracked for players in a game, such as score, rating, wins, losses, etc.
 * The fields include:
 * - stat_slug: A unique identifier for the stat, used in code and API calls.
 * - algorithm: The algorithm used to calculate the stat (e.g., sum, average, max).
 *      - 0 = latest value
 *      - 1 = sum
 *      - 2 = average
 *      - 3 = max
 *      - 4 = min
 * - global_algorithm: The algorithm used to calculate the global version of the stat, if applicable (e.g., for global leaderboards).
 *      - 0 = latest value
 *      - 1 = sum
 *      - 2 = average
 *      - 3 = max
 *      - 4 = min
 * - display_format: An optional field that specifies how the stat should be formatted when displayed (e.g., as a number, percentage, time).
 *      - 0 = number
 *      - 1 = percentage (0-100%)
 *      - 2 = time (displayed as mm:ss)
 *      - 3 = duration (displayed as hh:mm:ss)
 *      - 4 = date (displayed as YYYY-MM-DD)
 * - game_slug: The slug of the game this stat is associated with.
 * - stat_name: The human-readable name of the stat to be displayed in the UI.
 * - stat_abbreviation: A short abbreviation for the stat, used in compact displays.
 * - stat_desc: A description of the stat, explaining what it represents.
 * - valueTYPE: The type of value the stat holds (e.g., integer, float, time).  
 * - isactive: A boolean indicating whether the stat is currently active and should be tracked.
 * - scoreboard: An optional field indicating if the stat should be shown on the scoreboard.
 * - stat_order: An optional field that determines the order in which stats are displayed in the UI.
 * - tsinsert: Timestamp of when the stat definition was created.
 * - tsupdate: Timestamp of when the stat definition was last updated.
 */
export interface StatDefinition {
    stat_slug: string;
    algorithm: number | null;
    global_algorithm: number | null;
    display_format?: number | null;
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