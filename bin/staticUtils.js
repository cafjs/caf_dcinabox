'use strict';
var fs = require('fs');
var path = require('path');
var assert = require('assert');

exports.resolveModules = function(scope, allModules) {

    var resolveAsFile = function(x) {
        return (fs.existsSync(x) || fs.existsSync(x + '.js') ||
                fs.existsSync(x + '.json') || (fs.existsSync(x + '.node')));
    };

    var resolveAsDir = function(x) {
        return (fs.existsSync(path.resolve(x,'package.json')) ||
                fs.existsSync(path.resolve(x, 'index.js')) ||
                fs.existsSync(path.resolve(x, 'index.json')) ||
                fs.existsSync(path.resolve(x, 'index.node')));
    };

    var hasPrefix = function(x) {
        return ((x.indexOf('/') === 0) || (x.indexOf('./') === 0) ||
                (x.indexOf('../') === 0));
    };

    var resolveOne = function(artifact) {
        var mod = allModules[artifact];
        var resolvedName = null;
        var allPaths = (mod.paths && mod.paths.slice(0)) || [];
        allPaths.unshift(path.dirname(mod.filename));
        allPaths.some(function(x) {
            var artif = path.resolve(x, artifact);
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

    var result = {};
    Object.keys(allModules).forEach(function(x) {
        result[x] = resolveOne(x);
    });

    return result;
};
