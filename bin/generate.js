#!/usr/bin/env node
const child_process = require('child_process');
var mustache = require('mustache');
const path = require('path');
const fs = require('fs');
const caf_core =  require('caf_core');
const caf_comp = caf_core.caf_components;
const gen_loader = caf_comp.gen_loader;
const myUtils = caf_comp.myUtils;
const glob = require('glob');
const parseArgs = require('minimist');

const DEFAULT_JSON = 'generate.json';

const DEFAUL_SCRIPT = 'cpTemplate.sh';

const usage = function() {
    console.log('Usage: generate.js --appName <string> --appDir <string>  --appConfig <string> --target <string, e.g., cloud|web|iot|vr> [--templateImage <string>]');
    process.exit(1);
};


const argv = parseArgs(process.argv.slice(2), {
    string : ['templateImage', 'appName', 'appDir', 'appConfig', 'target'],
    unknown: usage
});

if (!argv.appName || !argv.appDir) {
    usage();
}

const loader = gen_loader.create();
loader.__ca_setModules__([module]);
const props = loader.__ca_loadDescription__(argv.appConfig || DEFAULT_JSON,
                                            true,
                                            {env: {appName: argv.appName}});

const target = argv.target || props.env.target;
const cmdFull = path.resolve(__dirname, DEFAUL_SCRIPT);
const templateImage = argv.templateImage || props.env.image;
const buf = child_process.execFileSync(cmdFull, [
    argv.appDir, templateImage, target
]);

console.log(buf.toString());

const files = glob.sync(path.resolve(argv.appDir, '**/*.mustache'),
                        {dot: true});

files.forEach(function(x) {
    let template = fs.readFileSync(x, {encoding: 'utf8'});
    let rendered = mustache.render(template, props.env);
    fs.writeFileSync(x.slice(0, -9), rendered);
    fs.unlinkSync(x);
});
