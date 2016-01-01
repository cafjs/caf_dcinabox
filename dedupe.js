#!/usr/bin/env node

/**
 * Analyzes a tar file with shrinkwrapped dependencies, eliminating
 * redundant dependencies from both `npm-shrinkwrap.json` and `node_module/*`.
 *
 *  Note that we only eliminate redundant packages named `caf_*` because the 
 * other packages could be used as devDeps (and not in npm-shrinkwrap.json),
 *  i.e., this is NOT a general purpose dedupe tool.
 *
 * The motivation for this tools is that `npm dedupe` seems to replace local
 * packages by remote ones, and does not seem to coordinate with shrinkwrap.
 * Also, npm@v3 seems unstable with links+shrinkwrap these days, but hopefully,
 * `dedupe.js` will become obsolete when npm@v3 stabilizes, since the new npm
 *  has built-in dedupe.
 * 
 * Usage: dedupe.js --src <tar file:string> --dst <string> 
 * where src and dst are uncompressed tar files containing  
 *  `npm-shrinkwrap.json` and `node_module/*`
*/

var parseArgs = require('minimist');
var path = require('path');
var caf_core =  require('caf_core');
var caf_comp = caf_core.caf_components;
var async = caf_comp.async;
var fs = require('fs');
var fstream = require('fstream');
var myUtils = caf_comp.myUtils;
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var tar = require('tar');

var randName = function() {
    return new Buffer(crypto.randomBytes(15)).toString('hex');
};

var callJustOnce = function(cb) {
    return myUtils.callJustOnce(function(err, data) {
        console.log('Ignore Call >1: err:' + myUtils.errToPrettyStr(err) +
                    ' data:' + JSON.stringify(data));
    }, cb);
};

var TEMP_DIR='/tmp/' + randName();


var usage = function() {
    console.log('Usage: dedupe.js --src <tar file:string> --dst <string>');
    process.exit(1);
};


var argv = parseArgs(process.argv.slice(2), {
    string : ['src', 'dst'],
    alias: {s : 'src', d: 'dst'},
    unknown: usage
});

if (!argv.src || !argv.dst) {
    usage();
}

var createTemp = function(cb) {
    mkdirp(TEMP_DIR, cb);
};

var unpack = function(srcTarFile, cb) {
    var cb1 =  callJustOnce(cb);
    var unpacker = tar.Extract({
        path: TEMP_DIR,
        strip : 0
    });
    
    unpacker.on('error', cb1).on('end', cb1);

    fs.createReadStream(path.resolve(srcTarFile))
        .on('error', cb1)
        .pipe(unpacker);
};

var loadShrinkwrap = function(cb) {
    try {
        cb(null, require(path.resolve(TEMP_DIR, 'npm-shrinkwrap.json')));
    } catch(err) {
        cb(err);
    }
};

var pack = function(dstTarFile, cb) {
    var cb1 =  callJustOnce(cb);
    var dest = fs.createWriteStream(dstTarFile);
    dest.on('error', cb1)
        .on('finish', function() {
            cb1(null);
        });
    var packer = tar.Pack({ noProprietary: true , fromBase: true});
    packer.on('error', cb1);
    fstream.Reader({ path: TEMP_DIR, type: "Directory" })
        .on('error', cb1)
        .pipe(packer)
        .pipe(dest);
};

var cleanup = function(cb) {
    rimraf(TEMP_DIR, cb);
};


var lsDir = function(p) {
    var result = [];
    try {
        var all = fs.readdirSync(path.join.apply(path.join, p));
        all.forEach(function(x) {
            var fileName = path.join.apply(path.join, p.concat(x));
            var stats = fs.statSync(fileName);
            if (stats.isDirectory()) {
                result.push(x);
            }
        });
    } catch (err) {
        // no node_modules dir
    }
    return result;
};

var cleanShrinkwrap = function(shrw) {
    var filter = new RegExp("^caf_");
    var isRedundant = function(x, p) {
        return filter.test(x) && p.some(function(p1) {
            return p1[x];
        });
    };
    var traverseF = function(desc, p) {
        if (desc && (typeof desc === 'object')) {
            var deps = desc.dependencies;
            if (deps) {
                Object.keys(deps).forEach(function(x) {
                    if (isRedundant(x, p)) {
                        console.log('Deleting in npm-shrinkwrap ' + x);
                        delete deps[x];
                    } else {
                        p.push(deps);
                        traverseF(deps[x], p);
                        p.pop();
                    }
                });
            }
        }
    };
    traverseF(shrw, []);
    return shrw;
};

var deleteRedundant = function(shrw, cb) {
    var filter = new RegExp("^caf_");
    var traverseF = function(desc, p) {
        if (desc && (typeof desc === 'object')) {
            var deps = desc.dependencies || {};
            p.push('node_modules');
            var lstDirs = lsDir(p);
            lstDirs.forEach(function(dir) {
                if (deps[dir]) {
                    p.push(dir);
                    traverseF(deps[dir], p);
                    p.pop();
                } else if (filter.test(dir)) {
                    var target = path.join.apply(path.join, p.concat(dir));
                    console.log('Deleting ' + target);
                    rimraf.sync(target);
                } else {
                    console.log('Ignoring ' + dir); 
                }
            });
            p.pop();
        };
    };
    try {
        traverseF(shrw, [TEMP_DIR]);
        cb(null);
    } catch(err) {
        cb(err);
    }
};

var npmshrinkwrap = null;

async.series([
    createTemp,
    function(cb1) {
        unpack(argv.src, cb1);
    },
    function(cb1) {
        loadShrinkwrap(function(err, file) {
            if (err) {
                cb1(err);
            } else {
                console.log(file);
                npmshrinkwrap = cleanShrinkwrap(file);
                console.log('*** AFTER ****');
                console.log(npmshrinkwrap);
                fs.writeFile(path.resolve(TEMP_DIR, 'npm-shrinkwrap.json'),
                             JSON.stringify(npmshrinkwrap, null, '  '), cb1);
            }
        });
    },    
    function(cb1) {
        deleteRedundant(npmshrinkwrap, cb1);
    },
    function(cb1) {
        pack(argv.dst, cb1);
    },
    cleanup
], function(err) {
    if (err) {
        console.log(myUtils.errToPrettyStr(err));
        process.exit(1);
    } else {
        console.log('Done dedup');
    }
});
