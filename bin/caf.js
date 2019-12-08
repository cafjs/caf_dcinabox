#!/usr/bin/env node
var child_process = require('child_process');
var parseArgs = require('minimist');
var path = require('path');
var fs = require('fs');
var os = require('os');
var rimraf = require('rimraf');
var caf_core =  require('caf_core');
var caf_comp = caf_core.caf_components;
var async = caf_comp.async;

var myUtils = caf_comp.myUtils;

var HELP = 'Usage: cafjs run|build|reset|device|mkImage|mkIoTImage|mkStatic|\
pack|generate|help \n\
where: \n\
*  run:  starts a simulated cloud that mounts an app local volume. \n\
*  build: builds an application using local dependencies. \n\
*  reset: cleans up, brute force, all docker containers and networks. \n\
*  device: simulates a device that access a CA. \n\
*  mkImage: builds a Docker image from a packed app or a directory. \n\
*  mkIoTImage: builds a Docker image for the device app. \n\
*  mkStatic: creates a dependency file to load artifacts statically. \n\
*  pack: packs an application embedded in yarn workspaces. \n\
*  generate: creates an skeleton app using a template. \n\
*  help [command]: prints this info or details of any of the above. \n\
';

var usage = function() {
    console.log('Usage: cafjs run|build|reset|device|mkImage|mkIoTImage|\
mkStatic|pack|generate|help <...args...>');
    process.exit(1);
};

var condInsert = function(target, key, value) {
    if ((target[key] === undefined) ||
        //minimist sets undefined boolean flags to 'false'
        // do not set both a qualified and unqualified value on boolean...
        (target[key] === false)) {
        target[key] = value;
    }
};

var argsToArray = function(args) {
    var result = [];
    Object.keys(args).filter(function(x) {
        return (x !== '_');
    }).forEach(function(x) {
        result.push('--' + x);
        result.push(args[x]);
    });
    return result;
};

var that = {
    __usage__: function(msg) {
        console.log(msg);
        process.exit(1);
    },

    __spawn__: function(cmd, args, cb) {
        var cmdFull = path.resolve(__dirname, cmd);
        console.log('spawn: ' + cmdFull + ' args:' + JSON.stringify(args));
        var sp = child_process.spawn(cmdFull, args);
        sp.stdout.on('data', function(data) {
            console.log('out: ' + data);
        });

        sp.stderr.on('data', function(data) {
            console.log('err: ' + data);
        });

        sp.on('close', function(code) {
            console.log('spawn DONE: ' + cmdFull + ' code:' + code);
            cb && cb(null, code);
        });
        that.__spawnedChild__ = sp;
    },

    __exec__: function(cmd, args) {
        var cmdFull = path.resolve(__dirname, cmd);
        console.log(cmdFull + ' args:' + JSON.stringify(args));
        var buf = child_process.execFileSync(cmdFull, args);
        console.log(buf.toString());
     },

    __no_args__: function(cmd, args, msg, spawn) {
        var usage = function() {
            that.__usage__(msg);
        };
        var argv = parseArgs(args, {
            unknown: usage
        });
        if (spawn) {
            that.__spawn__(cmd, argv._);
        } else {
            that.__exec__(cmd, argv._);
        }
    },

    build: function(args) {
        that.__no_args__('buildApp.sh', args, 'Usage: cafjs build', true);
    },

    reset: function(args) {
        that.__no_args__('reset.sh', args, 'Usage: cafjs reset');
    },

    run: function(args) {
        var usage = function(x) {
            if (x.indexOf('--') !== 0) {
                return true;
            } else {
                console.log('Invalid ' + x);
                that.__usage__('Usage: cafjs run [--appImage <string>] ' +
                               '[--ipAddress <string>] [--port <string>] ' +
                               '[--debugApplication <boolean>] ' +
                               'appLocalName [appWorkingDir] [host/app Vol]');
                return false;
            }
        };

        var argv = parseArgs(args, {
            string : ['appImage', 'appLocalName', 'appWorkingDir',
                      'hostVolume', 'appVolume', 'ipAddress', 'port'],
            boolean : ['debugApplication'],
            unknown: usage
        });
        var isPrototypeMode = (argv.appImage === undefined);
        var options = argv._ || [];
        var appLocalName = options.shift();
        condInsert(argv, 'appLocalName', appLocalName);
        if (!argv.appLocalName) {
            usage('--appLocalName');
        }
        var appWorkingDir = options.shift();
        appWorkingDir = appWorkingDir ||
            (isPrototypeMode ? process.env['PWD'] : undefined);
        appWorkingDir && condInsert(argv, 'appWorkingDir', appWorkingDir);
        var hostVolume = options.shift();
        hostVolume = hostVolume ||
            (isPrototypeMode ? process.env['HOME'] : undefined);
        hostVolume && condInsert(argv, 'hostVolume', hostVolume);
        hostVolume && condInsert(argv, 'appVolume', hostVolume);
        var appImage = process.env['APP_IMAGE'] ||
                'gcr.io/cafjs-k8/root-generic';
        condInsert(argv, 'appImage', appImage);
        console.log(JSON.stringify(argsToArray(argv)));
        that.__spawn__('../dcinabox.js', argsToArray(argv));
    },

    device: function(args) {
        var usage = function(x) {
            if (x.indexOf('--') !== 0) {
                return true;
            } else {
                console.log('Invalid ' + x);
                that.__usage__('Usage: cafjs device [--ipAddress <string>] ' +
                               '[--port <string>] [--appSuffix <string>] '  +
                                '[--debugApplication <boolean>] ' +
                               'deviceId (e.g., foo-device1)');
                return false;
            }
        };
        var argv = parseArgs(args, {
            string : ['deviceId', 'ipAddress', 'port', 'password', 'rootDir',
                      'appSuffix'],
            boolean : ['debugApplication'],
            unknown: usage
        });
        var options = argv._ || [];
        var deviceId = options.shift();
        condInsert(argv, 'deviceId', deviceId);
        if (!argv.deviceId) {
            usage('--deviceId');
        }
        that.__spawn__('../simdevice.js', argsToArray(argv));
    },

    mkImage: function(args) {
       var usage = function(x) {
            if (x.indexOf('--') !== 0) {
                return true;
            } else {
                console.log('Invalid ' + x);
                that.__usage__('Usage: cafjs mkImage src imageName [iot]');
                return false;
            }
        };
        var argv = parseArgs(args, {
            string : ['src', 'image'],
            unknown: usage
        });
        var options = argv._ || [];
        var src = options.shift();
        condInsert(argv, 'src', src);
        if (!argv.src) {
            usage('--src');
        }
        var image = options.shift();
        condInsert(argv, 'image', image);
        if (!argv.image) {
            usage('--image');
        }
        var iot = (options.shift() === 'true');

        if (fs.statSync(argv.src).isDirectory()) {
            // pack first
            var id = myUtils.uniqueId().replace(/[/]/g, '1');
            var tmpTar = path.join(os.tmpdir(), 'app_' + id + '.tgz');
            var packArgs = ['pack', iot, argv.src, tmpTar];
            that.__spawn__('caf.js', packArgs, function(err) {
                if (err) {
                    try {rimraf.sync(tmpTar);} catch(_err) {};
                    console.log('Cannot pack directory');
                    console.log(myUtils.errToPrettyStr(err));
                } else {
                    argv.src = tmpTar;
                    that.__spawn__('mkContainerImage.js', argsToArray(argv),
                                   function(err) {
                                       try {
                                           rimraf.sync(tmpTar);
                                       } catch(_err) {};
                                       if (err) {
                                           var e = myUtils.errToPrettyStr(err);
                                           console.log(e);
                                       }
                                   });
                }
            });
        } else {
            that.__spawn__('mkContainerImage.js', argsToArray(argv));
        }
    },

    mkIoTImage: function(args) {
       var usage = function(x) {
            if (x.indexOf('--') !== 0) {
                return true;
            } else {
                console.log('Invalid ' + x);
                that.__usage__('Usage: cafjs mkIoTImage appLocalName' +
                               ' [privileged:boolean]');
                return false;
            }
        };
        var argv = parseArgs(args, {
            string : ['appLocalName'],
            boolean : ['privileged'],
            unknown: usage
        });

        var options = argv._ || [];
        var appLocalName = options.shift();
        condInsert(argv, 'appLocalName', appLocalName);
        if (!argv.appLocalName) {
            usage('--appLocalName');
        }
        var privileged = options.shift();
        condInsert(argv, 'privileged', privileged || false);
        that.__spawn__('mkIoTContainer.js', argsToArray(argv));
    },

    mkStatic: function(args) {
       var usage = function(x) {
            if (x.indexOf('--') !== 0) {
                return true;
            } else {
                console.log('Invalid ' + x);
                that.__usage__('Usage: cafjs mkStatic [rootDir]');
                return false;
            }
        };
        var argv = parseArgs(args, {
            string : ['rootDir'],
            unknown: usage
        });

        var options = argv._ || [];
        var rootDir = options.shift();
        condInsert(argv, 'rootDir', rootDir || process.cwd());
        that.__spawn__('mkStatic.js', argsToArray(argv));
    },

    pack: function(args) {
        var usage = function(x) {
            if (x.indexOf('--') !== 0) {
                return true;
            } else {
                console.log('Invalid ' + x);
                that.__usage__('Usage: cafjs pack [iot] [appDir] [tarFile]' +
                               ' [workspacesDir]');
                return false;
            }
        };
        var argv = parseArgs(args, {
            string : ['appDir', 'workspacesDir', 'tarFile'],
            boolean: ['iot'],
            unknown: usage
        });

        var options = argv._ || [];
        var iot = (options.shift() === 'true');
        condInsert(argv, 'iot', iot);
        var appDir = options.shift();
        condInsert(argv, 'appDir', appDir || process.cwd());
        var tarFile = options.shift();
        tarFile && condInsert(argv, 'tarFile', tarFile);
        var workspacesDir = options.shift();
        workspacesDir && condInsert(argv, 'workspacesDir', workspacesDir);
        that.__spawn__('mkPack.js', argsToArray(argv));
    },

    generate: function(args) {
        var usage = function(x) {
            if (x.indexOf('--') !== 0) {
                return true;
            } else {
                console.log('Invalid ' + x);
                that.__usage__('Usage: cafjs generate ' +
                               '[--templateImage <string>] appName [target] ' +
                               '[appDir] [appConfig] \n' +
                               '  where target is, e.g., cloud|web|iot|vr' +
                               ' and defaults to `web`');
                return false;
            }
        };
        var argv = parseArgs(args, {
            string : ['templateImage', 'appName', 'target', 'appDir',
                      'appConfig'],
            unknown: usage
        });

        var options = argv._ || [];
        var appName = options.shift();
        condInsert(argv, 'appName', appName);
        if (!argv.appName) {
            usage('--appName');
        }

        var target = options.shift();
        target && condInsert(argv, 'target', target);

        var appDir = options.shift();
        appDir = appDir || process.env['PWD'];
        condInsert(argv, 'appDir', appDir);

        var appConfig = options.shift();
        appConfig && condInsert(argv, 'appConfig', appConfig);

        that.__spawn__('generate.js', argsToArray(argv));
    },

    help: function(args) {
        var argv = parseArgs(args||[]);
        var options = argv._ || [];
        if (options.length > 0) {
            var cmd = options.shift();
            that[cmd](['--help']);
        } else {
            that.__usage__(HELP);
        }
    }
};

var args = process.argv.slice(2);
var command = args.shift();
if (command && that[command]) {
    try {
        that[command](args);
    } catch(error) {
        console.log(error.toString());
    }
} else {
    usage();
}

var pendingKill = false;
process.on('SIGINT', function() {
    if (that.__spawnedChild__) {
        if (pendingKill) {
            console.log("Forcing HARD reset");
            that.reset([]);
            process.kill(that.__spawnedChild__.pid, 'SIGTERM');
        } else {
            console.log("Propagating signal to child");
            pendingKill = true;
        }
    }
});
