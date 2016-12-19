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
 * Configures a simulated device.
 *
 * Properties:
 *
 *      { accountsURL: string, appPublisher: string, appLocalName: string,
 *        deviceId: string, password: string=, configVolume: string}
 *
 * where:
 *
 * * `accountsURL`: the URL of the authentication service.
 * * `appPublisher`: publisher of the app.
 * * `appLocalName`: local name of the app that manages the device.
 * * `deviceId`: a name for the device of the form `<owner>-<deviceName>`.
 * * `password`: a password to authenticate the device when there is no token.
 * * `configVolume`: a host volume with device configuration, e.g., a token.
 *
 *
 * @module caf_dcinabox/plug_device
 * @augments external:caf_components/gen_plug
 *
 */

var assert = require('assert');
var caf_core =  require('caf_core');
var caf_comp = caf_core.caf_components;
var json_rpc = caf_core.caf_transport.json_rpc;
var caf_cli = caf_core.caf_cli;
var srpClient = require('caf_srp').client;

var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;
var mkdirp = require('mkdirp');
var fs = require('fs');
var path = require('path');

exports.newInstance = function($, spec, cb) {
    try {
        var that = genPlug.constructor($, spec);

        $._.$.log && $._.$.log.debug('New device plug');

        assert.equal(typeof spec.env.accountsURL, 'string',
                     "'spec.env.accountsURL' not a string");

        assert.equal(typeof spec.env.appPublisher , 'string',
                     "'spec.env.appPublisher' not a string");

        assert.equal(typeof spec.env.appLocalName , 'string',
                     "'spec.env.appLocalName' not a string");

        assert.equal(typeof spec.env.deviceId , 'string',
                     "'spec.env.deviceId' not a string");

        assert.equal(typeof spec.env.password , 'string',
                     "'spec.env.password' not a string");

        assert.equal(typeof spec.env.configVolume , 'string',
                     "'spec.env.configVolume' not a string");

        mkdirp.sync(spec.env.configVolume);

        var splitId = json_rpc.splitName(spec.env.deviceId);
        assert.equal(splitId.length, 2, 'Invalid deviceId');

        async.waterfall([
            function(cb0) {
                var specAll = {
                    log: function(x) {
                        $._.$.log && $._.$.log.debug(x);
                    },
                    securityClient: srpClient,
                    accountsURL: spec.env.accountsURL,
                    password: spec.env.password,
                    from: spec.env.deviceId,
                    //        durationInSec: spec.env.durationInSec,
                    appLocalName : spec.env.appLocalName,
                    appPublisher : spec.env.appPublisher,
                    unrestrictedToken: false
                };

                var tf = caf_cli.TokenFactory(specAll);
                tf.newToken(null, cb0);
            },
            function(token, cb0) {
                fs.writeFile(path.join(spec.env.configVolume, 'token'), token,
                             cb0);
            }
        ], function (err) {
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
