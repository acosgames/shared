import { PlayerGameRoom, PlayerGameRoomExtended, RoomMeta } from "../types/room.js";
declare class RoomService {
    constructor(credentials?: any);
    getGameModeID(name: any): any;
    getGameModeName(id: any): string;
    notifyPlayerRoom(room_slug: any, gameinfo: any): Promise<void>;
    assignPlayersToRoom(shortids: string[], room_slug: string, game_slug: string): Promise<boolean>;
    assignPlayerRoom(shortid: string, room_slug: string, game_slug: string): Promise<any>;
    removePlayerRoom(shortid: string, room_slug: string): Promise<any>;
    updateRoomPlayerCount(room_slug: string, player_count: number): Promise<void>;
    findPlayerRoom(shortid: string, game_slug: string): Promise<PlayerGameRoom[]>;
    addError(game_slug: string, version: string, error: {
        type: string;
        title: string;
        body: string;
    }): Promise<any>;
    findPlayerRooms(shortid: string): Promise<PlayerGameRoomExtended[]>;
    findRoom(room_slug: any): Promise<RoomMeta>;
    findRooms(game_slug: any): Promise<any>;
    checkRoomFull(room: any): Promise<boolean>;
    findAnyRoom(user: any, game_slug: any, mode: any, rooms: any, attempt: any): Promise<any>;
    getModes(): Promise<any>;
    getGameInfo(game_slug: any): Promise<unknown>;
    findRoomUserSubscriptions(room_slug: any): Promise<any>;
    createRoom(shortid: any, rating: any, game_slug: any, mode: any, private_key: any): Promise<any[] | {
        room_slug: string;
        game_slug: any;
        season: any;
        gameid: string;
        version: string;
        css: boolean;
        db: boolean;
        latest_tsupdate: Date;
        minplayers: any;
        maxplayers: number;
        maxteams: any;
        minteams: any;
        mode: any;
        rating: any;
        lbscore: number;
        owner: any;
        status: number;
        preview_images: string;
        private_key: any;
        screentype: import("../types/game.js").ScreenType;
        resow: number;
        resoh: number;
        screenwidth: number;
    }>;
    getGameRoom(room_slug: any): Promise<any>;
    updatePlayerRoom(room_slug: any, gamestate: any, ratings: any): Promise<boolean>;
    deleteRoom(meta: any, roomState: any): Promise<boolean>;
}
declare const _default: RoomService;
export default _default;
//# sourceMappingURL=room.d.ts.map