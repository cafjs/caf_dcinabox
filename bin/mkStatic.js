#!/usr/bin/env node
var parseArgs = require('minimist');
var path = require('path');
var caf_core =  require('caf_core');
var caf_comp = caf_core.caf_components;
var myUtils = caf_comp.myUtils;
var staticUtils = require('./staticUtils');
var fs = require('fs');

var usage = function() {
    console.log('Usage: mkStatic.js --rootDir <string>');
    process.exit(1);
};

var argv = parseArgs(process.argv.slice(2), {
    string : ['rootDir'],
    alias: {r : 'rootDir'},
    unknown: usage
});

if (!argv.rootDir) {
    usage();
}

console.log('Starting mkStatic.js');

// main is typically caf_iot
var main = require(argv.rootDir).framework;
main.setInitCallback(function(err, $) {
    if (err) {
        // eslint-disable-next-line
        console.log('Got error ' + myUtils.errToPrettyStr(err));
        process.exit(1);
    } else {
        var allModules = $._.$.loader.__ca_getModuleIndex__();
        var resolved = staticUtils.resolveModules(argv.rootDir, allModules);
        var out = 'module.exports = {\n';
        var len = Object.keys(resolved).length;
        Object.keys(resolved).forEach(function(x, i) {
            out += ((i < len -1) ?
                    "  '" + x + "': require('" + resolved[x] + "'),\n" :
                    "  '" + x + "': require('" + resolved[x] + "')\n");
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
