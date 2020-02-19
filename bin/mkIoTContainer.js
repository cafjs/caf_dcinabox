#!/usr/bin/env node
'use strict';
const parseArgs = require('minimist');
const child_process = require('child_process');
const path = require('path');
const MAX_BUFFER = 1024 * 100000;


const usage = function() {
    console.log('Usage: mkIoTContainer.js --appLocalName <string> ' +
                '--privileged <boolean>');
    process.exit(1);
};


const argv = parseArgs(process.argv.slice(2), {
    string: ['appLocalName'],
    boolean: ['privileged'],
    alias: {a: 'appLocalName', p: 'privileged'},
    unknown: usage
});

if (!argv.appLocalName || (typeof argv.privileged !== 'boolean')) {
    usage();
}

const args = [argv.appLocalName, (argv.privileged ? 'privileged' : '')];

console.log('Starting mkIoTContainer.js. It can take a few minutes...');

child_process.execFile(path.resolve(__dirname, 'mkIoTContainerImpl.sh'), args,
                       {maxBuffer: MAX_BUFFER},
                       function(err, stdout, stderr) {
                           console.log(stdout);
                           console.log(stderr);
                       });
