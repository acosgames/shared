import MySQL from "./mysql.js";
const mysql = new MySQL();

import credutil from "../util/credentials.js";
import { genUnique64string, genShortId } from "../util/idgen.js";
import { utcDATETIME } from "../util/datefns.js";
import { GeneralError, CodeError, SQLError } from "../util/errorhandler.js";
import { uniqueName, isObject } from "../util/utils.js";
import redis from "./redis.js";
import game from "./game.js";// const game = new GameService();

class StatService {
    constructor(credentials?: any) {
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
                if (!player.stats) player.stats = {};
                player.stats["ACOS_WINS"] = player.winloss == 1 ? 1 : 0;
                player.stats["ACOS_PLAYED"] = 1;
                player.stats["ACOS_PLAYTIME"] = Math.floor(
                    (gamestate.room.endtime) / 1000
                );
                player.stats["ACOS_SCORE"] = player.highscore || player.score || 0;
                player.stats["ACOS_RATING"] = player.rating || 0;
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
                let statsResponse = await db.sql(
                    `SELECT 
                    stat_slug,
                    game_slug,
                    shortid,
                    season,
                    valueINT,
                    valueFLOAT
                FROM person_stat_global
                WHERE game_slug = ?
                AND season = ?
                and shortid in (?)`,
                    [game_slug, meta.season, shortids]
                );

                for (let i = 0; i < statsResponse.results.length; i++) {
                    let stat = statsResponse.results[i];
                    let shortid = stat.shortid;
                    if (!(shortid in playerStats)) playerStats[shortid] = [];
                    playerStats[shortid].push(stat);
                }
            } catch (e2) {
                console.error(e2);
            }

            //process each player individually
            for (let shortid of shortids) {
                let playerid = gamestate?.room?._players[shortid];
                let player = players[playerid];
                if (!player) continue;

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
                    if (!(stat_abbreviation in defs)) continue;

                    let def = defs[stat_abbreviation];
                    let stat = player.stats[stat_abbreviation];
                    let globalStat = null;

                    switch (def.valueTYPE) {
                        case 0: //integer
                        case 3: //time
                            if (typeof stat !== "number" && !Number.isInteger(stat)) {
                                console.error(
                                    "Stat is not an integer number",
                                    game_slug,
                                    stat_abbreviation,
                                    stat
                                );
                            }
                            playerStatRows.push({
                                stat_slug: def.stat_slug,
                                game_slug,
                                room_slug,
                                shortid,
                                valueINT: stat,
                                valueFLOAT: null,
                            });

                            globalStat = globalStatMap[def.stat_slug];
                            if (!globalStat) {
                                globalStat = {
                                    stat_slug: def.stat_slug,
                                    game_slug,
                                    shortid,
                                    season: meta.season,
                                    valueINT: stat,
                                    bestINT: stat,
                                    valueFLOAT: null,
                                };
                            } else {
                                globalStat.valueINT += stat;
                                if (stat > globalStat.bestINT) globalStat.bestINT = stat;
                                // globalStat.isUpdate = true;
                            }
                            globalStatMap[def.stat_slug] = globalStat;
                            break;
                        case 1: //float
                            if (typeof stat !== "number" || Number.isInteger(stat)) {
                                console.error(
                                    "Stat is not a float number",
                                    game_slug,
                                    stat_abbreviation,
                                    stat
                                );
                            }
                            playerStatRows.push({
                                stat_slug: def.stat_slug,
                                game_slug,
                                room_slug,
                                shortid,
                                valueFLOAT: stat,
                                valueINT: null,
                            });

                            globalStat = globalStatMap[def.stat_slug];
                            if (!globalStat) {
                                globalStat = {
                                    stat_slug: def.stat_slug,
                                    game_slug,
                                    shortid,
                                    season: meta.season,
                                    valueINT: null,
                                    valueFLOAT: stat,
                                    bestFLOAT: stat,
                                };
                            } else {
                                globalStat.valueFLOAT += stat;
                                if (stat > globalStat.bestFLOAT) globalStat.bestFLOAT = stat;
                            }
                            globalStatMap[def.stat_slug] = globalStat;

                            break;
                        case 2: //average
                            if (typeof stat !== "number") {
                                console.error(
                                    "IntStat is not a number",
                                    game_slug,
                                    stat_abbreviation,
                                    stat
                                );
                            }
                            playerStatRows.push({
                                stat_slug: def.stat_slug,
                                room_slug,
                                game_slug,
                                shortid,
                                valueINT: 1,
                                valueFLOAT: stat,
                            });

                            globalStat = globalStatMap[def.stat_slug];
                            if (!globalStat) {
                                globalStat = {
                                    stat_slug: def.stat_slug,
                                    game_slug,
                                    shortid,
                                    season: meta.season,
                                    valueINT: 1,
                                    valueFLOAT: stat,
                                };
                            } else {
                                let avg =
                                    (globalStat.valueFLOAT * globalStat.valueINT + stat) /
                                    (globalStat.valueINT + 1);
                                globalStat.valueINT += 1;
                                globalStat.valueFLOAT = avg;

                                if (stat > globalStat.bestFLOAT) globalStat.bestFLOAT = stat;
                            }
                            globalStatMap[def.stat_slug] = globalStat;

                            break;
                    }
                }

                //aggregate all stats into a single array to batch
                for (let key in globalStatMap) {
                    let globalStat = globalStatMap[key];

                    globalStatRows.push(globalStat);
                }
            }

            //insert player match stat records
            if (playerStatRows.length > 0) {
                let matchInsertResults = await db.insertBatch(
                    "person_stat_match",
                    playerStatRows,
                    ["stat_slug", "shortid", "room_slug"],
                    [],
                    ["tsupdate", "tsinsert"]
                );
                console.log("Match Insert for", room_slug, game_slug, matchInsertResults);
            }

            //insert or update the player global stat records
            if (globalStatRows.length > 0) {
                let globalInsertResults = await db.insertBatch(
                    "person_stat_global",
                    globalStatRows,
                    ["stat_slug", "shortid", "game_slug", "season"],
                    [],
                    ["tsupdate", "tsinsert"]
                );
                console.log("Global Insert for", game_slug, meta.season, globalInsertResults);
            }
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
        return true;
    }

    async getPlayerGlobalStats({ shortid, game_slug }: { shortid: string; game_slug: string }) {
        try {
            let db = await mysql.db();
            const result = await db.sql(
                `SELECT
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
                ORDER BY season DESC, stat_slug ASC`,
                [shortid, game_slug]
            );
            return result?.results || [];
        } catch (e) {
            if (e instanceof GeneralError) throw e;
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
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async getGameStats(game_slug, is_solo): Promise<StatDefinition[]> {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting stat definitions: ", game_slug);
            response = await db.sql(
                `SELECT s.*
                FROM stat_definition s
                WHERE s.game_slug = ? 
                `,
                [game_slug]
            );

            let statDefs: StatDefinition[] = response?.results || [];

            if (!is_solo) {
                statDefs.push({
                    stat_slug: "ACOS_RATING",
                    algorithm_id: null,
                    game_slug: game_slug,
                    stat_name: "Player Rating",
                    stat_abbreviation: "PR",
                    stat_desc: "Player's overall rating for the game.",
                    sort: 0,
                    valueTYPE: 0,
                    isactive: 1,
                });

                statDefs.push({
                    stat_slug: "ACOS_WINS",
                    algorithm_id: null,
                    game_slug: game_slug,
                    stat_name: "Matches Won",
                    stat_abbreviation: "W",
                    stat_desc: "Matches Won",
                    sort: 0,
                    valueTYPE: 0,
                    isactive: 1,
                });
            }

            statDefs.push({
                stat_slug: "ACOS_PLAYTIME",
                algorithm_id: null,
                game_slug: game_slug,
                stat_name: "Played Time",
                stat_abbreviation: "PT",
                stat_desc: "Total time played",
                sort: 0,
                valueTYPE: 3,
                isactive: 1,
            });

            statDefs.push({
                stat_slug: "ACOS_PLAYED",
                algorithm_id: null,
                game_slug: game_slug,
                stat_name: "Matches Played",
                stat_abbreviation: "PLY",
                stat_desc: "Matches played",
                sort: 0,
                valueTYPE: 0,
                isactive: 1,
            });

            statDefs.push({
                stat_slug: "ACOS_SCORE",
                algorithm_id: null,
                game_slug: game_slug,
                stat_name: "Match Score",
                stat_abbreviation: "S",
                stat_desc: "Score player earned during match",
                sort: 0,
                valueTYPE: 0,
                isactive: 1,
            });

            return statDefs;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }
}

export default new StatService();