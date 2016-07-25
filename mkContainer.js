#!/usr/bin/env node
var parseArgs = require('minimist');
var child_process = require('child_process');
var path = require('path');
var Docker = require('dockerode');
var caf_core =  require('caf_core');
var caf_comp = caf_core.caf_components;
var async = caf_comp.async;
var fs = require('fs');
var myUtils = caf_comp.myUtils;
var tar = require('tar');
var fstream = require('fstream');
var crypto = require('crypto');

var TEMP_DIR='/tmp';
var MAX_BUFFER = 1024 * 100000;
var IOT_SUBDIR = 'iot';

var usage = function() {
    console.log('Usage: mkContainer.js --src <string> --container <string>');
    process.exit(1);
};

var argv = parseArgs(process.argv.slice(2), {
    string : ['src', 'container'],
    alias: {s : 'src', c: 'container'},
    unknown: usage
});

if (!argv.src || !argv.container) {
    usage();
}


var bundleDependencies = function(src, cb) {
    console.log('Assembling dependencies for ' + src);
    var args = [src];
    var pac = require(path.resolve(src, 'package.json'));
    var filter = new RegExp("^caf_");
    for (var dep in pac.dependencies) {
        if (filter.test(dep)) {
            args.push(dep);
        }
    }
    child_process.execFile(path.resolve(__dirname, 'cpLocalDeps.sh'), args,
                           {maxBuffer: MAX_BUFFER},
                           function(err, stdout, stderr) {
                               console.log(stdout);
                               console.log(stderr);
                               cb(err, stdout, stderr);
                           });
};

var copyAll = function(src, dest, cb) {
    console.log('Copying from ' + src + ' to ' + dest);
    var args = [src, dest];
    child_process.execFile(path.resolve(__dirname, 'cpAll.sh'), args,
                           {maxBuffer: MAX_BUFFER}, cb);
};

var cleanup = function(src, cb) {
    console.log('Cleaning up for ' + src);
    var args = [src];
    child_process.execFile(path.resolve(__dirname, 'cleanupLocalDeps.sh'), args,
                           {maxBuffer: MAX_BUFFER}, cb);
};

var randName = function() {
    return new Buffer(crypto.randomBytes(15)).toString('hex');
};

var callJustOnce = function(cb) {
    return myUtils.callJustOnce(function(err, data) {
        console.log('Ignore Call >1: err:' + myUtils.errToPrettyStr(err) +
                    ' data:' + JSON.stringify(data));
    }, cb);
};

var buildImage = function(src, container, cb) {
    var docker = new Docker({socketPath: '/var/run/docker.sock'});
    var imgTar = path.resolve(TEMP_DIR, 'image-' + randName() + '.tar');
    console.log('Building image ' + container);
    var cb0 = callJustOnce(cb);
    async.series([
        function(cb1) {
            var cb2 = callJustOnce(cb1);
            var dirDest = fs.createWriteStream(imgTar);
            dirDest.on('error', cb2);
            var packer = tar.Pack({ noProprietary: true , fromBase: true});
            packer.on('error', cb2);
            fstream.Reader({ path: src, type: "Directory" })
                .on('error', cb2)
                .pipe(packer)
                .pipe(dirDest);
            dirDest.on('finish', function() {
                cb2(null);
            });
        },
        function(cb1) {
            docker.buildImage(imgTar, {t : container},
                              function(err, stream) {
                                  if (err) {
                                      cb1(err);
                                  } else {
                                      var onFinished = function(err, output) {
                                          if (err) {
                                              err.output = output;
                                              cb1(err);
                                          } else {
                                              console.log(output);
                                              cb1(null);
                                          }
                                      };
                                      docker.modem.followProgress(stream,
                                                                  onFinished);
                                  }
                              });
        },
        function(cb1) {
            fs.unlink(imgTar, cb1);
        }
    ], cb0);
};


var newSrc = path.resolve(TEMP_DIR, randName());

async.series([
    function(cb0) {
        copyAll(argv.src, newSrc, cb0);
    },
    function(cb0) {
        bundleDependencies(newSrc, cb0);
    },
    function(cb0) {
        var  iotDir = path.resolve(newSrc, IOT_SUBDIR);
        fs.stat(iotDir, function(err, stats) {
            if (err) {
                cb0(null);
            } else if (stats && stats.isDirectory()) {
                bundleDependencies(iotDir, cb0);
            } else {
                console.log("Ignoring 'iot', it is not a directory");
                cb0(null);
            }
        });
    },
    function(cb0) {
        buildImage(newSrc, argv.container, cb0);
    },
    function(cb0) {
        cleanup(newSrc, cb0);
    },
], function(err) {
    if(err) {
        console.log(myUtils.errToPrettyStr(err));
    } else {
        console.log('Done!');
    }
});
