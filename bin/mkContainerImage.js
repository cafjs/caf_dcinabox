#!/usr/bin/env node
'use strict';
const parseArgs = require('minimist');
const Docker = require('dockerode');
const caf_core = require('caf_core');
const caf_comp = caf_core.caf_components;
const fs = require('fs');
const myUtils = caf_comp.myUtils;

const usage = function() {
    console.log('Usage: mkContainerImage.js --src <string: tar file name> ' +
                '--image <string>');
    process.exit(1);
};

const argv = parseArgs(process.argv.slice(2), {
    string: ['src', 'image'],
    boolean: ['standalone'], // ignored
    alias: {s: 'src', i: 'image'},
    unknown: usage
});

if (!argv.src || !argv.image) {
    usage();
}

const callJustOnce = function(cb) {
    return myUtils.callJustOnce(function(err, data) {
        console.log('Ignore Call >1: err:' + myUtils.errToPrettyStr(err) +
                    ' data:' + JSON.stringify(data));
    }, cb);
};

const buildImage = function(src, image, cb) {
    const docker = new Docker({socketPath: '/var/run/docker.sock'});
    console.log('Building image ' + image);
    const cb0 = callJustOnce(cb);
    docker.buildImage(
        // 'host' network  to enable mkStatic with BLE
        src, {t: image, networkmode: 'host'}, function(err, stream) {
            if (err) {
                cb0(err);
            } else {
                const onFinished = function(err, output) {
                    if (err) {
                        if (typeof err === 'object') {
                            err.output = output;
                            cb0(err);
                        } else {
                            const newErr = new Error('buildImage Error:' +
                                                     err);
                            newErr.output = output;
                            newErr.original = err;
                            cb0(newErr);
                        }
                    } else {
                        //                    console.log(output);
                        cb0(null);
                    }
                };
                const onProgress = function(event) {
                    console.log(event && event.stream);
                };
                docker.modem.followProgress(stream, onFinished, onProgress);
            }
        }
    );
};


if (fs.statSync(argv.src).isDirectory()) {
    console.log('Error: Source should be a tar file not a directory, ' +
                'use `cafjs pack` first to create this tar file');
    process.exit(1);
} else {
    buildImage(argv.src, argv.image, function(err) {
        if (err) {
            console.log(myUtils.errToPrettyStr(err));
        } else {
            console.log('Done!');
        }
    });
}
