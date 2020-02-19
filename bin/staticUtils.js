'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

exports.resolveModules = function(scope, allModules) {

    const resolveAsFile = function(x) {
        return (fs.existsSync(x) || fs.existsSync(x + '.js') ||
                fs.existsSync(x + '.json') || (fs.existsSync(x + '.node')));
    };

    const resolveAsDir = function(x) {
        return (fs.existsSync(path.resolve(x, 'package.json')) ||
                fs.existsSync(path.resolve(x, 'index.js')) ||
                fs.existsSync(path.resolve(x, 'index.json')) ||
                fs.existsSync(path.resolve(x, 'index.node')));
    };

    const hasPrefix = function(x) {
        return ((x.indexOf('/') === 0) || (x.indexOf('./') === 0) ||
                (x.indexOf('../') === 0));
    };

    const resolveOne = function(artifact) {
        const mod = allModules[artifact];
        let resolvedName = null;
        const allPaths = (mod.paths && mod.paths.slice(0)) || [];
        allPaths.unshift(path.dirname(mod.filename));
        allPaths.some(function(x) {
            const artif = path.resolve(x, artifact);
            if (resolveAsFile(artif) || resolveAsDir(artif)) {
                resolvedName = artif;
                return true;
            } else {
                return false;
            }
        });
        assert(resolvedName !== null);
        resolvedName = path.relative(scope, resolvedName);
        return (hasPrefix(resolvedName) ? resolvedName : './' + resolvedName);
    };

    const result = {};
    Object.keys(allModules).forEach(function(x) {
        result[x] = resolveOne(x);
    });

    return result;
};
