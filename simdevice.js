#!/usr/bin/env node
var daemon = require('./index.js');
var parseArgs = require('minimist');

var DEFAULT_DEVICE_ID='foo-device1';
var DEFAULT_PASSWORD='pleasechange';
var DEFAULT_ROOT_DIR='/tmp';

var usage = function() {
    console.log('Usage: simdevice.js --deviceId <string, e.g., foo-device1> --password <string> --rootDir <string>');
    process.exit(1);
};

var argv = parseArgs(process.argv.slice(2), {
    string : ['deviceId', 'password', 'rootDir'],
    alias: {d : 'deviceId', p: 'password', r : 'rootDir'},
    unknown: usage
});

var spec = { env : {}};

var addOpt = function(x, defaultValue) {
    if (argv[x]) {
        spec.env[x] = argv[x];
    } else {
        spec.env[x] = defaultValue;
    }
};


addOpt('deviceId', DEFAULT_DEVICE_ID);
addOpt('password', DEFAULT_PASSWORD);
addOpt('rootDir', DEFAULT_ROOT_DIR);

spec.env.configVolume = spec.env.rootDir + '/' + spec.env.deviceId +
    '/config';


daemon.run([module], 'simDevice.json', spec, function(err, top) {
    if (err) {
        console.log('Error: ' + err);
    } else {
        console.log('Starting simulated device...');
        process.on('SIGINT', function() {
            console.log("Caught interrupt signal");
            top.__ca_graceful_shutdown__(null, function(err) {
                console.log('shutdown:' + (err ?  err : 'OK'));
            });
        });
    }
});
