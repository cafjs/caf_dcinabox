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
 * Connects with a local Docker daemon.
 *
 * Properties:
 *
 *       {dockerSocket: string}
 *
 * where `dockerSocket` is the socket name to connect to the daemon.
 *
 * @module caf_dcinabox/plug_docker
 * @augments external:caf_components/gen_plug
 *
 */

const assert = require('assert');
const Docker = require('dockerode');
const caf_core = require('caf_core');
const caf_comp = caf_core.caf_components;
const genPlug = caf_comp.gen_plug;

exports.newInstance = async function($, spec) {
    try {
        const that = genPlug.create($, spec);

        $._.$.log && $._.$.log.debug('New Docker plug');


        assert.equal(typeof spec.env.dockerSocket, 'string',
                     "'spec.env.dockerSocket' not a string");

        const docker = new Docker({socketPath: spec.env.dockerSocket});

        that.cli = docker;

        return [null, that];
    } catch (err) {
        return [err];
    }
};
