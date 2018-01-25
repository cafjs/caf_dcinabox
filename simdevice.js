#!/usr/bin/env node
var daemon = require('./index.js');
var parseArgs = require('minimist');

var DEFAULT_DEVICE_ID='foo-device1';
var DEFAULT_PASSWORD='pleasechange';
var DEFAULT_ROOT_DIR='/tmp';
var DEFAULT_APP_SUFFIX='vcap.me';

var XIP_SUFFIX='xip.io';

var usage = function() {
    console.log('Usage: simdevice.js --deviceId <string, e.g., foo-device1> --password <string> --rootDir <string> [--ipAddress <string>] [--port <string>] [--appSuffix <string>]');
    process.exit(1);
};

var argv = parseArgs(process.argv.slice(2), {
    string : ['deviceId', 'password', 'rootDir', 'appSuffix', 'ipAddress',
              'port'],
    alias: {d : 'deviceId', p: 'password', r : 'rootDir', a : 'appSuffix'},
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
addOpt('appSuffix', DEFAULT_APP_SUFFIX);
addOpt('ipAddress');
addOpt('port');

var isXip = function(x) {
    return x.split(':')[0].endsWith(XIP_SUFFIX);
};

if (typeof spec.env.ipAddress === 'string') {
    spec.env.appSuffix =  spec.env.ipAddress +  '.' + XIP_SUFFIX +
        (spec.env.port ?  ':' + spec.env.port : '');
}

if ((spec.env.appSuffix !== DEFAULT_APP_SUFFIX) && !isXip(spec.env.appSuffix)) {
    spec.env.appProtocol = 'https';
    spec.env.accountsURL = 'https://root-accounts.' + spec.env.appSuffix;
};

if (isXip(spec.env.appSuffix)) {
    spec.env.appProtocol = 'http';
    spec.env.accountsURL = 'http://root-accounts.' + spec.env.appSuffix;
}

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
