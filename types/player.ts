

export interface TokenUser {
    shortid: string;
    displayname: string;
    email: string;
    github: string;
    isdev: boolean;
}

export interface PlayerSearchRequest {
    id?: string;
    shortid?: string;
    displayname?: string;
    email?: string;
    github?: string;
    apikey?: string;
    github_id?: number;
}

export interface PlayerSimple {
    displayname: string;
    countrycode?: string;
    portraitid?: number;
    github?: string;
    membersince?: string;
    level?: number;
    points?: number;
    isdev?: boolean;
}

export interface PlayerFull {
    id: string;
    shortid: string;
    displayname: string;
    email?:string;
    apikey?:string;
    prevapikey?:string;
    isdev?: boolean;
    github?: string;
    github_id?: number;
    github_teamid?: number;
    logintoken?: string;
    password?: string;
    webpush?: string;
    portraitid?: number;
    countrycode?: string;
    points?: number;
    level?: number;
    tsinsert?: string;
    tsupdate?: string;
    tsapikey?: string;
    membersince?: string;
    iat?: number;
    exp?: number;
}

export interface Friend {
    shortid: string;
    displayname: string;
    portraitid?: number;
    countrycode?: string;
}