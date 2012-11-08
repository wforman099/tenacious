/**
 * User: wadeforman
 * Date: 11/7/12
 * Time: 2:01 PM
 */

"use strict"

var Tenacious = require('../../tenacioushttp');
var http = require('http');
var Q = require('q');

exports['create'] = {
    'success' : function(test) {
        var header = {test:'123'};
        var p = Tenacious.create('host',80, header);
        test.equal(p.host, 'host');
        test.equal(p.port, 80);
        test.deepEqual(p.header,{test:'123'});
        test.done();
    },

    'requires host as a parameter' : function(test) {
        test.throws(
            function(){
                Tenacious.create();
            }, Error);
        test.done();
    },

    'requires port as a parameter' : function(test) {
        test.throws(
            function(){
                Tenacious.create('host');
            }, Error);
        test.done();
    }
}

exports['start'] = {
    setUp : function(cb) {
        this.headers = {
            'User-Agent'        : 'agent',
            'Host'              : 'http://localhost/',
            'Connection'        : 'Keep-Alive',
            'Transfer-Encoding' : 'chunked',
            'Authorization'     : 'abc123:123'
        };
        cb();
    },

    tearDown : function(cb) {
        Tenacious.SOCKET_TIMEOUT = 60000;
        cb();
    },

    'success' : function(test) {
        var server = http.createServer(function (req, res) {
            req.setEncoding('utf-8');
            req.on('data', function(chunk) {
                test.equal(chunk, 'written value1');
                res.write('response');
                res.end();
            });
        }).listen(1333, '127.0.0.1');

        test.expect(5);

        var p = Tenacious.create('http://localhost/',1333, this.headers);
        p.recover = function (){
            return Q.resolve();
        };

        p.on('data', function(chunk, statusCode){
            test.equal(chunk, 'response');
            test.equal(statusCode, 200);
        });

        p.on('end', function(statusCode){
            test.equal(statusCode, 200);
        });

        p.start().then(
            function(r) {
                test.ok(true);
                server.close();
                test.done();
            }, function (err) {
                server.close();
                test.done();
            }
        ).done();

        p.write('written value1');
    },

    'handles non-200 status codes' : function(test) {
        test.expect(2);
        var server = http.createServer(function (req, res) {
            req.setEncoding('utf-8');
            req.on('data', function(chunk) {
                test.equal(chunk, 'written value1');
                res.writeHead(401);
                res.write('this is not found');
                res.end();
            });
        }).listen(1333, '127.0.0.1');

        var p = Tenacious.create('http://localhost/',1333, this.headers);
        p.recover = function (){
            return Q.resolve();
        };

        p.start().then( //connects to the remote server.  returns a promise
            function(r) {
                server.close();
                test.ok(false);
                test.done();
            }, function (err) {
                server.close();
                test.ok(true);
                test.done();
            }
        ).done();

        p.write('written value1');
    },

    'will reject on socket timeout' : function (test) {

        var p = Tenacious.create('http://localhost/',1333,this.headers);
        Tenacious.SOCKET_TIMEOUT = 1;
        test.expect(1);
        p.recover = function (){
            return Q.resolve();
        };
        p.start().then(
            function () {
                test.ok(false);
                test.done();
            }, function (err) {
                test.ok(true);
                test.done();
            }).done();
    },

    'will emit a disconnected event on socket timeout' : function (test) {
        var server = http.createServer(function (req, res) {
            req.setEncoding('utf-8');
            req.on('data', function(chunk) {
                test.equal(chunk, 'written value1');
                res.write('this is not found');
            });
        }).listen(1333, '127.0.0.1');
        Tenacious.SOCKET_TIMEOUT = 100;
        var p = Tenacious.create('http://localhost/',1333, this.headers);

        p.recover = function (){
            return Q.resolve();
        };

        p.on('timeout', function(){
            test.ok(true);
            server.close();
            test.done();
        });

        p.start().then(
            function(r) {
                test.ok(true);
            }, function(err) {
                test.ok(false);
                server.close();
                test.done();
            }
        ).done();
        p.write('written value1');
    },

    'rejects when end point refuses the connection' : function (test) {
        test.expect(1);
        var p = Tenacious.create('http://localhost/',1333, this.headers);
        p.recover = function (){
            return Q.resolve();
        };
        p.start().then(function(){
            test.ok(false);
            test.done();
        }, function (err)  {
            test.ok(true);
            test.done();
        }).done();
    },

    'will resolve if there is already a request' : function(test) {
        var p = Tenacious.create('http://localhost/',1333, this.headers);
        //p.request = {};
        p.isWritable = function() {
            return true;
        }
        test.expect(1);

        p.start().then(
            function() {
                test.ok(true);
                test.done();
            }
        ).done();
    }
}

exports['stop'] = {
    'success' : function(test) {
        var p = Tenacious.create('http://127.0.0.1/',1333);
        p.connectionState = 'connected';
        p.request = {};
        p.request.end = function(contents) {
            test.ok(true);
        };
        test.expect(2);
        p.stop().then(
            function() {
                test.ok(true);
                test.done();
            }, function(err){
                test.ok(false);
                test.done();
            }
        ).done();
    },
    'still end connection with message' : function(test) {
        var p = Tenacious.create('http://127.0.0.1/',1333);
        p.request = {};
        p.connectionState = 'connected';
        p.request.end = function(contents) {
            test.equal(contents, 'ending message');
        };
        test.expect(2);
        p.stop('ending message').then(
            function() {
                test.ok(true);
                test.done();
            }, function(err){
                test.ok(false);
                test.done();
            }
        ).done();
    },

    'will reject if there is no connect to stop' : function(test) {
        var p = Tenacious.create('http://127.0.0.1/',1333);
        test.expect(1);
        p.stop('ending message').then(
            function() {
                test.ok(false);
                test.done();
            }, function(err){
                test.ok(true);
                test.done();
            }
        ).done();
    }
}

exports['write'] = {
    'success' : function(test) {
        var p = Tenacious.create('http://127.0.0.1/',1333);
        p.request = {};
        p.isWritable = function(){
            return true;
        };
        p.request.write = function(contents) {
            test.equal(contents, 'test');
        };
        test.expect(1);
        p.write('test');
        test.done();
    }
}

exports['reconnect'] = {
    'success' : function(test){
        var p = Tenacious.create('http://127.0.0.1/',1333);
        p._calculateReconnectDelay = function() {
            test.ok(true);
            return 0;
        };

        p.start = function () {
            test.ok(true);
            return Q.resolve({});
        };

        test.expect(3);

        p._reconnect().then(
            function(r){
                //test.notEqual(r, undefined);
                test.ok(true);
                test.done();
            }, function(err) {
                test.ok(false);
                test.done();
            }
        ).done();
    }
}

exports['recover'] = {
    'success' : function(test) {
        //calls reconnect and returns a promise
        var p = Tenacious.create('http://127.0.0.1/',1333);

        p._reconnect = function(d) {
            return d.resolve({});
        };

        p.recover().then(
            function(r){
                test.done();
            }, function(err) {
                test.ok(false);
                test.done();
            }
        ).done();
    },

    'will attempt to recover again if it fails to reconnect' : function(test) {
        var p = Tenacious.create('http://127.0.0.1/',1333);
        test.expect(10);
        p.start = function () {
            test.ok(true);
            return Q.reject();
        };

        p._calculateReconnectDelay = function () {
            test.ok(true);
            ++p.reconnectAttempts;
            if(p.reconnectAttempts >= 5) {
                p.start = function() {
                    test.ok(true);
                    return Q.resolve({});
                };
            }

            return 0;
        };

        p.recover().then(
            function(r) {
                test.done();
            }, function(err) {
                test.ok(false);
                test.done();
            }
        ).done();
    },

    'will reject if already attempting to reconnect' : function(test) {
        var p = Tenacious.create('http://127.0.0.1/',1333);
        p.reconnectAttempts = 1;
        test.expect(1);

        p.recover().then(
            function() {
                test.ok(false);
                test.done();
            }, function(err) {
                test.ok(true);
                test.done();
            }
        ).done();
    },

    'will reject if there is a pending stop' : function(test) {
        var p = Tenacious.create('http://127.0.0.1/',1333);
        p.pendingStop = true;

        p.recover().then(
            function(){
                test.ok(false);
                test.done();
            }, function(err) {
                test.ok(true);
                test.done();
            }
        ).done();
    }
}

exports['calculateReconnectionDelay'] = {
    'will calculate reconnect timer' : function(test) {
        var p = Tenacious.create('http://127.0.0.1/',1333);

        test.equal(p._calculateReconnectDelay(), 0);
        test.equal(p.reconnectAttempts, 1);

        test.equal(p._calculateReconnectDelay(), 10000);
        test.equal(p.reconnectAttempts, 2);

        p.reconnectAttempts = 3
        test.equal(p._calculateReconnectDelay(), 40000);

        p.reconnectAttempts = 1000;
        test.equal(p._calculateReconnectDelay(), 320000);

        test.done();
    }
}

exports['isStarted'] = {
    'returns true if start has already resolved' : function(test) {
        var p = Tenacious.create('http://127.0.0.1/',1333);
        test.equal(p.isWritable(), false);
        test.done();
    },

    'return false if start has not already been called' : function(test) {
        var p = Tenacious.create('http://127.0.0.1/',1333);
        p.connectionState = 'connected';
        test.equal(p.isWritable(), true);
        test.done();
    }
}
