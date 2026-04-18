export interface GameQueue {
    game_slug:string;
    mode:string;
    rating?:number;
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
}