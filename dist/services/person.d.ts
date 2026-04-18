import { PlayerFull, PlayerSearchRequest, PlayerSimple, Friend } from "../types/player.js";
import { PlayerRank } from "../types/rating.js";
declare class PersonService {
    constructor(credentials?: any);
    encodeUserToken(user: TokenUser, privateKey?: string): Promise<string>;
    decodeUserToken(token: string, publicKey?: string): Promise<TokenUser>;
    findPlayer(displayname: string): Promise<PlayerSimple>;
    findPlayerRanks(shortid: string): Promise<PlayerRank[]>;
    findPlayerDevGames(shortid: string): Promise<DeveloperGameSimple[]>;
    friendRequest(personid: string, friendid: string, db?: any): Promise<{
        results: any;
        results2: any;
    }>;
    deleteFriend(personid: string, friendid: string, db?: any): Promise<{
        results: any;
        results2: any;
    }>;
    friendResponse(personid: string, friendid: string, statusid: number, db?: any): Promise<{
        results: any;
        results2: any;
    }>;
    getFriends(shortid: string): Promise<Friend[]>;
    findUser(user: PlayerSearchRequest, isSimple: boolean): Promise<PlayerFull>;
    findOrCreateUser(user: PlayerSearchRequest): Promise<PlayerFull>;
    createDisplayName(user: PlayerFull, db?: any): Promise<PlayerFull>;
    deleteUser(user: PlayerSearchRequest, db?: any): Promise<boolean>;
    updateUser(user: Partial<PlayerFull>, db?: any): Promise<PlayerFull>;
    createUser(user: Partial<PlayerFull>, db?: any): Promise<PlayerFull>;
    inviteToGithub(user: PlayerSearchRequest): Promise<void>;
    createGithubUserTeam(user: PlayerSearchRequest): Promise<import("@octokit/types").OctokitResponse<{
        id: number;
        node_id: string;
        url: string;
        html_url: string;
        name: string;
        slug: string;
        description: string | null;
        privacy?: "closed" | "secret";
        notification_setting?: "notifications_enabled" | "notifications_disabled";
        permission: string;
        members_url: string;
        repositories_url: string;
        parent?: import("@octokit/openapi-types").components["schemas"]["nullable-team-simple"];
        members_count: number;
        repos_count: number;
        created_at: string;
        updated_at: string;
        organization: import("@octokit/openapi-types").components["schemas"]["team-organization"];
        ldap_dn?: string;
    }, 201>>;
}
declare const _default: PersonService;
export default _default;
//# sourceMappingURL=person.d.ts.map