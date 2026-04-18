

export interface GameRoom {
    room_slug: string;
    game_slug: string; 
    season: string; 
    version: string; 
    mode: string; 
    rating: number; 
    owner: string; 
    status: string; 
    private_key: string; 
    tsupdate: string; 
    tsinsert: string;
}

export interface PlayerGameRoom extends GameRoom {
    shortid: string;
    room_slug: string;
    game_slug: string;
    version: string;
    mode: string;
    status: string;
    css: string;
    scaled: boolean;
    screentype: string;
    resow: number;
    resoh: number;
    screenwidth: number;
    minplayers: number;
    maxplayers: number;
    maxteams: number;
    minteams: number;
    lbscore: number;
}

export interface PlayerGameRoomExtended extends PlayerGameRoom , GameRoomMeta, GameRoom{

}

export interface GameRoomMeta {
    db: number;
    game_slug: string;
    name: string;
    css: string;
    scaled: boolean;
    screentype: string;
    resow: number;
    resoh: number;
    screenwidth: number;
    minplayers: number;
    maxplayers: number;
    maxteams: number;
    minteams: number;
    lbscore: number;
}

export interface RoomMeta {
    room_slug: string;
    name: string;
    game_slug: string;
    season: number;
    version: number;
    owner: string;
    rating: number;
    mode: number;
    db: number;
    css: number;
    scaled: boolean;
    screentype: number;
    resow: number;
    resoh: number;
    screenwidth: number;
    minplayers: number;
    maxplayers: number;
    maxteams: number;
    minteams: number;
    lbscore: number;
}