const MySQL = require("./mysql");
const mysql = new MySQL();

const credutil = require("../util/credentials");
const { genUnique64string, genShortId } = require("../util/idgen");
const { utcDATETIME } = require("../util/datefns");
const { GeneralError, CodeError, SQLError } = require("../util/errorhandler");

const { uniqueName, isObject } = require("../util/utils");

const redis = require("./redis");

const game = require("./game");
// const game = new GameService();

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

            //all stat definitions
            let statDefResponse = await db.sql(
                `SELECT 
                *
            FROM stat_definition a
            WHERE a.game_slug = ?`,
                [game_slug]
            );

            if (!statDefResponse.results || statDefResponse.results.length == 0)
                return true;

            let statDefinitions = statDefResponse.results;

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
            let shortids = Object.keys(players);
            let playerStats = {};
            try {
                let statsResponse = await db.sql(
                    `SELECT 
                    stat_slug,
                    game_slug,
                    shortid,
                    season,
                    valueINT,
                    valueFLOAT,
                    valueSTRING
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
                let player = players[shortid];

                let globalStatMap = {};

                //map the player global stats into a stat map
                playerStats[shortid]?.map((gs) => {
                    if (defs[gs.stat_slug]?.valueTYPE == 4) {
                        globalStatMap[gs.stat_slug + "/" + gs.valueSTRING] = gs;
                    } else {
                        globalStatMap[gs.stat_slug] = gs;
                    }
                });

                //process each stat individually
                for (let stat_abbreviation in player.stats) {
                    if (!(stat_abbreviation in defs)) continue;

                    let def = defs[stat_abbreviation];
                    let stat = player.stats[stat_abbreviation];
                    let globalStat = null;

                    switch (def.valueTYPE) {
                        case 0: //integer
                        case 3: //time
                            if (
                                typeof stat !== "number" ||
                                !Number.isInteger(stat)
                            ) {
                                console.error(
                                    "Stat is not an integer number",
                                    game_slug,
                                    stat_abbreviation,
                                    stat
                                );
                            }
                            playerStatRows.push({
                                stat_slug: def.stat_slug,
                                room_slug,
                                shortid,
                                valueINT: stat,
                                valueFLOAT: null,
                                valueSTRING: null,
                            });

                            globalStat = globalStatMap[def.stat_slug];
                            if (!globalStat) {
                                globalStat = {
                                    stat_slug: def.stat_slug,
                                    game_slug,
                                    shortid,
                                    season: meta.season,
                                    valueINT: stat,
                                    valueFLOAT: null,
                                    valueSTRING: null,
                                    // isUpdate: false,
                                };
                            } else {
                                globalStat.valueINT += stat;
                                // globalStat.isUpdate = true;
                            }
                            globalStatMap[def.stat_slug] = globalStat;
                            break;
                        case 1: //float
                            if (
                                typeof stat !== "number" ||
                                Number.isInteger(stat)
                            ) {
                                console.error(
                                    "Stat is not a float number",
                                    game_slug,
                                    stat_abbreviation,
                                    stat
                                );
                            }
                            playerStatRows.push({
                                stat_slug: def.stat_slug,
                                room_slug,
                                shortid,
                                valueFLOAT: stat,
                                valueINT: null,
                                valueSTRING: null,
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
                                    valueSTRING: null,
                                    // isUpdate: false,
                                };
                            } else {
                                globalStat.valueFLOAT += stat;
                                // globalStat.isUpdate = true;
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
                                shortid,
                                valueINT: 1,
                                valueFLOAT: stat,
                                valueSTRING: null,
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
                                    valueSTRING: null,
                                    // isUpdate: false,
                                };
                            } else {
                                let avg =
                                    (globalStat.valueFLOAT *
                                        globalStat.valueINT +
                                        stat) /
                                    (globalStat.valueINT + 1);
                                globalStat.valueINT += 1;
                                globalStat.valueFLOAT = avg;
                                // globalStat.isUpdate = true;
                            }
                            globalStatMap[def.stat_slug] = globalStat;

                            break;
                        case 4: //string count
                            if (!isObject(stat)) {
                                console.error(
                                    "StringStat is not an object",
                                    game_slug,
                                    stat_abbreviation,
                                    stat
                                );
                                continue;
                            }
                            for (let stringKey in stat) {
                                playerStatRows.push({
                                    stat_slug: def.stat_slug,
                                    room_slug,
                                    shortid,
                                    valueINT: stat[stringKey],
                                    valueSTRING: stringKey,
                                    valueFLOAT: null,
                                });

                                globalStat =
                                    globalStatMap[
                                        def.stat_slug + "/" + stringKey
                                    ];
                                if (!globalStat) {
                                    globalStat = {
                                        stat_slug: def.stat_slug,
                                        game_slug,
                                        shortid,
                                        season: meta.season,
                                        valueINT: stat[stringKey],
                                        valueSTRING: stringKey,
                                        valueFLOAT: null,
                                        // isUpdate: false,
                                    };
                                } else {
                                    globalStat.valueINT += stat[stringKey];
                                    globalStat.valueSTRING = stringKey;
                                    // globalStat.isUpdate = true;
                                }
                                globalStatMap[def.stat_slug + "/" + stringKey] =
                                    globalStat;
                            }
                            break;
                    }
                }

                //aggregate all stats into a single array to batch
                for (let key in globalStatMap) {
                    let globalStat = globalStatMap[key];

                    globalStatRows.push(globalStat);
                }
            }

            if (playerStatRows.length > 0) {
                let matchInsertResults = await db.insertBatch(
                    "person_stat_match",
                    playerStatRows,
                    ["stat_slug", "shortid", "room_slug"],
                    [],
                    ["tsupdate", "tsinsert"]
                );
                console.log(
                    "Match Insert for",
                    room_slug,
                    game_slug,
                    matchInsertResults
                );
            }
            if (globalStatRows.length > 0) {
                let globalInsertResults = await db.insertBatch(
                    "person_stat_global",
                    globalStatRows,
                    ["stat_slug", "shortid", "game_slug", "season"],
                    [],
                    ["tsupdate", "tsinsert"]
                );
                console.log(
                    "Global Insert for",
                    game_slug,
                    meta.season,
                    globalInsertResults
                );
            }
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
        return true;
    }

    async getGameStats(game_slug) {
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

            if (response.results && response.results.length == 0) {
                return [];
            }

            response.results.push({
                stat_slug: "ACOS_WINS",
                algorithm_id: null,
                game_slug: game_slug,
                stat_name: "Matches Won",
                stat_abbreviation: "W",
                stat_desc: "Matches Won",
                valueTYPE: 0,
                isactive: 1,
            });

            response.results.push({
                stat_slug: "ACOS_PLAYTIME",
                algorithm_id: null,
                game_slug: game_slug,
                stat_name: "Time Played",
                stat_abbreviation: "W",
                stat_desc: "Total time played",
                valueTYPE: 3,
                isactive: 1,
            });

            response.results.push({
                stat_slug: "ACOS_PLAYED",
                algorithm_id: null,
                game_slug: game_slug,
                stat_name: "Matches Played",
                stat_abbreviation: "PLY",
                stat_desc: "Matches played",
                valueTYPE: 0,
                isactive: 1,
            });
            return response.results;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }
}

module.exports = new StatService();
