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
 * Manages Docker networks.
 *
 * Properties:
 *
 *      { netName: string, alreadyCreated: boolean}
 *
 * where `netName` is the name of the internal network and if `alreadyCreated`
 * is `true` we do not attempt to create it again.
 *
 * @module caf_dcinabox/plug_network
 * @augments external:caf_components/gen_plug
 */

const assert = require('assert');
const caf_core = require('caf_core');
const caf_comp = caf_core.caf_components;
const myUtils = caf_comp.myUtils;
const genPlug = caf_comp.gen_plug;

exports.newInstance = async function($, spec) {
    try {
        const that = genPlug.create($, spec);
        var network = null;

        $._.$.log && $._.$.log.debug('New network plug');

        assert.equal(typeof spec.env.netName, 'string',
                     "'spec.env.netName' not a string");

        assert.equal(typeof spec.env.alreadyCreated, 'boolean',
                     "'spec.env.alreadyCreated' not a boolean");


        that.getName = function() {
            return spec.env.netName;
        };

        that.getID = function() {
            return (network ? network.id : null);
        };

        that.connect = function(containerId, cb0) {
            if (network) {
                network.connect({'container': containerId}, cb0);
            } else {
                cb0(new Error('no network'));
            }
        };

        const super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb0) {
            super__ca_shutdown__(data, function(err) {
                if (err) {
                    cb0(err);
                } else {
                    if (network && (!spec.env.alreadyCreated)) {
                        network.remove(function(err) {
                            network = null;
                            cb0(err);
                        });
                    } else {
                        network = null;
                        cb0(null);
                    }
                }
            });
        };

        const startNetwork = function(cb0) {
            if (spec.env.alreadyCreated) {
                $._.$.docker.cli.listNetworks(function(err, all) {
                    if (err) {
                        cb0(err);
                    } else {
                        var id = null;
                        all.forEach(function(x) {
                            if (x.Name === spec.env.netName) {
                                id = x.Id;
                            }
                        });
                        if (id) {
                            network = $._.$.docker.cli.getNetwork(id);
                            cb0(null, that);
                        } else {
                            const error = new Error('Network does not exist');
                            error.netName = spec.env.netName;
                            cb0(error);
                        }
                    }
                });
            } else {
                $._.$.docker.cli.createNetwork({
                    'name': spec.env.netName,
                    'driver': 'bridge',
                    'CheckDuplicate': true
                }, function(err, net) {
                    if (err) {
                        cb0(err);
                    } else {
                        network = net;
                        cb0(null, that);
                    }
                });
            }
        };

        const p = new Promise((resolve) => {
            try {
                startNetwork(function(err) {
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
