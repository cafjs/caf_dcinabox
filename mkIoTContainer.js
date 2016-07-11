#!/usr/bin/env node
var parseArgs = require('minimist');
var child_process = require('child_process');
var path = require('path');
var MAX_BUFFER = 1024 * 100000;


var usage = function() {
    console.log('Usage: mkIoTContainer.js --appLocalName <string> --privileged <boolean>');
    process.exit(1);
};


var argv = parseArgs(process.argv.slice(2), {
    string : ['appLocalName'],
    boolean : ['privileged'],
    alias: {a : 'appLocalName', p: 'privileged'},
    unknown: usage
});

if (!argv.appLocalName || (typeof argv.privileged !== 'boolean')) {
    usage();
}

var args = [argv.appLocalName, (argv.privileged ? 'privileged' : '')];

console.log('Starting mkIoTContainer.js');

child_process.execFile(path.resolve(__dirname, 'mkIoTContainerImpl.sh'), args,
                       {maxBuffer: MAX_BUFFER},
                       function(err, stdout, stderr) {
                           console.log(stdout);
                           console.log(stderr);
                       });
