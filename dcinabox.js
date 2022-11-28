#!/usr/bin/env node
'use strict';
const daemon = require('./index.js');
const parseArgs = require('minimist');

const XIP_SUFFIX =  process.env.XIP_SUFFIX ||'xip.io';

const usage = function() {
    const msg =
          'Usage: dcinabox.js --envProp <string> --appLocalName <string>' +
          ' --ipAddress <string> --port <string> --appImage ' +
          '<string> [--appWorkingDir <string>] [--hostVolume <string>] ' +
          '[--appVolume <string>] [--debugApplication <boolean>]';
    console.log(msg);
    process.exit(1);
};

const argv = parseArgs(process.argv.slice(2), {
    string: ['appImage', 'appLocalName', 'appWorkingDir', 'ipAddress', 'port',
             'hostVolume', 'appVolume', 'envProp'],
    boolean: ['debugApplication'],
    alias: {i: 'appImage', n: 'appLocalName', h: 'appWorkingDir',
            v: 'hostVolume', a: 'appVolume', d: 'debugApplication'},
    unknown: usage
});

const spec = { env: {}};

const addOpt = function(x){
    if (argv[x]) {
        spec.env[x] = argv[x];
    }
};

addOpt('envProp');
addOpt('appImage');
addOpt('appLocalName');
addOpt('appWorkingDir');
addOpt('hostVolume');
addOpt('appVolume');
addOpt('ipAddress');
addOpt('port');
addOpt('debugApplication'); // default is 'false', so noop is ok...

if (typeof spec.env.ipAddress === 'string') {
    //using an externally visible address
    process.env.APP_SUFFIX = spec.env.ipAddress + '.' + XIP_SUFFIX;
    process.env.HOST_IP=spec.env.ipAddress;
    if (spec.env.port) {
        process.env.HTTP_EXTERNAL_PORT = spec.env.port;
        process.env.HTTP_INTERNAL_PORT = spec.env.port;
        process.env.ACCOUNTS_URL='http://root-accounts.' +
            spec.env.ipAddress + '.' + XIP_SUFFIX + ':' + spec.env.port;
        process.env.IOT_DEVICE_MANAGER_APP_URL = 'http://root-gadget.' +
            spec.env.ipAddress + '.' + XIP_SUFFIX + ':' + spec.env.port;
    } else {
        process.env.HTTP_INTERNAL_PORT = null; //using default port, i.e., 80
        process.env.ACCOUNTS_URL='http://root-accounts.' +
            spec.env.ipAddress + '.' + XIP_SUFFIX;
        process.env.IOT_DEVICE_MANAGER_APP_URL = 'http://root-gadget.' +
            spec.env.ipAddress + '.' + XIP_SUFFIX;
    }
    console.log(' **** USE URL http://root-launcher.' +
                spec.env.ipAddress + '.' + XIP_SUFFIX +
                (spec.env.port ? ':' + spec.env.port : ''));
} else if (spec.env.port) {
    const appSuffix = process.env.APP_SUFFIX || 'localtest.me';
    process.env.HTTP_EXTERNAL_PORT = spec.env.port;
    process.env.HTTP_INTERNAL_PORT = spec.env.port;
    process.env.CONTAINER_PORT = spec.env.port; // container port === external
    process.env.ACCOUNTS_URL='http://root-accounts.' + appSuffix +
        ':' + spec.env.port;
    process.env.IOT_DEVICE_MANAGER_APP_URL = 'http://root-gadget.' + appSuffix +
        ':' + spec.env.port;
    console.log(' **** USE URL http://root-launcher.' + appSuffix +
                ':' + spec.env.port);
}


console.log(spec.env);

if (spec.env.debugApplication) {
    process.env.NODE_DEBUG_OPTIONS='--inspect=0.0.0.0:9229';
    process.env.LOG_LEVEL='DEBUG';
    process.env.COMPRESS_STATE=false;
}

if (spec.env.appLocalName && (spec.env.appImage)) {
    daemon.run([module], null, spec, function(err, top) {
        if (err) {
            console.log('Error: ' + err);
        } else {
            console.log('Starting DC in a box...');
            process.on('SIGINT', function() {
                console.log('Caught interrupt signal');
                top.__ca_graceful_shutdown__(null, function(err) {
                    console.log('shutdown:' + (err ? err : 'OK'));
                });
            });
        }
    });
} else {
    usage();
}
