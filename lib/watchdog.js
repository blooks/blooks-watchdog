#!/usr/bin/env node
var WebSocketClient = require('websocket').client;
var mongo = require('coyno-mongo');
var client = new WebSocketClient();
var _ = require('underscore');
var Dispatcher = require('coyno-dispatcher');
var Chain = require('coyno-chain');
var log = reqire('coyno-log').child({component: 'watchdog'});

var Watchdog = function () {
};

var storeToMongo = function (transactions, callback) {
    //TODO: IMPLEMENT!
};

var messageToChainTx = function (message) {
    if (message.type === 'utf8') {
        var parsedMessage = JSON.parse(message.utf8Data).payload;
        if (parsedMessage.type === 'new-transaction') {
            return parsedMessage.transaction;
        }
    }
};

var findAffectedUsers = function(chainTx) {
    return function (callback) {
        var inoutputs = chainTx.inputs.concat(chainTx.outputs);
        var addresses = _.map(inoutputs, function (inoutput) {
            if (inoutput.addresses) {
                return inoutput.addresses[0];
            }
        });
        mongo.db.collection('bitcoinaddresses').find({address: {$in: addresses}}).toArray(function (err, result) {
            if (err) {
                return callback(err);
            }
            var userIds = _(result).pluck('userId').uniq().value();
            return callback(null, chainTx, userIds);
        });
    };
};

var createCoynoTransactions = function(chainTx, userIds, callback) {

};

Watchdog.prototype.onConnect = function (connection) {
    var req = {type: "new-transaction", block_chain: "bitcoin"};
    connection.send(JSON.stringify(req));
    console.log('WebSocket Client Connected');
    connection.on('error', function (error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function () {
        console.log('echo-protocol Connection Closed');
    });
    connection.on('message', function (message) {
        var transaction = messageToChainTx(message);
        if (transaction) {
            async.waterfall([
                findAffectedUsers(transaction),
                createCoynoTransactions,
                storeToMongo
            ], function (err) {
                if (err) {
                    return log.error(err);
                }
                log.debug('Sucessfully saved new transaction to the database.')
            });
        }
    });
};

Watchdog.prototype.start = function () {
    this.chain = new Chain();
    mongo.start(function (err) {
        if (err) return console.log(err);
        client.on('connect', this.onConnect.bind(this));
    }.bind(this));
    client.connect('wss://ws.chain.com/v2/notifications', 'echo-protocol');
    client.on('connectFailed', function (error) {
        console.log('Connect Error: ' + error.toString());
    });
};


module.exports = Watchdog;