#!/usr/bin/env node
var parseArgs = require('minimist');
var caf_core =  require('caf_core');
var caf_comp = caf_core.caf_components;
var myUtils = caf_comp.myUtils;
var caf_cli = caf_core.caf_cli;
var srpClient = require('caf_srp').client;

var ACCOUNTS_URL = 'https://root-accounts.cafjs.com';

var usage = function() {
    console.log('Usage: deploy.js --url <string> --caName <string>  --password <string> --containerName <string> --op <restart>');
    process.exit(1);
};

var argv = parseArgs(process.argv.slice(2), {
    string : ['url', 'caName', 'password',  'containerName', 'op'],
    alias: {u : 'url', c: 'caName', p: 'password', co: 'containerName',
            o : 'op'},
    unknown: usage
});

if (!argv.url || !argv.caName || !argv.containerName  || !argv.op ) {
    usage();
}
var specAll = {
    log: function(x) {
        console.log(x);
    },
    securityClient: srpClient,
    accountsURL: ACCOUNTS_URL,
    password: argv.password,
    from: argv.caName,
    unrestrictedToken: false
};


var s = new caf_cli.Session(argv.url, argv.caName, specAll);

s.onopen = function() {
    if (argv.op === 'restart') {
        // see caf_turtles/lib/ca_methods.js
        s.restartApp(argv.containerName, function(err, data) {
            if (err) {
                console.log(myUtils.errToPrettyStr(err));
            } else {
                console.log(JSON.stringify(data));
            }
            s.close();
        });
    } else {
        usage();
    }
};

s.onclose = function(err) {
    if (err) {
        console.log(myUtils.errToPrettyStr(err));
        process.exit(1);
    }
};
