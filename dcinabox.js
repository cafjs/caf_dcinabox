#!/usr/bin/env node
var daemon = require('./index.js');
var parseArgs = require('minimist');

var usage = function() {
    console.log('Usage: dcinabox.js --appLocalName <string> --appImage <string>');
    process.exit(1);
};

var argv = parseArgs(process.argv.slice(2), {
    string : ['appImage', 'appLocalName'],
    alias: {i: 'appImage', n : 'appLocalName'},
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
