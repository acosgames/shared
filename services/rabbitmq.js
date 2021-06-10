const rabbitmq = require("amqplib");
const { promisify } = require("util");
const { GeneralError } = require("../util/errorhandler");

const { generateAPIKEY } = require('../util/idgen');

const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
const maxNacks = 10;

const credutil = require('../util/credentials')

const ServerRemoteService = require('./instanceremote');
const remote = new ServerRemoteService();

class RabbitMQService {
    constructor(credentials) {
        this.credentials = credentials || credutil();
        this.options = null;
        this.callbacks = {};

        this.inChannel = { exchanges: {}, queues: {} };

        this.active = false;

        this.retry();

    }

    isActive() {
        return this.active;
    }

    retry(options) {
        setTimeout(() => { this.getMQServers(options) }, this.credentials.platform.retryTime);
    }

    async getMQServers(options) {

        try {
            if (options) {
                this.connect(options);
                return;
            }

            let servers = await remote.findServersByType(0, 5);
            if (!servers) {
                retry(options);
                return;
            }
            // let clusters = this.server.clusters;
            //choose a random Redis server within our zone
            // let redises = servers.filter(v => v.instance_type == 2);
            let server = servers[Math.floor(Math.random() * servers.length)];
            let pubAddr = server.public_addr;
            let privAddr = server.private_addr;
            let parts = pubAddr.split(":");
            let host = parts[0];
            let port = parts[1];

            host = "amqp://" + this.credentials.platform.mqCluster.user + ":" + this.credentials.platform.mqCluster.pass + "@" + host + ":" + port;
            options = {
                host
            }

            this.connect(options);
        }
        catch (e) {
            retry(options);
        }

    }

    async connect(options) {

        try {
            this.publisher = await rabbitmq.connect(options.host);
            this.out = await this.publisher.createChannel();

            this.subscriber = await rabbitmq.connect(options.host);
            this.in = await this.subscriber.createChannel();

            this.active = true;

            this.subscriber.on('error', (err) => {
                this.active = false;
                console.error("[AMQP] ERROR: ", err);
            })

            this.subscriber.on('close', () => {
                this.active = false;
                setTimeout(this.reconnectSubscriberChannels.bind(this), 500);
            })

            this.options = options;

            // this.queueTester = await this.subscriber.createChannel();
        }
        catch (e) {
            console.error(e);
            throw e;
        }
    }

    async reconnectSubscriberChannels() {
        console.error("[AMQP] reconnecting");
        this.subscriber = await rabbitmq.connect(this.options);
        this.in = await this.subscriber.createChannel();
        this.active = true;

        for (var name in this.inChannel.exchanges) {
            let exchange = this.inChannel.exchanges[name];
            this.subscribe(name, exchange.pattern, exchange.callback);
        }

        for (var name in this.inChannel.queues) {
            let callback = this.inChannel.queues[name];
            this.subscribeQueue(name, callback);
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

            console.log("[AMQP] Subscribed to exchange: ", exchange, pattern);
            this.inChannel.exchanges[exchange] = { pattern, callback };

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
            }, {
                noAck: true,
            });

            return true;
        }
        catch (e) {
            console.error(e);
        }

        return false;
    }

    nackMsg(msg) {
        // setTimeout(async () => {
        //     let count = cache.get(msg.fields.consumerTag) || 0;
        //     this.in.nack(msg, false, (count < maxNacks));
        //     cache.set(msg.fields.consumerTag, count + 1);
        // }, 200)
    }

    ackMsg(msg) {
        //let count = cache.get(msg.fields.consumerTag) || 0;
        //if (count > 0)
        // this.in.ack(msg, false);
        // cache.del(msg.fields.consumerTag);
    }

    async assertQueue(queue, ttl) {
        ttl = ttl || 10;
        const self = this;
        return new Promise(async (rs, rj) => {
            try {
                let count = cache.get(queue) || -1;
                if (count > 0) {
                    rs(count);
                    return;
                }
                let queueCreated = await self.in.assertQueue(queue, { autoDelete: true });
                cache.set(queue, queueCreated.consumerCount, ttl);
                console.log('Consumer count: ', queueCreated.consumerCount)
                rs(queueCreated.consumerCount);
            }
            catch (e) {
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

                    this.inChannel.queues[queue] = callback;
                    console.log("[AMQP] Subscribed to queue: ", queue);

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
                    }, {
                        noAck: true,
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

                return this.out.publish(exchange, pattern, Buffer.from(value), { persistent: false });
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

            // this.out
            let queueCreated = await this.out.assertQueue(queue, { autoDelete: true });
            if (queueCreated) {
                if (typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                return this.out.sendToQueue(queue, Buffer.from(value), { persistent: false });
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

    //for   (var i = 0; i < 3; i++) 
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