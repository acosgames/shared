import MySQL from "./mysql.js";
const mysql = new MySQL();
import credutil from "../util/credentials.js";
import { GeneralError, CodeError } from "../util/errorhandler.js";
class StatService {
    constructor(credentials) {
        this.credentials = credentials || credutil();
    }
    async updatePlayerStats(meta, gamestate) {
        try {
            let db = await mysql.db();
            let room_slug = meta?.room_slug;
            let game_slug = meta?.game_slug;
            let players = gamestate?.players;
            let statDefinitions = await this.getGameStats(game_slug, meta.maxplayers == 1);
            //update ACOS tracked stats
            for (let player of gamestate.players) {
                let shortid = player.shortid;
                if (!player.shortid) {
                    console.error("Player missing shortid", player);
                    continue;
                }
                if (!player.stats)
                    player.stats = {};
                player.stats["ACOS_WINS"] = player.winloss == 1 ? 1 : 0;
                player.stats["ACOS_WINRATING"] = player.winloss == 1 ? 1 : 0;
                player.stats["ACOS_PLAYED"] = 1;
                player.stats["ACOS_PLAYTIME"] = Math.floor((gamestate.room.endtime) / 1000);
                player.stats["ACOS_SCORE"] = player.highscore ?? player.score ?? 0;
                player.stats["ACOS_RATING"] = player.rating ?? 0;
            }
            //mappings for faster indexing
            let defs = {};
            statDefinitions.map((def) => {
                defs[def.stat_slug] = def;
                defs[def.stat_abbreviation] = def;
            });
            //rows to batch insert
            let globalStatRows = [];
            let playerStatRows = [];
            //pull every player and their stats
            let shortids = players.map((p) => p.shortid);
            let playerStats = {};
            try {
                let statsResponse = await db.sql(`SELECT 
                    stat_slug,
                    game_slug,
                    shortid,
                    season,
                    valueINT,
                    valueFLOAT
                FROM person_stat_global
                WHERE game_slug = ?
                AND season = ?
                and shortid in (?)`, [game_slug, meta.season, shortids]);
                for (let i = 0; i < statsResponse.results.length; i++) {
                    let stat = statsResponse.results[i];
                    let shortid = stat.shortid;
                    if (!(shortid in playerStats))
                        playerStats[shortid] = [];
                    playerStats[shortid].push(stat);
                }
            }
            catch (e2) {
                console.error(e2);
            }
            //process each player individually
            for (let shortid of shortids) {
                let playerid = gamestate?.room?._players[shortid];
                let player = players[playerid];
                if (!player)
                    continue;
                let globalStatMap = {};
                //map the player global stats into a stat map
                playerStats[shortid]?.map((gs) => {
                    // if (defs[gs.stat_slug]?.valueTYPE == 4) {
                    //     globalStatMap[gs.stat_slug + "/" + gs.valueSTRING] = gs;
                    // } else {
                    globalStatMap[gs.stat_slug] = gs;
                    // }
                });
                //process each stat individually
                //update the global stat record and create a match stat record
                for (let stat_abbreviation in player.stats) {
                    if (!(stat_abbreviation in defs))
                        continue;
                    let def = defs[stat_abbreviation];
                    let stat = player.stats[stat_abbreviation];
                    let globalStat = globalStatMap[def.stat_slug] || null;
                    // --- Per-match stat row: store raw value with correct type, no algorithm ---
                    let matchRow = {
                        stat_slug: def.stat_slug,
                        game_slug,
                        room_slug,
                        shortid,
                        valueINT: null,
                        valueFLOAT: null,
                        valueSTRING: null,
                    };
                    switch (def.valueTYPE) {
                        case 0: // integer
                        case 3: // time
                            if (typeof stat !== "number" || isNaN(stat)) {
                                console.error("Stat is not a valid integer/time", game_slug, stat_abbreviation, stat);
                                continue;
                            }
                            matchRow.valueINT = Math.round(stat);
                            break;
                        case 1: // float
                        case 2: // average (float)
                            if (typeof stat !== "number" || isNaN(stat)) {
                                console.error("Stat is not a valid float/average", game_slug, stat_abbreviation, stat);
                                continue;
                            }
                            matchRow.valueFLOAT = stat;
                            break;
                        case 4: // string
                            matchRow.valueSTRING = String(stat);
                            break;
                        default:
                            continue;
                    }
                    playerStatRows.push(matchRow);
                    // --- Global stat aggregation ---
                    // def.algorithm  -> how to accumulate globalStat.value
                    // def.global_algorithm -> how to track globalStat.best
                    if (!globalStat) {
                        globalStat = {
                            stat_slug: def.stat_slug,
                            game_slug,
                            shortid,
                            season: meta.season,
                            valueINT: null,
                            valueFLOAT: null,
                            valueSTRING: null,
                            bestINT: null,
                            bestFLOAT: null,
                            bestSTRING: null,
                        };
                    }
                    if (def.valueTYPE === 0 || def.valueTYPE === 3) {
                        // integer / time
                        // value: use def.algorithm
                        // For avg, valueINT holds sample count and valueFLOAT holds the running average
                        switch (def.algorithm) {
                            case 1: // sum
                                globalStat.valueINT = (globalStat.valueINT || 0) + Math.round(stat);
                                break;
                            case 2: { // avg (count in valueINT, avg in valueFLOAT)
                                const n = (globalStat.valueINT || 0) + 1;
                                globalStat.valueFLOAT = (globalStat.valueFLOAT || 0) + stat;
                                globalStat.valueINT = n;
                                break;
                            }
                            case 3: // max
                                globalStat.valueINT = globalStat.valueINT == null ? Math.round(stat) : Math.max(globalStat.valueINT, Math.round(stat));
                                break;
                            case 4: // min
                                globalStat.valueINT = globalStat.valueINT == null ? Math.round(stat) : Math.min(globalStat.valueINT, Math.round(stat));
                                break;
                            default: // 0: latest
                                globalStat.valueINT = Math.round(stat);
                        }
                        // best: use def.global_algorithm
                        switch (def.global_algorithm) {
                            case 1: // sum
                                globalStat.bestINT = (globalStat.bestINT || 0) + Math.round(stat);
                                break;
                            case 4: // min
                                globalStat.bestINT = globalStat.bestINT == null ? Math.round(stat) : Math.min(globalStat.bestINT, Math.round(stat));
                                break;
                            case 0: // latest
                                globalStat.bestINT = Math.round(stat);
                                break;
                            default: // 3: max (default for best)
                                globalStat.bestINT = globalStat.bestINT == null ? Math.round(stat) : Math.max(globalStat.bestINT, Math.round(stat));
                        }
                    }
                    else if (def.valueTYPE === 1 || def.valueTYPE === 2) {
                        // float / average
                        // value: use def.algorithm; for avg, valueINT is sample count
                        switch (def.algorithm) {
                            case 1: // sum
                                globalStat.valueFLOAT = (globalStat.valueFLOAT || 0) + stat;
                                break;
                            case 2: { // avg
                                const n = (globalStat.valueINT || 0) + 1;
                                globalStat.valueFLOAT = ((globalStat.valueFLOAT || 0) + stat);
                                globalStat.valueINT = n;
                                break;
                            }
                            case 3: // max
                                globalStat.valueFLOAT = globalStat.valueFLOAT == null ? stat : Math.max(globalStat.valueFLOAT, stat);
                                break;
                            case 4: // min
                                globalStat.valueFLOAT = globalStat.valueFLOAT == null ? stat : Math.min(globalStat.valueFLOAT, stat);
                                break;
                            default: // 0: latest
                                globalStat.valueFLOAT = stat;
                        }
                        // best: use def.global_algorithm
                        switch (def.global_algorithm) {
                            case 1: // sum
                                globalStat.bestFLOAT = (globalStat.bestFLOAT || 0) + stat;
                                break;
                            case 4: // min
                                globalStat.bestFLOAT = globalStat.bestFLOAT == null ? stat : Math.min(globalStat.bestFLOAT, stat);
                                break;
                            case 0: // latest
                                globalStat.bestFLOAT = stat;
                                break;
                            default: // 3: max (default for best)
                                globalStat.bestFLOAT = globalStat.bestFLOAT == null ? stat : Math.max(globalStat.bestFLOAT, stat);
                        }
                    }
                    else if (def.valueTYPE === 4) {
                        // string: latest only
                        globalStat.valueSTRING = String(stat);
                        globalStat.bestSTRING = String(stat);
                    }
                    globalStatMap[def.stat_slug] = globalStat;
                }
                //aggregate all stats into a single array to batch
                for (let key in globalStatMap) {
                    let globalStat = globalStatMap[key];
                    globalStatRows.push(globalStat);
                }
            }
            //insert player match stat records
            if (playerStatRows.length > 0) {
                let matchInsertResults = await db.insertBatch("person_stat_match", playerStatRows, ["stat_slug", "shortid", "room_slug"], [], ["tsupdate", "tsinsert"]);
                console.log("Match Insert for", room_slug, game_slug, matchInsertResults);
            }
            //insert or update the player global stat records
            if (globalStatRows.length > 0) {
                let globalInsertResults = await db.insertBatch("person_stat_global", globalStatRows, ["stat_slug", "shortid", "game_slug", "season"], [], ["tsupdate", "tsinsert"]);
                console.log("Global Insert for", game_slug, meta.season, globalInsertResults);
            }
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
        return true;
    }
    async getPlayerGlobalStats({ shortid, game_slug }) {
        try {
            let db = await mysql.db();
            const result = await db.sql(`SELECT
                    stat_slug,
                    season,
                    valueINT,
                    valueFLOAT,
                    valueSTRING,
                    bestINT,
                    bestFLOAT,
                    bestSTRING,
                    tsinsert,
                    tsupdate
                FROM person_stat_global
                WHERE shortid = ?
                  AND game_slug = ?
                ORDER BY season DESC, stat_slug ASC`, [shortid, game_slug]);
            return result?.results || [];
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }
    async getUserStatHistory({ shortid, game_slug, stat_slug, days = 30 }) {
        try {
            let db = await mysql.db();
            // Query the last `days` of stat records for this user/stat/game
            const sql = `
            SELECT 
                tsinsert,
                COALESCE(valueINT, valueFLOAT) AS value
            FROM person_stat_match
            WHERE shortid = ?
              AND game_slug = ?
              AND stat_slug = ?
              AND tsinsert >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY tsinsert ASC
        `;
            const params = [shortid, game_slug, stat_slug, days];
            const result = await db.sql(sql, params);
            return result?.results || [];
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }
    async getGameStats(game_slug, is_solo) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting stat definitions: ", game_slug);
            response = await db.sql(`SELECT s.*
                FROM stat_definition s
                WHERE s.game_slug = ? 
                `, [game_slug]);
            let statDefs = response?.results || [];
            if (!is_solo) {
                statDefs.push({
                    stat_slug: "ACOS_RATING",
                    algorithm: 2,
                    global_algorithm: 3,
                    game_slug: game_slug,
                    stat_name: "Rating",
                    stat_abbreviation: "PR",
                    stat_desc: "Player's overall rating for the game.",
                    display_format: 0,
                    valueTYPE: 0,
                    isactive: 1,
                });
                statDefs.push({
                    stat_slug: "ACOS_WINS",
                    algorithm: 1,
                    global_algorithm: 1,
                    game_slug: game_slug,
                    stat_name: "Matches Won",
                    stat_abbreviation: "W",
                    stat_desc: "Matches Won",
                    display_format: 0,
                    valueTYPE: 0,
                    isactive: 1,
                });
                statDefs.push({
                    stat_slug: "ACOS_WINRATING",
                    algorithm: 2,
                    global_algorithm: 3,
                    game_slug: game_slug,
                    stat_name: "Win Rating",
                    stat_abbreviation: "WR",
                    stat_desc: "Win Rating (Wins/Played)",
                    display_format: 1,
                    valueTYPE: 2,
                    isactive: 1,
                });
            }
            statDefs.push({
                stat_slug: "ACOS_PLAYTIME",
                algorithm: 1,
                global_algorithm: 1,
                game_slug: game_slug,
                stat_name: "Played Time",
                stat_abbreviation: "PT",
                stat_desc: "Total time played",
                display_format: 2,
                valueTYPE: 3,
                isactive: 1,
            });
            statDefs.push({
                stat_slug: "ACOS_PLAYED",
                algorithm: 1,
                global_algorithm: 1,
                game_slug: game_slug,
                stat_name: "Matches Played",
                stat_abbreviation: "PLY",
                stat_desc: "Matches played",
                display_format: 0,
                valueTYPE: 0,
                isactive: 1,
            });
            statDefs.push({
                stat_slug: "ACOS_SCORE",
                algorithm: 1,
                global_algorithm: 1,
                game_slug: game_slug,
                stat_name: "Match Score",
                stat_abbreviation: "S",
                stat_desc: "Score player earned during match",
                display_format: 0,
                valueTYPE: 0,
                isactive: 1,
            });
            return statDefs;
        }
        catch (e) {
            if (e instanceof GeneralError)
                throw e;
            throw new CodeError(e);
        }
    }
}
export default new StatService();
//# sourceMappingURL=stats.js.map