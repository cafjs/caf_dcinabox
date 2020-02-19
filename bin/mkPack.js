#!/usr/bin/env node
'use strict';
const parseArgs = require('minimist');
const path = require('path');
const os = require('os');
const rsync = require('rsync');

const caf_core = require('caf_core');
const caf_comp = caf_core.caf_components;
const async = caf_comp.async;

const myUtils = caf_comp.myUtils;
const fs = require('fs');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const tar = require('tar');

const DEFAULT_TAR_FILE = 'app.tgz';

const usage = function() {
    console.log('Usage:mkPack.js --iot <boolean> --appDir <string>' +
                ' [--tarFile <string>] [--workspacesDir <string>] ');
    process.exit(1);
};

const argv = parseArgs(process.argv.slice(2), {
    string: ['appDir', 'workspacesDir', 'tarFile'],
    boolean: ['iot'],
    alias: {i: 'iot', a: 'appDir', w: 'workspacesDir', t: 'tarFile'},
    unknown: usage
});

if (!argv.appDir) {
    usage();
}

argv.tarFile = argv.tarFile || path.resolve(os.tmpdir(), DEFAULT_TAR_FILE);

argv.tarFile = path.resolve(argv.appDir, argv.tarFile);

console.log('Starting mkPack.js');

console.log(JSON.stringify(argv));

const id = myUtils.uniqueId().replace(/[/]/g, '1');
const TMP_DIR = path.join(os.tmpdir(), id);

const EXCLUDE_DIRS = ['node_modules', 'docs', 'test', 'examples', '.git',
                      'apps', 'app', 'typescript'];

/*
 *  Priority order:
 *   1. command line,
 *   2. CAF_ROOT property,
 *   3. Find it using `require()` order starting in app directory.
*/
const findRoot = function(currentPath) {
    const isRootWorkspace = function(packjson) {
        try {
            const p = require(packjson);
            return p && p.workspaces;
        } catch (err) {
            return false;
        }
    };

    if (argv.workspacesDir) {
        return argv.workspacesDir;
    } else {
        const cafRoot = process.env['CAF_ROOT'];
        if (cafRoot) {
            return cafRoot;
        } else {
            if (currentPath) {
                const packjson = path.resolve(currentPath, 'package.json');
                if (isRootWorkspace(packjson)) {
                    return currentPath;
                } else if (currentPath === '/') {
                    return null;
                } else {
                    return findRoot(path.resolve(currentPath, '..'));
                }
            } else {
                return null;
            }
        }
    }
};

const findExcluded = function(rootDir) {
    try {
        const p = require(path.resolve(rootDir, 'package.json'));
        const exclude = p && p.caf && p.caf.excludeFromPack;
        if (exclude) {
            const extra = Object.keys(exclude).filter(function(x) {
                if (exclude[x] === 'always') {
                    return true;
                } else if ((exclude[x] === 'iot') && argv.iot) {
                    console.log('excluding ' + x);
                    return true;
                } else {
                    return false;
                }
            });
            return EXCLUDE_DIRS.concat(extra);
        } else {
            return EXCLUDE_DIRS;
        }
    } catch (err) {
        console.log('Missing package.json at ' + rootDir);
        process.exit(1);
        return null;
    }
};

const rsync_copy = function(source, destination, exclude, cb) {
    const r = rsync.build({
        source: source,
        destination: destination,
        exclude: exclude,
        flags: 'a'
    });

    r.execute(function(err, code, cmd) {
        cb(err, cmd);
    });
};

const addSlash = function(x) {
    if (x && (x.length >0)) {
        return ((x[x.length-1] === '/') ? x : x + '/');
    } else {
        return x;
    }
};

const callJustOnce = function(cb) {
    return myUtils.callJustOnce(function(err, data) {
        console.log('Ignore Call >1: err:' + myUtils.errToPrettyStr(err) +
                    ' data:' + JSON.stringify(data));
    }, cb);
};

const pack = function(dstTarFile, cb) {
    const cb1 = callJustOnce(cb);
    const dest = fs.createWriteStream(dstTarFile);
    dest.on('error', cb1)
        .on('finish', function() {cb1(null);});

    tar.create({gzip: true, cwd: TMP_DIR}, ['.']).pipe(dest);
};

const linkDockerfile = function(top, target) {
    const currentDir = process.cwd();
    process.chdir(top);
    // eslint-disable-next-line no-empty
    try { fs.unlinkSync(path.join(top, 'Dockerfile'));} catch (_error) {}
    const relPath = path.join(path.relative(top, target), 'Dockerfile');
    fs.symlinkSync('.' + path.sep + relPath, '.' + path.sep + 'Dockerfile');
    process.chdir(currentDir);
};

try {
    const rootDir = findRoot(argv.appDir);
    if (!rootDir) {
        console.log('Cannot find root of workspaces');
        process.exit(1);
    }
    const excluded = findExcluded(rootDir);
    mkdirp.sync(TMP_DIR);
    const target = path.resolve(TMP_DIR, 'app');
    mkdirp.sync(target);

    async.series([
        function(cb) {
            rsync_copy(addSlash(rootDir), addSlash(TMP_DIR), excluded, cb);
        },
        function(cb) {
            rsync_copy(addSlash(argv.appDir), addSlash(target), excluded, cb);
        },
        function(cb) {
            linkDockerfile(TMP_DIR, target);
            pack(argv.tarFile, cb);
        }
    ], function(err) {
        // eslint-disable-next-line no-empty
        try {rimraf.sync(TMP_DIR);} catch (_err) {}
        if (err) {
            console.log(myUtils.errToPrettyStr(err));
            process.exit(1);
        } else {
            console.log('Pack: tar file written to ' + argv.tarFile);
        }
    });

} catch (err) {
    console.log(myUtils.errToPrettyStr(err));
    // eslint-disable-next-line no-empty
    try {rimraf.sync(TMP_DIR);} catch (_err) {}
    process.exit(1);
}
