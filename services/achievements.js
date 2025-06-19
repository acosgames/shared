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

const webpush = require("web-push");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const cache = require("./cache");
const { muRating, muDefault, sigmaDefault } = require("../util/ratingconfig");

const ModeFromID = ["experimental", "rank", "public", "private"];
const ModeFromName = {
    experimental: 0,
    rank: 1,
    public: 2,
    private: 3,
};

class AchievementService {
    constructor(credentials) {
        this.credentials = credentials || credutil();
    }

    async getAchievementDefinitions(game_slug, stats) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting achievement definitions: ", game_slug);
            response = await db.sql(
                `SELECT ad.*
                FROM achievement_definition ad
                WHERE ad.game_slug = ? 
                `,
                [game_slug]
            );

            if (response.results && response.results.length == 0) {
                return [];
            }

            if (stats) {
                let statMap = {};
                stats.map((stat) => (statMap[stat.stat_slug] = stat));
                response.results = response.results.map((ach) => {
                    if (ach.stat_slug1) ach.stat_name1 = statMap[ach.stat_slug1].stat_name;
                    if (ach.stat_slug2) ach.stat_name2 = statMap[ach.stat_slug2].stat_name;
                    if (ach.stat_slug3) ach.stat_name3 = statMap[ach.stat_slug3].stat_name;
                    return ach;
                });
            }

            return response.results;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async getAchievementProgress(game_slug, shortid, stats) {
        try {
            let db = await mysql.db();
            var response;
            console.log("Getting achievement progress: ", game_slug);
            response = await db.sql(
                `SELECT ad.*, 
                    pa.stat1_valueINT,
                    pa.stat1_valueFLOAT,
                    pa.stat2_valueINT,
                    pa.stat2_valueFLOAT,
                    pa.stat3_valueINT,
                    pa.stat3_valueFLOAT,
                    pa.played,
                    pa.completed,
                    pa.claimed
                FROM achievement_definition ad
                LEFT JOIN person_achievement pa
                    ON pa.achievement_slug = ad.achievement_slug 
                    AND pa.game_slug = ad.game_slug 
                    AND pa.shortid = ? 
                WHERE ad.game_slug = ? 
                `,
                [shortid, game_slug]
            );

            if (response.results && response.results.length == 0) {
                return [];
            }

            if (stats) {
                let statMap = {};
                stats.map((stat) => (statMap[stat.stat_slug] = stat));
                response.results = response.results.map((ach) => {
                    if (ach.stat_slug1) ach.stat_name1 = statMap[ach.stat_slug1].stat_name;
                    if (ach.stat_slug2) ach.stat_name2 = statMap[ach.stat_slug2].stat_name;
                    if (ach.stat_slug3) ach.stat_name3 = statMap[ach.stat_slug3].stat_name;
                    return ach;
                });
            }

            return response.results;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async claimAchievement(game_slug, shortid, achievement_slug) {
        try {
            let db = await mysql.db();

            let { results } = await db.update(
                "person_achievement",
                {
                    claimed: 1,
                },
                "achievement_slug = ? AND game_slug = ? AND shortid = ? AND completed IS NOT NULL",
                [achievement_slug, game_slug, shortid]
            );

            if (results.affectedRows != 1 || results.changedRows != 1)
                throw new Error("Achievement already claimed.");

            let achievements = await db.query(
                `SELECT * FROM achievement_definition WHERE achievement_slug = ? AND game_slug = ?`,
                [achievement_slug, game_slug]
            );

            let achievement = null;
            if (achievements.length == 0) {
                throw new Error("Invalid achievement: " + achievement_slug);
            }

            achievement = achievements[0];

            let players = await db.query(`SELECT * FROM person WHERE shortid = ?`, [shortid]);
            let player = null;
            if (players.length == 0) throw new Error("Invalid player: " + shortid);
            player = players[0];

            if (achievement?.award_xp) {
                let totalXP = achievement?.award_xp;
                let previousPoints = Math.trunc((player.level - Math.trunc(player.level)) * 1000);
                let previousLevel = Math.trunc(player.level);
                let newPoints = previousPoints + totalXP;
                let newLevel = previousLevel;

                let earnedLevels = Math.floor(newPoints / 1000);
                if (earnedLevels > 0) {
                    newLevel += earnedLevels;
                    newPoints = newPoints % 1000;
                }

                let experience = [];
                experience.push({
                    type: achievement.achievement_name,
                    value: totalXP,
                });

                let user = {
                    shortid,
                    level: newLevel + newPoints / 1000,
                };
                person.updateUser(user);

                return {
                    type: "award_xp",
                    experience,
                    previousPoints,
                    previousLevel,
                    points: totalXP,
                    level: newLevel,
                    newLevel: newLevel + newPoints / 1000,
                };
            }

            if (achievement?.award_gamepoints) {
            }

            return results.affectedRows == 1 && results.changedRows == 1;
        } catch (e) {
            if (e instanceof GeneralError) throw e;
            throw new CodeError(e);
        }
    }

    async updatePlayerAchievements(meta, gamestate) {
        try {
            let db = await mysql.db();

            let room_slug = meta?.room_slug;
            let game_slug = meta?.game_slug;
            let players = gamestate?.players;

            //all stat definitions
            let statDefs = await db.query(
                `SELECT *
                FROM stat_definition a
                WHERE a.game_slug = ?`,
                [game_slug]
            );
            statDefs.push({
                stat_slug: "ACOS_WINS",
                algorithm_id: null,
                game_slug: game_slug,
                stat_name: "Matches Won",
                stat_abbreviation: "W",
                stat_desc: "Matches Won",
                valueTYPE: 0,
                isactive: 1,
            });

            statDefs.push({
                stat_slug: "ACOS_PLAYTIME",
                algorithm_id: null,
                game_slug: game_slug,
                stat_name: "Time Played",
                stat_abbreviation: "PT",
                stat_desc: "Total time played",
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
                valueTYPE: 0,
                isactive: 1,
            });

            statDefs.push({
                stat_slug: "ACOS_RATING",
                algorithm_id: null,
                game_slug: game_slug,
                stat_name: "Player Rating",
                stat_abbreviation: "S",
                stat_desc: "Player's overall rating for the game.",
                valueTYPE: 0,
                isactive: 1,
            });

            //mappings for faster indexing
            let statMap = {};
            statDefs.map((def) => {
                statMap[def.stat_slug] = def;
                statMap[def.stat_abbreviation] = def;
            });

            //all achievement definitions
            let achievementDefs = await db.query(
                `SELECT *
                FROM achievement_definition a
                WHERE a.game_slug = ?`,
                [game_slug]
            );

            //mappings for faster indexing
            let achMap = {};
            achievementDefs.map((def) => {
                achMap[def.achievement_slug] = def;
            });

            let playerAchievements = {};
            let shortids = Object.keys(players);
            try {
                let achievements = await db.query(
                    `SELECT *
                    FROM person_achievement
                    WHERE game_slug = ?
                    and shortid in (?)`,
                    [game_slug, shortids]
                );

                for (let i = 0; i < achievements.length; i++) {
                    let achievement = achievements[i];
                    let shortid = achievement.shortid;
                    if (!(shortid in playerAchievements)) playerAchievements[shortid] = {};
                    playerAchievements[shortid][achievement.achievement_slug] = achievement;
                }
            } catch (e2) {
                console.error(e2);
            }

            let updateAchievements = [];
            //process each player individually
            for (let shortid of shortids) {
                let player = players[shortid];

                if (!player?.stats) player.stats = {};
                player.stats["ACOS_WINS"] = player.winloss == 1 ? 1 : 0;
                player.stats["ACOS_PLAYED"] = 1;
                player.stats["ACOS_PLAYTIME"] = Math.floor(
                    (gamestate.room.endtime - gamestate.room.starttime) / 1000
                );
                player.stats["ACOS_SCORE"] = player.score || 0;
                player.stats["ACOS_RATING"] = player.rating || 0;

                //process each person achievement
                for (let achievement of achievementDefs) {
                    let pAchievement =
                        (playerAchievements[shortid] &&
                            playerAchievements[shortid][achievement.achievement_slug]) ||
                        {};

                    //already completed, skip
                    if (pAchievement.completed) continue;

                    //increment stat 1
                    if (achievement.stat_slug1) {
                        this.updateAchievementStat(
                            1,
                            achievement,
                            statMap,
                            pAchievement,
                            player.stats
                        );
                    } else {
                        this.resetAchievementStat(1, pAchievement);
                    }

                    //increment stat 2
                    if (achievement.stat_slug2) {
                        this.updateAchievementStat(
                            2,
                            achievement,
                            statMap,
                            pAchievement,
                            player.stats
                        );
                    } else {
                        this.resetAchievementStat(2, pAchievement);
                    }

                    //increment stat 3
                    if (achievement.stat_slug3) {
                        this.updateAchievementStat(
                            3,
                            achievement,
                            statMap,
                            pAchievement,
                            player.stats
                        );
                    } else {
                        this.resetAchievementStat(3, pAchievement);
                    }

                    //ensure played starts at 0
                    if (!("played" in pAchievement)) {
                        pAchievement.played = 0;
                    }

                    try {
                        //calculate progress
                        let { value, maxValue, percent } = this.calculateAchievementProgress(
                            achievement,
                            pAchievement
                        );

                        if (achievement.times_in_a_row == 0) {
                            //infinite attempts, keep incrementing each stat until we reach goal
                            if (value >= maxValue) {
                                pAchievement.completed = mysql.utcTimestamp();
                            }
                            if (value > 0) pAchievement.played = pAchievement.played + 1;
                        } else {
                            //reached achievement requirements, increment played
                            if (value >= maxValue) {
                                pAchievement.played = pAchievement.played + 1;
                            }

                            //have we repeated required amount?
                            if (pAchievement.played >= achievement.times_in_a_row) {
                                pAchievement.completed = mysql.utcTimestamp();
                            } else {
                                //reset progress for next attempt check
                                this.resetAchievementStat(1, pAchievement);
                                this.resetAchievementStat(2, pAchievement);
                                this.resetAchievementStat(3, pAchievement);
                            }
                        }
                    } catch (e2) {
                        console.error(e2);

                        //failed to caluclate, cancel this achievement
                        continue;
                    }

                    pAchievement.achievement_slug = achievement.achievement_slug;
                    pAchievement.game_slug = achievement.game_slug;
                    pAchievement.shortid = shortid;
                    pAchievement.completed = pAchievement.completed || null;
                    pAchievement.claimed = pAchievement.claimed || null;

                    //only update if we actually met any achievement requirements
                    if (
                        pAchievement.played > 0 ||
                        pAchievement.stat1_valueINT ||
                        pAchievement.stat1_valueFLOAT ||
                        // pAchievement.stat1_valueSTRING ||
                        pAchievement.stat2_valueINT ||
                        pAchievement.stat2_valueFLOAT ||
                        // pAchievement.stat2_valueSTRING ||
                        pAchievement.stat3_valueINT ||
                        pAchievement.stat3_valueFLOAT // ||
                        // pAchievement.stat3_valueSTRING
                    )
                        updateAchievements.push(pAchievement);
                }
            }

            if (updateAchievements?.length > 0) {
                let matchInsertResults = await db.insertBatch(
                    "person_achievement",
                    updateAchievements,
                    ["achievement_slug", "game_slug", "shortid"],
                    [],
                    ["tsupdate", "tsinsert"]
                );
            }

            let playerList = {};
            for (let shortid of shortids) {
                playerList[shortid] = {};

                for (let a of updateAchievements) {
                    if (a.shortid == shortid) {
                        playerList[shortid][a.achievement_slug] = a;
                    }
                }
            }

            return playerList;
        } catch (e) {
            console.error(e);
        }
        return [];
    }

    resetAchievementStat(index, playerAchievement) {
        playerAchievement["stat" + index + "_valueINT"] = null;
        playerAchievement["stat" + index + "_valueFLOAT"] = null;
        // playerAchievement["stat" + index + "_valueSTRING"] = null;
    }

    //increment or add into the player achievement
    updateAchievementStat(index, achievement, statMap, playerAchievement, playerStats) {
        let stat_slug = achievement["stat_slug" + index];
        let stat = statMap[stat_slug];
        if (!stat?.stat_abbreviation) {
            console.log(stat);
        }
        let matchStat = playerStats[stat.stat_abbreviation];
        if (typeof matchStat === "undefined") {
            matchStat = playerStats[stat.stat_slug];
            if (typeof matchStat === "undefined")
                // this.resetAchievementStat(1, playerAchievement);
                // this.resetAchievementStat(2, playerAchievement);
                // this.resetAchievementStat(3, playerAchievement);
                return false;
        }

        switch (stat.valueTYPE) {
            case 0: {
                //integer
                if (typeof playerAchievement["stat" + index + "_valueINT"] === "undefined")
                    playerAchievement["stat" + index + "_valueINT"] = 0;

                playerAchievement["stat" + index + "_valueINT"] =
                    matchStat + playerAchievement["stat" + index + "_valueINT"];
                playerAchievement["stat" + index + "_valueFLOAT"] = null;
                // playerAchievement["stat" + index + "_valueSTRING"] = null;
                break;
            }
            // case 4: {
            //     //string count
            //     let valueSTRING = achievement["goal" + index + "_valueSTRING"];
            //     if (valueSTRING in matchStat) {
            //         if (typeof playerAchievement["stat" + index + "_valueINT"] === "undefined")
            //             playerAchievement["stat" + index + "_valueINT"] = 0;

            //         playerAchievement["stat" + index + "_valueINT"] =
            //             matchStat[valueSTRING] + playerAchievement["stat" + index + "_valueINT"];
            //         playerAchievement["stat" + index + "_valueSTRING"] = valueSTRING;
            //         playerAchievement["stat" + index + "_valueFLOAT"] = null;
            //     } else {
            //         playerAchievement["stat" + index + "_valueINT"] =
            //             playerAchievement["stat" + index + "_valueINT"] || null;
            //         playerAchievement["stat" + index + "_valueFLOAT"] = null;
            //         playerAchievement["stat" + index + "_valueSTRING"] =
            //             playerAchievement["stat" + index + "_valueSTRING"] || null;
            //     }
            //     break;
            // }
            case 1: {
                //float
                if (typeof playerAchievement["stat" + index + "_valueFLOAT"] === "undefined")
                    playerAchievement["stat" + index + "_valueFLOAT"] = 0;

                playerAchievement["stat" + index + "_valueFLOAT"] =
                    matchStat + playerAchievement["stat" + index + "_valueFLOAT"];
                playerAchievement["stat" + index + "_valueINT"] = null;
                // playerAchievement["stat" + index + "_valueSTRING"] = null;
                break;
            }
            case 2: {
                //average
                playerAchievement["stat" + index + "_valueFLOAT"] = matchStat;
                playerAchievement["stat" + index + "_valueINT"] = null;
                // playerAchievement["stat" + index + "_valueSTRING"] = null;
                break;
            }
            case 3: {
                //time
                if (typeof playerAchievement["stat" + index + "_valueINT"] === "undefined")
                    playerAchievement["stat" + index + "_valueINT"] = 0;
                playerAchievement["stat" + index + "_valueINT"] =
                    matchStat + playerAchievement["stat" + index + "_valueINT"];
                playerAchievement["stat" + index + "_valueFLOAT"] = null;
                // playerAchievement["stat" + index + "_valueSTRING"] = null;
                break;
            }
            default: {
                this.resetAchievementStat(1, playerAchievement);
                this.resetAchievementStat(2, playerAchievement);
                this.resetAchievementStat(3, playerAchievement);
            }
        }
        return true;
    }

    calculateAchievementProgress(achievement, progress) {
        let {
            stat_slug1,
            goal1_valueTYPE,
            goal1_valueINT,
            goal1_valueFLOAT,
            // goal1_valueSTRING,
            stat_slug2,
            goal2_valueTYPE,
            goal2_valueINT,
            goal2_valueFLOAT,
            // goal2_valueSTRING,
            stat_slug3,
            goal3_valueTYPE,
            goal3_valueINT,
            goal3_valueFLOAT,
            // goal3_valueSTRING,
            all_required,
            times_in_a_row,
        } = achievement;

        let {
            stat1_valueINT,
            stat1_valueFLOAT,
            // stat1_valueSTRING,
            stat2_valueINT,
            stat2_valueFLOAT,
            // stat2_valueSTRING,
            stat3_valueINT,
            stat3_valueFLOAT,
            // stat3_valueSTRING,
            played,
        } = progress;

        // use cases:
        // 1) All stats required, in one match
        // 2) All stats required, repeated multiple matches
        // 3) Any stats required, in one match
        // 4) Any stats required, repeated multiple matches

        let status = [];

        // if (Number.isInteger(times_in_a_row) && times_in_a_row > 0) {
        //     let value = played || 0;
        //     let maxValue = times_in_a_row;
        //     let percent = (value / maxValue) * 100;
        //     return { value, maxValue, percent };
        // }

        if (stat_slug1) {
            let stat1progress = this.calculateStatProgress(
                stat_slug1,
                goal1_valueTYPE,
                goal1_valueINT,
                goal1_valueFLOAT,
                // goal1_valueSTRING,
                stat1_valueINT,
                stat1_valueFLOAT,
                // stat1_valueSTRING,
                times_in_a_row,
                played
            );
            if (stat1progress) status.push(stat1progress);
        }
        if (stat_slug2) {
            let stat2progress = this.calculateStatProgress(
                stat_slug2,
                goal2_valueTYPE,
                goal2_valueINT,
                goal2_valueFLOAT,
                // goal2_valueSTRING,
                stat2_valueINT,
                stat2_valueFLOAT,
                // stat2_valueSTRING,
                times_in_a_row,
                played
            );
            if (stat2progress) status.push(stat2progress);
        }
        if (stat_slug3) {
            let stat3progress = this.calculateStatProgress(
                stat_slug3,
                goal3_valueTYPE,
                goal3_valueINT,
                goal3_valueFLOAT,
                // goal3_valueSTRING,
                stat3_valueINT,
                stat3_valueFLOAT,
                // stat3_valueSTRING,
                times_in_a_row,
                played
            );
            if (stat3progress) status.push(stat3progress);
        }

        let value = 0;
        let maxValue = 0;
        let percent = 0;

        if (!all_required) {
            //sum all the stat values, they should be of same type
            value = status.reduce(
                (total, curr) =>
                    curr === false ? total : total + Math.min(curr.value, curr.maxValue),
                0
            );
            //use the largest max goal of the stats
            maxValue = status.reduce(
                (total, curr) => (curr.maxValue >= total ? curr.maxValue : total),
                0
            );
            if (Number.isNaN(value)) value = 0;
            if (Number.isNaN(maxValue)) maxValue = 1;
            percent = (value / maxValue) * 100;
        } else {
            //only percentage matters here
            //value and maxValue will be displayed for each stat individually in achievement panel
            //     status = status.filter((s) => s !== false);
            //     percent = status.reduce((total, curr) => total + curr.percent, 0);
            //     // percent = percent / status.length;
            //     value = 0;
            //     maxValue = 1;

            value = status.reduce(
                (total, curr) =>
                    curr === false ? total : total + Math.min(curr.value, curr.maxValue),
                0
            );
            //use the largest max goal of the stats
            maxValue = status.reduce(
                (total, curr) => (curr === false ? total : total + curr.maxValue),
                0
            );
            if (Number.isNaN(value)) value = 0;
            if (Number.isNaN(maxValue)) maxValue = 1;
            percent = (value / maxValue) * 100;
        }

        // let maxValue = status.length;
        // let value = status.reduce((total, s) => (s == true ? total + 1 : total), 0);
        // let percent = (value / maxValue) * 100;
        return { value, maxValue, percent };
    }

    calculateStatProgress(
        stat_slug,
        goal_valueTYPE,
        goal_valueINT,
        goal_valueFLOAT,
        // goal_valueSTRING,
        stat_valueINT,
        stat_valueFLOAT,
        // stat_valueSTRING,
        times_in_a_row,
        played
    ) {
        //no negative numbers
        //0 = infinite matches to reach goal
        //1+ = must repeat goal for X matches
        times_in_a_row = Math.max(0, times_in_a_row);

        // //player must reach the target for X matches, so just count how many times they've reached it
        // if (Number.isInteger(times_in_a_row) && times_in_a_row > 0) {
        //     let value = played || 0;
        //     let maxValue = times_in_a_row;
        //     let percent = (value / maxValue) * 100;
        //     return { value, maxValue, percent };
        // }

        //player has to accumilate over 1 or more matches, calculate percentage of goal reached
        switch (goal_valueTYPE) {
            case 0: //integer
            case 3: //time
            case 4: {
                //string count

                let value = stat_valueINT || 0;
                let maxValue = goal_valueINT;
                let percent = (value / maxValue) * 100;
                return { value, maxValue, percent };
            }
            case 1: //float
            case 2: {
                //average
                let value = stat_valueFLOAT || 0;
                let maxValue = goal_valueFLOAT;
                let percent = (value / maxValue) * 100;
                return { value, maxValue, percent };
            }
        }
        return false;
    }
}

module.exports = new AchievementService();
