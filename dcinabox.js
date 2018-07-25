#!/usr/bin/env node
var daemon = require('./index.js');
var parseArgs = require('minimist');

var XIP_SUFFIX = 'xip.io';

var usage = function() {
    console.log('Usage: dcinabox.js --appLocalName <string> --ipAddress <string> --port <string> --appImage <string> [--appWorkingDir <string>] [--hostVolume <string>] [--appVolume <string>] [--debugApplication <boolean>]' );
    process.exit(1);
};

var argv = parseArgs(process.argv.slice(2), {
    string : ['appImage', 'appLocalName', 'appWorkingDir', 'ipAddress', 'port',
              'hostVolume', 'appVolume'],
    boolean : ['debugApplication'],
    alias: {i: 'appImage', n : 'appLocalName', h : 'appWorkingDir',
            v: 'hostVolume', a: 'appVolume', d: 'debugApplication'},
    unknown: usage
});

var spec = { env : {}};

var addOpt = function(x){
    if (argv[x]) {
        spec.env[x] = argv[x];
    }
};


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
        process.env.ACCOUNTS_URL='http://root-accounts.' +
            spec.env.ipAddress +  '.' + XIP_SUFFIX + ':' + spec.env.port;
        process.env.IOT_DEVICE_MANAGER_APP_URL = 'http://root-gadget.' +
            spec.env.ipAddress +  '.' + XIP_SUFFIX + ':' + spec.env.port;
    } else {
        process.env.ACCOUNTS_URL='http://root-accounts.' +
            spec.env.ipAddress +  '.' + XIP_SUFFIX;
        process.env.IOT_DEVICE_MANAGER_APP_URL = 'http://root-gadget.' +
            spec.env.ipAddress +  '.' + XIP_SUFFIX;
    }
    console.log(' **** USE URL http://root-launcher.'  +
                spec.env.ipAddress +  '.' + XIP_SUFFIX +
                (spec.env.port ?  ':' + spec.env.port : ''));
} else if (spec.env.port) {
    var appSuffix = process.env.APP_SUFFIX || 'vcap.me';
    process.env.HTTP_EXTERNAL_PORT = spec.env.port;
    process.env.CONTAINER_PORT = spec.env.port; // container port === external
    process.env.ACCOUNTS_URL='http://root-accounts.' + appSuffix +
        ':' + spec.env.port;
    process.env.IOT_DEVICE_MANAGER_APP_URL = 'http://root-gadget.' + appSuffix +
        ':' + spec.env.port;
    console.log(' **** USE URL http://root-launcher.'  + appSuffix +
                ':' + spec.env.port);
}


console.log(spec.env);

if (spec.env.debugApplication) {
    process.env.NODE_DEBUG_OPTIONS="--inspect=0.0.0.0:9229";
}

if (spec.env.appLocalName && (spec.env.appImage)) {
    daemon.run([module], null, spec, function(err, top) {
        if (err) {
            console.log('Error: ' + err);
        } else {
            console.log('Starting DC in a box...');
            process.on('SIGINT', function() {
                console.log("Caught interrupt signal");
                top.__ca_graceful_shutdown__(null, function(err) {
                    console.log('shutdown:' + (err ?  err : 'OK'));
                });
            });
        }
    });
} else {
    usage();
}
