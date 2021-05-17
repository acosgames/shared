const rabbitmq = require("amqplib");
const { promisify } = require("util");
const { GeneralError } = require("../util/errorhandler");

const { generateAPIKEY } = require('../util/idgen');

const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
const maxNacks = 10;

class RabbitMQService {
    constructor(credentials) {
        this.credentials = credentials || {
            host: "127.0.0.1",
            port: 6379,
        };

        this.callbacks = {};
    }

    async connect(credentials) {


        if (credentials) {
            this.credentials = credentials;
        }
        try {
            this.publisher = await rabbitmq.connect(this.credentials.host);
            this.out = await this.publisher.createChannel();

            this.subscriber = await rabbitmq.connect(this.credentials.host);
            this.subscriber.on('error', (err) => {
                console.error(err);

            })
            this.in = await this.subscriber.createChannel();

            this.queueTester = await this.subscriber.createChannel();
        }
        catch (e) {
            console.error(e);
        }
    }

    async subscribe(exchange, pattern, callback) {
        this.callbacks[pattern + '-' + exchange] = callback || null;

        try {
            if (!this.subscriber) {
                this.subscriber = await rabbitmq.connect(this.credentials.host);
                this.in = await this.subscriber.createChannel();
            }

            let queue = generateAPIKEY();

            let queueCreated = await this.in.assertQueue(queue, { autoDelete: true });
            if (!queueCreated)
                return false;

            let exchangeCreated = await this.in.assertExchange(exchange, 'direct', { autoDelete: true });
            if (!exchangeCreated) {
                return false;
            }

            let bindCreated = await this.in.bindQueue(queue, exchange, pattern);

            await this.in.consume(queue, (msg) => {
                let msgStr = msg.content.toString().trim();
                let msgJSON;
                if (msgStr[0] == '{' || msgStr[0] == '[') {
                    msgJSON = JSON.parse(msgStr);
                    if (!callback(msgJSON)) {
                        this.nackMsg(msg);
                    }
                    else {
                        this.ackMsg(msg);
                    }
                }
                else {
                    if (!callback(msg.content)) {
                        this.nackMsg(msg);
                    }
                    else {
                        this.ackMsg(msg);
                    }
                }
            });

            return true;
        }
        catch (e) {
            console.error(e);
        }

        return false;
    }

    nackMsg(msg) {
        setTimeout(async () => {
            let count = cache.get(msg.fields.consumerTag) || 0;
            this.in.nack(msg, false, (count < maxNacks));
            cache.set(msg.fields.consumerTag, count + 1);
        }, 200)
    }

    ackMsg(msg) {
        let count = cache.get(msg.fields.consumerTag) || 0;
        if (count > 0)
            this.in.ack(msg, false);
        cache.del(msg.fields.consumerTag);
    }

    async checkQueue(queue) {
        const self = this;
        return new Promise(async (rs, rj) => {

            try {
                let queueCreated = await self.in.assertQueue(queue, { autoDelete: true });
                if (queueCreated.consumerCount <= 0) {
                    rs(false);
                    return;
                }


                rs(queueCreated.consumerCount);
                // let exists = self.queueTester.assertQueue(queue, (err, ok) => {
                //     if (err) {
                //         console.error(err);
                //         rj(new GeneralError('E_GAME_NOT_SETUP', err));
                //         return;
                //     }


                //     console.log(ok);
                //     rs(ok);
                // });
            }
            catch (e) {
                // self.queueTester = await self.subscriber.createChannel();

                console.error(e);
                rj(false);
            }

        });
    }

    async subscribeQueue(queue, callback) {
        const self = this;
        this.callbacks[queue] = callback || null;
        return new Promise(async (rs, rj) => {

            try {
                if (!self.subscriber) {
                    self.subscriber = await rabbitmq.connect(this.credentials.host);
                    self.in = await self.subscriber.createChannel();
                }

                let queueCreated = await self.in.assertQueue(queue, { autoDelete: true });
                if (queueCreated) {
                    await self.in.consume(queue, (msg) => {
                        let msgStr = msg.content.toString().trim();
                        let msgJSON;
                        if (msgStr[0] == '{' || msgStr[0] == '[') {
                            msgJSON = JSON.parse(msgStr);
                            if (!callback(msgJSON)) {
                                this.nackMsg(msg);
                            }
                            else {
                                this.ackMsg(msg);
                            }
                        }
                        else {
                            if (!callback(msg.content)) {
                                this.nackMsg(msg);
                            }
                            else {
                                this.ackMsg(msg);
                            }
                        }
                    });
                }
                rs(queueCreated);
            }
            catch (e) {
                rj(e);
            }

        });
    }

    async publish(exchange, pattern, value) {
        try {
            if (!this.publisher) {
                this.publisher = await rabbitmq.connect(this.credentials.host);
                this.out = await this.publisher.createChannel();
            }

            if (typeof value === 'object') {
                value = JSON.stringify(value);

                return this.out.publish(exchange, pattern, Buffer.from(value));
            }
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDIS_PUBLISH', { exchange, value });
        }

        return false;
    }

    async publishQueue(queue, value) {
        try {
            if (!this.publisher) {
                this.publisher = await rabbitmq.connect(this.credentials.host);
                this.out = await this.publisher.createChannel();
            }

            this.out
            let queueCreated = await this.out.assertQueue(queue, { autoDelete: true });
            if (queueCreated) {
                if (typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                return this.out.sendToQueue(queue, Buffer.from(value));
            }
        }
        catch (e) {
            console.error(e);
            throw new GeneralError('ERROR_REDIS_PUBLISH', { queue, value });
        }

        return false;
    }

    // async onMessage(channel, value, extra) {
    //     console.log(channel, value, extra);

    //     if (this.callbacks[channel]) {
    //         this.callbacks[channel](channel, value, extra);
    //     }
    // }
    // async onError(error) {
    //     console.error("onError", error);
    // }
    // async onConnect(data) {
    //     console.log("onConnect", data);
    // }
    // async onReady(data) {
    //     console.log("onReady", data);
    // }
    // async onEnd(data) {
    //     console.log("onEnd", data);
    // }



}


async function test() {

    let r = new RabbitMQService();
    let r2 = new RabbitMQService();

    await r.connect({ host: "amqp://fsg:haha123hehe@localhost:5672" })
    await r2.connect({ host: "amqp://fsg:haha123hehe@localhost:5672" })

    console.log("Connected to RabbitMQ");

    // await r.subscribeQueue('gameserver-dal', (msg) => {
    //     console.log("gameserver-dal-1 received MSG: ", msg);
    // })

    // await r2.subscribeQueue('gameserver-dal', (msg) => {
    //     console.log("gameserver-dal-2 received MSG: ", msg);
    // })
    let cnt = 0;
    await r.subscribe('gameserver', 'tictactoe', (msg) => {
        console.log("gameserver-1 receiving msg");
        if (cnt++ == 0) {
            console.log("gameserver-1 nack msg");
            return false;
        }

        console.log("gameserver-1 received msg", msg);

        return true;
    })

    // await r2.subscribe('gameserver', 'texasholdem', (msg) => {
    //     console.log("gameserver-2 Received MSG: ", msg);
    // })

    console.log("Subscribed to hello");

    //for (var i = 0; i < 3; i++) 
    {
        let result = await r.publish('gameserver', 'tictactoe', { "user": "joe", "chatmsg": "hahah what was that", index: 0 });

        // let result2 = await r.publish('gameserver', 'texasholdem', { "user": "joe", "chatmsg": "hahah what was that", index: i + 10 });
        // console.log("Result = ", result);
        // let result2 = await r.publishQueue('gameserver-dal', { "user": "joe", "chatmsg": "hahah what was that", index: i });
        // console.log("Result = ", result);
    }
    console.log("done");
}

// test();

module.exports = new RabbitMQService();