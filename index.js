#!/usr/bin/env node
var WebSocketClient = require('websocket').client;
var mongo = require('coyno-mongo');
var client = new WebSocketClient();
var _ = require('underscore');
var Dispatcher = require('coyno-dispatcher');



var Watchdog = function () {
};

Watchdog.prototype.start = function (callback) {
    mongo.start(function(err) {
        if (err) return console.log(err);
        client.on('connect', function(connection) {
            var req = {type: "new-transaction", block_chain: "bitcoin"};
            connection.send(JSON.stringify(req));
            console.log('WebSocket Client Connected');
            connection.on('error', function(error) {
                console.log("Connection Error: " + error.toString());
            });
            connection.on('close', function() {
                console.log('echo-protocol Connection Closed');
            });
            connection.on('message', function(message) {
                if (message.type === 'utf8') {
                    parsedMessage = JSON.parse(message.utf8Data).payload;
                    if (parsedMessage.type === 'new-transaction') {
                        var transaction = parsedMessage.transaction;
                        var inoutputs = transaction.inputs.concat(transaction.outputs);
                        var addresses = _.map(inoutputs, function (inoutput) {
                            if (inoutput.addresses) {
                                return inoutput.addresses[0];
                            }
                        });
                        //console.log(addresses);
                        //console.log("Transaction");
                        mongo.db.collection('bitcoinaddresses').find({address: { $in : addresses}}).toArray(function(err, result) {
                            if (err) return console.log(err);
                            else {
                                if (result.length) {
                                    var walletIds = _.map(result, function(address) {
                                        return address.walletId;
                                    });
                                    mongo.db.collection('bitcoinwallets').find({_id: {$in : walletIds}}).toArray(function(err, result) {
                                        if (err) return console.log(err);
                                        if (result.length) {
                                            result.forEach(function(wallet) {
                                                console.log("Updating Wallet:" + wallet.label);
                                                Dispatcher.wallet.update({walletId: wallet._id, userId: wallet.userId});
                                            });
                                        } else {
                                            console.log("Address matching, but no wallet found!");
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            });
        });
    });

    client.connect('wss://ws.chain.com/v2/notifications', 'echo-protocol');
    callback(null, "Watchdog started.");
};

client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
});


module.exports = Watchdog;