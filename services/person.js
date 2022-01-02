const MySQL = require('./mysql');
const mysql = new MySQL();
const { genUnique64string, generateAPIKEY, genFullShortId } = require('../util/idgen');
const { utcDATETIME } = require('../util/datefns');
const { GeneralError } = require('../util/errorhandler');
const gh = require('./github');
const jwt = require('jsonwebtoken');
// const gh = GitHub;
const credutil = require('../util/credentials');
const fs = require('fs');

module.exports = class UserService {
    constructor(credentials) {
        this.credentials = credentials || credutil();
        this.publicKey = null;
    }

    encodeUserToken(user, privateKey) {
        return new Promise((rs, rj) => {
            jwt.sign(user, privateKey, { algorithm: 'RS256', expiresIn: '30d' }, function (err, token) {
                if (err) {
                    rj(err);
                    return;
                }
                rs(token);
            });
        })
    }
    decodeUserToken(token, publicKey) {
        return new Promise((rs, rj) => {

            if (!publicKey) {
                try {
                    if (!this.publicKey)
                        this.publicKey = fs.readFileSync('../shared/credential/jwtRS256.key.pub');
                    publicKey = this.publicKey;
                }
                catch (e) {
                    rj("Invalid JWT Public Key");
                }
            }

            jwt.verify(token, publicKey, function (err, user) {
                if (err) {
                    rj(err);
                    return;
                }
                rs(user);
            });
        })
    }

    async findUser(user, db) {
        try {
            db = db || await mysql.db();
            let response;
            if (user.id) {
                response = await db.sql('select * from person where id = ?', [user.id]);
            }
            else if (user.shortid) {
                response = await db.sql('select * from person where shortid = ?', [user.shortid]);
            }
            else if (user.email) {
                response = await db.sql('select * from person where email = ?', [user.email]);
            }
            else if (user.apikey) {
                response = await db.sql('select * from person where apikey = ?', [user.apikey]);
            }
            else if (user.displayname) {
                response = await db.sql('select * from person where LOWER(displayname) = ?', [user.displayname.toLowerCase()]);
            }
            else if (user.github) {
                response = await db.sql('select * from person where github = ?', [user.github]);
            }
            else if (user.github_id) {
                response = await db.sql('select * from person where github_id = ?', [user.github_id]);
            }
            else {
                throw new GeneralError('E_PERSON_MISSINGINFO', user);
            }

            if (response && response.results.length == 0) {
                return null;
            } else {
                user = response.results[0];
            }

            return user;
        }
        catch (e) {
            //console.error(e);
            throw e;
        }
    }

    async findOrCreateUser(user, session) {

        try {
            let db = await mysql.begin('findOrCreateUser');

            try {
                let existingUser = await this.findUser(user, db);
                if (('github' in user) &&
                    (existingUser.github != user.github || existingUser.github_id != user.github_id)) {
                    user.id = existingUser.id;
                    user.isdev = false;
                    user = await this.updateUser(user, db);
                    user = Object.assign({}, existingUser, user)

                    console.log(user);
                }
                else {
                    if (!existingUser)
                        throw "Creating user"
                    user = existingUser;
                }

            }
            catch (e2) {
                user = await this.createUser(user, db);
            }

            await mysql.end('findOrCreateUser');
            //console.log(user);
            return user;
        }
        catch (e) {
            //console.error(e);
            await mysql.end('findOrCreateUser');
            throw e;
        }
    }

    async createDisplayName(user, db) {
        try {
            db = db || await mysql.db();

            // user.displayname = user.displayname.replace(/[^A-Za-z0-9\_]/ig, "");
            // let updatedUser = { displayname: user.displayname }
            let existingUser = await this.findUser({ id: user.id }, db);

            if (existingUser.displayname) {
                throw new GeneralError('E_PERSON_EXISTSNAME', user.displayname);
            }
            // if (existingUser) {
            //     throw new GeneralError("E_PERSON_DUPENAME", updatedUser);
            // }
            let { results } = await db.update('person', user, 'WHERE id = ?', [user.id]);
            console.log(results);
            if (results.affectedRows == 0)
                throw new GeneralError('E_PERSON_UPDATEFAILED', user);

            // if (!existingUser.isdev) {
            //     await this.inviteToGithub(existingUser);
            // }
            return user;
        }
        catch (e) {
            if (e.payload && e.payload.errno == 1062) {
                throw new GeneralError("E_PERSON_DUPENAME", user);
            }

            throw e;
        }
    }

    async updateUser(user, db) {
        try {
            db = db || await mysql.db();
            let id = user.id;
            delete user['id'];

            let { results } = await db.update('person', user, 'WHERE id = ?', [{ toSqlString: () => id }]);

            user.id = id;
            console.log(results);
            if (results.affectedRows == 0)
                throw new GeneralError('E_PERSON_UPDATEFAILED', user);

            return user;
        }
        catch (e) {
            if (e.errno == 1062) {
                throw new GeneralError("E_PERSON_DUPENAME", user);
            }

            throw e;
        }
    }

    async createUser(user, db) {
        try {
            db = db || await mysql.db();
            let newid = genUnique64string({
                datacenter: this.credentials.datacenter.index || 0,
                worker: this.credentials.datacenter.worker || 0
            });
            user.id = { toSqlString: () => newid }
            //user.email = email;

            user.shortid = genFullShortId();
            user.apikey = generateAPIKEY();
            // user.displayname = user.id;

            user.isdev = false;
            user.tsapikey = utcDATETIME();

            let { results } = await db.insert('person', user);
            console.log(results);

            // await this.inviteToGithub(user);

            if (results.affectedRows == 0)
                throw new GeneralError('E_PERSON_CREATEFAILED', user);

            user.id = newid;
            return user;
        }
        catch (e) {
            throw e;
        }
    }


    async inviteToGithub(user) {
        if (!('github' in user) || !user.github) {
            return;
        }

        if (user.isdev)
            return;

        try {
            let orgInviteResult = await gh.orgs.createInvitation({ org: 'acosgames', email: user.email, role: 'direct_member' })
            console.log(orgInviteResult);
        }
        catch (e3) {
            console.error(e3);
        }
    }

    async createGithubUserTeam(user) {
        if (!('github' in user) || !user.github) {
            return;
        }

        let id_5SG = 79618222;
        let org = 'acosgames';
        let name = user.displayname;
        let username = user.github;
        let maintainers = [];
        let privacy = 'closed';

        try {
            //attempt to create the team using acosg username as the team name
            let teamResult = await gh.teams.create({ org, name, maintainers, privacy })
            console.log(teamResult);
            return teamResult;
        }
        catch (e) {
            //team existed, try to add them back, incase they were removed
            console.error(e);
            let team_slug = name.toLowerCase();
            team_slug = team_slug.replace(/[^a-z0-9\_\- \t]/ig, '');
            team_slug = team_slug.replace(/[ \t]/ig, '-');

            try {
                let membershipResult = await gh.teams.addOrUpdateMembershipForUserInOrg({ org, team_slug, username });
                console.log(membershipResult);
            }
            catch (e2) {
                console.error(e2);
            }
        }
        return null;
    }
}