export interface GameQueue {
    game_slug:string;
    mode:string;
    rating?:number;
    game?: GameInfo;
    name?: string;
    preview_images?: string;
    waitingPlayers?: number;
    imageUrl?: string;
}

export interface PlayerQueue {
    shortid: string;
    displayname?: string;
}

export interface PartyQueue {
    captain: string;
    partyid: string;
    players: PlayerQueue[];
    queues: GameQueue[];
    owner: string;
    threshold: number;
    createDate: string | Date;
    // rating?: number;
}

export interface QueueStats {
    waitingPlayers: number;
    name: string;
    preview_images: string;
}