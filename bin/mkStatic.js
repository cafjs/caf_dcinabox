#!/usr/bin/env node
'use strict';
const parseArgs = require('minimist');
const path = require('path');
const caf_core = require('caf_core');
const caf_comp = caf_core.caf_components;
const myUtils = caf_comp.myUtils;
const staticUtils = require('./staticUtils');
const fs = require('fs');

const usage = function() {
    console.log('Usage: mkStatic.js --rootDir <string>');
    process.exit(1);
};

const argv = parseArgs(process.argv.slice(2), {
    string: ['rootDir'],
    alias: {r: 'rootDir'},
    unknown: usage
});

if (!argv.rootDir) {
    usage();
}

/* MK_STATIC env variable can change the behavior of plugins
 when, e.g., they cannot access devices within a container directly*/
process.env['MK_STATIC'] = 'true';


console.log('Starting mkStatic.js');

// main is typically caf_iot
const main = require(argv.rootDir).framework;
main.setInitCallback(function(err, $) {
    if (err) {
        // eslint-disable-next-line
        console.log('Got error ' + myUtils.errToPrettyStr(err));
        process.exit(1);
    } else {
        const allModules = $._.$.loader.__ca_getModuleIndex__();
        const resolved = staticUtils.resolveModules(argv.rootDir, allModules);
        let out = 'module.exports = {\n';
        const len = Object.keys(resolved).length;
        Object.keys(resolved).forEach(function(x, i) {
            out += (i < len -1) ?
                "  '" + x + "': require('" + resolved[x] + "'),\n" :
                "  '" + x + "': require('" + resolved[x] + "')\n";
        });
        out += '};';
        fs.writeFile(path.resolve(argv.rootDir, 'staticArtifacts.js'), out,
                     function(err) {
                         if (err) {
                             console.log('Error: ' +
                                         myUtils.errToPrettyStr(err));
                             process.exit(1);
                         } else {
                             console.log('OK');
                             process.exit(0);
                         }
                     });
    }
});
