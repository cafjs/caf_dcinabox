// Modifications copyright 2020 Caf.js Labs and contributors
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

'use strict';
/**
 * Manages a Docker container.
 *
 * Properties:
 *
 *      { image: string, hostname: string, containerNameSuffix: string,
 *        ports: Array<{hostIp:string, hostPort: number, containerPort: number},
 *        volumes: Array.<{source:string, destination:string}>,
 *        networks: Array.<string>, networkAlias:Array.<string>=,
 *        privileged: boolean,
 *        props: Object.<string, string>, registryUsername: string=,
 *        registryPassword: string=, workingDir: string=, outputFile: string=,
 *        cmdArray: Array.<string>, envProp:<string>}
 *
 *  where:
 *
 * * `image`: container image name.
 * * `hostname`: a host name given to this container in the internal network.
 * * `containerNameSuffix`: a suffix for the container name.
 * * `ports`: exposed ports.
 * * `volumes`: exposed volumes.
 * * `networks`: internal networks this container should belong to.
 * * `networkAlias`: extra DNS name for this container. The array value is
 * concatenated with separator `-` to obtain the alias hostname. It applies to
 * the first network.
 * * `privileged`: whether this is a privileged container.
 * * `props`: environment properties for the container.
 * * `registryUsername`: username in the image registry.
 * * `registryPassword`: password  in the image registry.
 * * `workingDir`: directory for container processes.
 * * `outputFile`: optional file to log output. Defaults to `stdout`.
 * * `cmdArray`: command to start process in container.
 * * `envProp`: optional extra `propKey=propValue` string to set a container
 *  property.
 *
 * @module caf_dcinabox/plug_container
 * @augments external:caf_components/gen_plug
 */
const assert = require('assert');
const caf_core = require('caf_core');
const caf_comp = caf_core.caf_components;
const async = caf_comp.async;
const myUtils = caf_comp.myUtils;
const genPlug = caf_comp.gen_plug;
const fs = require('fs');

const RUNNING_MAX_TIMES=1000;
const RUNNING_DELAY_RETRY=100;
const STOP_TO_KILL_DELAY=10;

const callJustOnce = function($, cb) {
    return myUtils.callJustOnce(function(err, data) {
        $._.$.log && $._.$.log.trace('Ignore Call >1: err:' +
                                     myUtils.errToPrettyStr(err) +
                                     ' data:' + JSON.stringify(data));
    }, cb);
};

const waitForRunning = function(container, cb) {
    const waitForRunningImpl = function(cb0) {
        container.inspect(function(err, data) {
            if (err) {
                cb0(err);
            } else {
                if ((typeof data === 'object') &&
                    (data.State && data.State.Running)){
                    cb0(null);
                } else {
                    const newErr = new Error('Not running yet');
                    newErr.data = data;
                    cb0(newErr);
                }
            }
        });
    };

    myUtils.retryWithDelay(waitForRunningImpl, RUNNING_MAX_TIMES,
                           RUNNING_DELAY_RETRY, cb);
};

exports.newInstance = async function($, spec) {
    try {
        const that = genPlug.create($, spec);
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
            workingDir = spec.env.workingDir;
        }

        const cmdArray = (typeof(spec.env.cmdArray) === 'string') ?
            JSON.parse(spec.env.cmdArray) :
            spec.env.cmdArray;
        assert.ok(Array.isArray(cmdArray),
                  "'spec.env.cmdArray' is not an array");

        var outStream = null;
        if (spec.env.outputFile) {
            outStream = fs.createWriteStream(spec.env.outputFile);
        }

        const checkServices = function() {
            if (Array.isArray(spec.env.services)) {
                spec.env.services.forEach(function(x) {
                    if (typeof $._.$[x] !== 'object') {
                        throw new Error('Service: ' + x + ' not active');
                    }
                });
            }
        };

        checkServices();


        const startContainer = function(cb0) {
            const cb1 = callJustOnce($, cb0);
            const docker = $._.$.docker.cli;

            const pullImage = function(image, cb1) {
                const options = {};
                if (spec.env.registryUsername && spec.env.registryPassword) {
                    const auth = {
                        username: spec.env.registryUsername,
                        password: spec.env.registryPassword
                    };
                    options.authconfig = auth;
                }
                $._.$.log && $._.$.log.debug('PULLING image: ' + image);
                docker.pull(spec.env.image, options, function (err, stream) {
                    function onFinished(err, output) {
                        if (err) {
                            const str = myUtils.errToPrettyStr(err);
                            $._.$.log && $._.$.log.warn(str);
                        }
                        $._.$.log && $._.$.log.debug(output);
                        that.__ca_shutdown__(null, cb1);
                    }
                    if (err) {
                        const str = myUtils.errToPrettyStr(err);
                        $._.$.log && $._.$.log.warn(str);
                        that.__ca_shutdown__(null, cb1);
                    } else {
                        docker.modem.followProgress(stream, onFinished);
                    }
                });
            };


            const createOptions = {
                Hostname: spec.env.hostname
            };
            createOptions.name = spec.env.containerNameSuffix ?
                spec.name + '-' + spec.env.containerNameSuffix :
                spec.name;

            //Env

            createOptions.Env = (createOptions.Env ? createOptions.Env : []);
            const props = (spec.env.props &&
                           (typeof spec.env.props === 'object')) ?
                spec.env.props :
                {};

            Object.keys(props).forEach(function(x) {
                var p = props[x];
                p = (typeof p === 'string' ? p : JSON.stringify(p));
                createOptions.Env.push(x + '=' + p);
            });

            // add dynamic property to env
            if (typeof spec.env.envProp === 'string') {
                const envPropArray = spec.env.envProp.split('=');
                if (envPropArray.length === 2) {
                    createOptions.Env.push(spec.env.envProp);
                } else {
                    $._.$.log && $._.$.log.error('Ignoring invalid property ' +
                                                 spec.env.envProp);
                }
            }

            if (workingDir) {
                createOptions.WorkingDir = workingDir;
            }

            const hostConfig = {
                Privileged: spec.env.privileged
            };

            // Volumes

            hostConfig.Binds = (hostConfig.Binds ? hostConfig.Binds : []);
            const volumes = spec.env.volumes || [];
            volumes.forEach(function(x) {
                hostConfig.Binds.push(x.source + ':' + x.destination);
            });

            // Network

            const firstNetwork = Array.isArray(spec.env.networks) ?
                spec.env.networks[0] :
                null;

            hostConfig.NetworkMode = firstNetwork ?
                $._.$[firstNetwork].getName() :
                'bridge';

            hostConfig.PortBindings = hostConfig.PortBindings ?
                hostConfig.PortBindings :
                {};

            createOptions.ExposedPorts = createOptions.ExposedPorts ?
                createOptions.ExposedPorts :
                {};

            const ports = spec.env.ports || [];
            ports.forEach(function(x) {
                createOptions.ExposedPorts['' + x.containerPort + '/tcp'] = {};
                hostConfig.PortBindings['' + x.containerPort + '/tcp'] =
                    [{'HostPort': '' + x.hostPort, 'HostIp': x.hostIp}];
            });

            if (Array.isArray(spec.env.networkAlias)) {
                const alias = spec.env.networkAlias.join('-');
                const networkName = hostConfig.NetworkMode;
                const aliasObj = {};
                aliasObj[networkName] = {Aliases: [alias]};
                createOptions.NetworkingConfig = {
                    EndpointsConfig: aliasObj
                };
            }

            createOptions.HostConfig = hostConfig;
            const job = docker.run(
                spec.env.image, cmdArray, null, createOptions,
                function (err) {
                    if (err) {
                        if (err.statusCode === 404) {
                            pullImage(spec.env.image, cb1);
                        } else {
                            const str = myUtils.errToPrettyStr(err);
                            $._.$.log && $._.$.log.warn(str);
                            that.__ca_shutdown__(null, cb1);
                        }
                    } else {
                        /* Container has finished, ensure
                         * that we are shutdown.
                         */
                        that.__ca_shutdown__(null, cb1);
                    }
                }
            );

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
                            const dropFirst = spec.env.networks.slice(1);
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
                    stream.pipe(outStream, {end: true});
                } else {
                    stream.pipe(process.stdout); // don't close stdout
                }
            });
        };

        const super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb0) {
            super__ca_shutdown__(data, function(err) {
                if (err) {
                    cb0(err);
                } else {
                    if (container) {
                        const oldContainer = container;
                        container = null;
                        oldContainer
                            .stop({t: STOP_TO_KILL_DELAY}, function(error) {
                                if (error) {
                                    $._.$.log && $._.$.log.debug(
                                        'Error stopping:' +
                                            myUtils.errToPrettyStr(error)
                                    );
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

        const p = new Promise((resolve) => {
            try {
                startContainer(function(err) {
                    if (err) {
                        resolve([err]);
                    } else {
                        resolve([null, that]);
                    }
                });
            } catch (err) {
                resolve([err]);
            }
        });

        return p;
    } catch (err) {
        return [err];
    }
};
