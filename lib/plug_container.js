/*!
Copyright 2013 Hewlett-Packard Development Company, L.P.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

"use strict";
/**
 * Manages a Docker container.
 *
 *
 * @name caf_dcinabox/plug_container
 * @namespace
 * @augments caf_components/gen_plug
 *
 */
var assert = require('assert');
var caf_core =  require('caf_core');
var caf_comp = caf_core.caf_components;
var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;
var fs = require('fs');

var RUNNING_MAX_TIMES=1000;
var RUNNING_DELAY_RETRY=100;
var STOP_TO_KILL_DELAY=10;

var callJustOnce = function($, cb) {
    return myUtils.callJustOnce(function(err, data) {
        $._.$.log && $._.$.log.trace('Ignore Call >1: err:' +
                                     myUtils.errToPrettyStr(err) +
                                     ' data:' + JSON.stringify(data));
    }, cb);
};

var waitForRunning = function(container, cb) {
    var waitForRunningImpl = function(cb0) {
        container.inspect(function(err, data) {
            if (err) {
                cb0(err);
            } else {

                if ((typeof data === 'object')  &&
                    (data.State && data.State.Running)){
                    cb0(null);
                } else {
                    var newErr = new Error('Not running yet');
                    newErr.data = data;
                    cb0(newErr);
                }
            }
        });
    };

    myUtils.retryWithDelay(waitForRunningImpl, RUNNING_MAX_TIMES,
                           RUNNING_DELAY_RETRY, cb);
};

/**
 * Factory method for managing Docker containers.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = genPlug.constructor($, spec);
        var container = null;

        $._.$.log && $._.$.log.debug('New container plug');

        assert.equal(typeof spec.env.image, 'string',
                     "'spec.env.image' not a string");

        assert.equal(typeof spec.env.hostname, 'string',
                     "'spec.env.hostname' not a string");

        assert.equal(typeof spec.env.privileged, 'boolean',
                     "'spec.env.privileged' not a boolean");

        assert.equal(typeof spec.env.containerNameSuffix, 'string',
                     "'spec.env.containerNameSuffix' not a string");

        if (spec.env.registryUsername) {
            assert.equal(typeof spec.env.registryUsername, 'string',
                         "'spec.env.registryUsername' not a string");
        }

        if (spec.env.registryPassword) {
            assert.equal(typeof spec.env.registryPassword, 'string',
                         "'spec.env.registryPassword' not a string");
        }

        var workingDir = null;
        if (spec.env.workingDir) {
            assert.equal(typeof spec.env.workingDir, 'string',
                         "'spec.env.workingDir' not a string");
            workingDir =  spec.env.workingDir;
        }

        var cmdArray = ((typeof(spec.env.cmdArray) === 'string') ?
                        JSON.parse(spec.env.cmdArray) :
                        spec.env.cmdArray);
        assert.ok(Array.isArray(cmdArray),
                  "'spec.env.cmdArray' is not an array");

        var outStream = null;
        if (spec.env.outputFile) {
            outStream = fs.createWriteStream(spec.env.outputFile);
        }

        var checkServices  = function() {
            if (Array.isArray(spec.env.services)) {
                spec.env.services.forEach(function(x) {
                    if (typeof $._.$[x] !== 'object') {
                        throw new Error('Service: ' + x + ' not active');
                    }
                });
            }
        };

        checkServices();


        var startContainer = function(cb0) {
            var cb1 = callJustOnce($, cb0);
            var docker = $._.$.docker.cli;

            var pullImage = function(image, cb1) {
                var options = {};
                if (spec.env.registryUsername && spec.env.registryPassword) {
                    var auth = {
                        username: spec.env.registryUsername,
                        password: spec.env.registryPassword
                    };
                    options.authconfig = auth;
                }
                $._.$.log && $._.$.log.debug('PULLING image: ' + image);
                docker.pull(spec.env.image, options, function (err, stream) {
                    function onFinished(err, output) {
                        if (err) {
                            var str = myUtils.errToPrettyStr(err);
                            $._.$.log && $._.$.log.warn(str);
                        }
                        $._.$.log && $._.$.log.debug(output);
                        that.__ca_shutdown__(null, cb1);
                    }
                    if (err) {
                        var str = myUtils.errToPrettyStr(err);
                        $._.$.log && $._.$.log.warn(str);
                        that.__ca_shutdown__(null, cb1);
                    } else {
                        docker.modem.followProgress(stream, onFinished);
                    }
                });
            };


            var createOptions =  {
                Hostname: spec.env.hostname
            };
//            myUtils.mixin(createOptions, extraCreateOptions);
            createOptions.name = (spec.env.containerNameSuffix ?
                                  spec.name + '-' +
                                  spec.env.containerNameSuffix : spec.name);

            //Env

            createOptions.Env = (createOptions.Env ? createOptions.Env : []);
            var props = (spec.env.props  &&
                         (typeof spec.env.props === 'object') ?
                         spec.env.props : {});
            Object.keys(props).forEach(function(x) {
                var p = props[x];
                p = (typeof p === 'string' ? p : JSON.stringify(p));
                createOptions.Env.push(x + '=' + p);
            });

            if (workingDir) {
                createOptions.WorkingDir = workingDir;
            }

            var hostConfig = {
                Privileged: spec.env.privileged
            };
//            myUtils.mixin(hostConfig, extraStartOptions);

            // Volumes

            hostConfig.Binds = (hostConfig.Binds ? hostConfig.Binds : []);
            var volumes = spec.env.volumes || [];
            volumes.forEach(function(x) {
                hostConfig.Binds.push(x.source + ':' + x.destination);
            });

            // Network

            var firstNetwork = (Array.isArray(spec.env.networks) ?
                                spec.env.networks[0] : null);
            hostConfig.NetworkMode = (firstNetwork ?
                                        $._.$[firstNetwork].getName() :
                                        'bridge');
            hostConfig.PortBindings = (hostConfig.PortBindings ?
                                         hostConfig.PortBindings : {});
            createOptions.ExposedPorts = (createOptions.ExposedPorts ?
                                          createOptions.ExposedPorts : {});
            var ports = spec.env.ports || [];
            ports.forEach(function(x) {
                createOptions.ExposedPorts['' + x.containerPort + '/tcp'] = {};
                hostConfig.PortBindings['' + x.containerPort + '/tcp'] =
                    [{"HostPort" : '' + x.hostPort, "HostIp" : x.hostIp}];
            });

            createOptions.HostConfig = hostConfig;
            var job = docker.run(spec.env.image, cmdArray, null, createOptions,
                                 function (err, data, container) {
                                     if (err) {
                                         if (err.statusCode === 404) {
                                             pullImage(spec.env.image, cb1);
                                         } else {
                                             var str = myUtils
                                                     .errToPrettyStr(err);
                                             $._.$.log && $._.$.log.warn(str);
                                             that.__ca_shutdown__(null, cb1);
                                         }
                                     } else {
                                         /* Container has finished, ensure that
                                          * we are shutdown.
                                          */
                                         that.__ca_shutdown__(null, cb1);
                                     }
                                 });

            job.on('container', function(newContainer) {
                $._.$.log && $._.$.log.debug('Container created, id:' +
                                             newContainer.id);
                container = newContainer;
                waitForRunning(container, function(err) {
                    if (err) {
                        cb1(err);
                    } else {
                        $._.$.log && $._.$.log.debug('Container running, id:' +
                                                     newContainer.id);
                        if (Array.isArray(spec.env.networks)) {
                            //1st already connected
                            var dropFirst = spec.env.networks.slice(1);
                            async.eachSeries(dropFirst, function(net, cb2) {
                                if ($._.$[net]) {
                                    $._.$[net].connect(container.id, cb2);
                                } else {
                                    cb2(new Error('Network: ' + net +
                                                  '  not created'));
                                }
                            }, cb1);
                        } else {
                            cb1(null);
                        }
                    }
                });
            });

            job.on('stream', function(stream) {
                stream.setEncoding('utf8');
                if (outStream) {
                    stream.pipe(outStream , {end: true});
                } else {
                    stream.pipe(process.stdout); // don't close stdout
                }
            });
        };

        var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb0) {
            super__ca_shutdown__(data, function(err, res) {
                if (err) {
                    cb0(err);
                } else {
                    if (container) {
                        var oldContainer = container;
                        container = null;
                        oldContainer
                            .stop({t: STOP_TO_KILL_DELAY}, function(error) {
                                if (error) {
                                    $._.$.log &&
                                        $._.$.log.debug('Error stopping:' +
                                                        myUtils
                                                        .errToPrettyStr(error));
                                }
                                // first graceful, then the hammer...
                                oldContainer.remove({force: true}, cb0);
                            });
                    } else {
                        cb0(null);
                    }
                }
            });
        };

        startContainer(function(err) {
            if (err) {
                cb(err);
            } else {
                cb(null, that);
            }
        });

    } catch (err) {
        cb(err);
    }
};
