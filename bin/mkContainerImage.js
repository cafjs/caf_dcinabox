#!/usr/bin/env node
var parseArgs = require('minimist');
var path = require('path');
var Docker = require('dockerode');
var caf_core =  require('caf_core');
var caf_comp = caf_core.caf_components;
var fs = require('fs');
var myUtils = caf_comp.myUtils;

var usage = function() {
    console.log('Usage: mkContainerImage.js --src <string: tar file name> ' +
                '--image <string>');
    process.exit(1);
};

var argv = parseArgs(process.argv.slice(2), {
    string : ['src', 'image'],
    alias: {s : 'src', i: 'image'},
    unknown: usage
});

if (!argv.src || !argv.image) {
    usage();
}

var callJustOnce = function(cb) {
    return myUtils.callJustOnce(function(err, data) {
        console.log('Ignore Call >1: err:' + myUtils.errToPrettyStr(err) +
                    ' data:' + JSON.stringify(data));
    }, cb);
};

var buildImage = function(src, image, cb) {
    var docker = new Docker({socketPath: '/var/run/docker.sock'});
    console.log('Building image ' + image);
    var cb0 = callJustOnce(cb);
    docker.buildImage(src, {t : image}, function(err, stream) {
        if (err) {
            cb0(err);
        } else {
            var onFinished = function(err, output) {
                if (err) {
                    err.output = output;
                    cb0(err);
                } else {
//                    console.log(output);
                    cb0(null);
                }
            };
            var onProgress = function(event) {
                console.log(event && event.stream);
            };
            docker.modem.followProgress(stream, onFinished, onProgress);
        }
    });
};


if (fs.statSync(argv.src).isDirectory()) {
    console.log("Error: Source should be a tar file not a directory, " +
                "use `cafjs pack` first to create this tar file");
    process.exit(1);
} else {
    buildImage(argv.src, argv.image, function(err) {
        if(err) {
            console.log(myUtils.errToPrettyStr(err));
        } else {
            console.log('Done!');
        }
    });
}
