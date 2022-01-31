# Caf.js

Co-design cloud assistants with your web app and IoT devices.

See https://www.cafjs.com

## Command Line Tools

To setup see {@link external:caf} (https://cafjs.github.io/api/caf/index.html).

The wrapper tool `cafjs` has subcommands of the form:
```
    cafjs <command> <commandOptions> arg1 arg2...
```
The `commandOptions` always start with `--`, and are passed unchanged to the underlying tools. They are mostly for power users.

The other arguments, e.g., `arg1`, `arg2`, are ordered. Positional arguments can always be replaced with equivalent `commandOptions`. However, when the same option is specified with conflicting values, the result is undefined.


#### `cafjs run  <run_options> <appLocalName> [appWorkingDir] [host/app Vol]`

Starts a simulated Cloud to run your app. Uses separate Docker containers for a HAProxy-based http router, a Redis backend, and supporting services for authentication, managing CAs, or registering devices.

Two common use cases of `cafjs run`:

*  *Quick prototyping mode*: when creating a fresh container image each time is too expensive. Instead, build the app outside the container (`cafjs build`), and `cafjs run` will mount the host directory in a generic container image to run it.
*  *Validation mode*: create a container image with your app (`cafjs mkImage`), and test locally before deploying to the Cloud.

The `run_options` to `cafjs run` are:

* `--appImage <string>` Container image with your app (*validation mode* only).
* `--appLocalName <string>` A local name for your app. The owner is always `root`.
* `--appWorkingDir <string>` The working directory for your app inside the container (*quick prototyping mode* only). Defaults to `$PWD`.
* `--hostVolume <string>` The host directory made visible inside the container (*quick prototyping mode* only). Defaults to `$HOME`.
* `--appVolume <string>` The internal container directory where the `hostVolume` is mounted (*quick prototyping mode* only). Defaults to `$HOME`.
* `--ipAddress <string>` The network interface for the service. Defaults to `localhost`.
* `--port <number>` The port number for the service. Defaults to port 80.
* `--debugApplication` (or just `-d`) Start the node debugger listening on host port 9229 (app only).

For example, in *Quick prototyping mode*:
```
    cd $HOME/caf/apps/caf_helloworld; cafjs build; cafjs run helloworld
```
and in *Validation mode*:
```
    cafjs mkImage $HOME/caf/apps/caf_helloworld gcr.io/cafjs-k8/root-helloworld
    cafjs run --appImage gcr.io/cafjs-k8/root-helloworld helloworld
```

Some browser features, such as the Web Bluetooth API, are only enabled with https or http with `localhost`, and will not work with a `.vcap.me` suffix. A solution in Chrome is to directly access the app with the URL `http://root-myappname.localhost:3003`. This URL should also include a valid token, e.g., obtained from the iframe app URL. A USB-connected Android phone can also access this protected APIs by enabling port forwarding in the Chrome debugger.

#### `cafjs build`

Wrapper to `yarn` to build an application in the current directory using local dependencies. It assumes yarn workspaces, and a target task `build` in `package.json`.

#### `cafjs generate <generate_options> <appName> [target] [appDir] [appConfig]`

Creates an application skeleton using the following `target` of increasing app complexity:

* `cloud`: Simple CA with a command line interface.

* `web` (or `default`): Add a React+Redux web frontend to `cloud`.

* `iot`: Add support for an iot device, e.g., a Rasperry Pi, to `web`.

* `iotbrowser`: Add support for an iot device emulated in the browser, to `iot`.

* `vr`: Add a virtual reality interface to `iot` using Aframe.

Note that `target` defaults to `web`.

The `generate_options` to `cafjs generate` are:

* `--templateImage <string>` An optional Docker image that contains the template targets. It defaults to `gcr.io/cafjs-k8/root-template`. See the example in https://github.com/cafjs/caf_template.git to create your own. Custom images could enable new values for the `target` argument.

The argument `<appName>` is the name of your new application.

`<appDir>` is the directory where the app will be written (defaults to `$PWD`).

`<appConfig>` is a file with extra properties to instantiate the app template. It defaults to `generate.json` in the `caf_dcinabox/bin` directory. It leverages the `Caf.js` standard preprocessing of json component descriptions, so that it can default to system environment properties.

#### `cafjs reset`

Brute force clean up of both containers and networks.

A reset for a running application is also triggered after two `Control-C` keystrokes. A single `Control-C` triggers a gentle, but slower, shutdown.

#### `cafjs update`

Pulls up-to-date versions of the core Docker images.

#### `cafjs mkImage [--gitpush] <src> <imageName>`

Creates a Docker image with the app. The arguments are the app directory and the image name.

An optional argument `--gitpush` emulates the automated building of the image when we commit changes/tags to a properly configured github repository. This build uses a standard base image with the framework, and directly calls `docker build -f Dockerfile.gh`. See the file `Dockerfile.gh` in `caf_helloworld` for an example.

#### `cafjs device <device_options> <deviceId>`

Simulates a device that access a CA. It uses `qemu-arm-static` to execute ARM instructions on your laptop or VM. This enables testing or building Docker images for the Raspberry Pi anywhere, even with modules using native extensions. No more cross-compilation mess!

The (Linux) host should have `binfmt` enabled and properly configured. In Ubuntu just install the packages `qemu-user-static` and `binfmt-support`.

The execution speed is not that bad, mostly because `qemu-arm-static` only emulates the application, and not the OS (i.e., the I/O). A CPU core of my laptop is roughly the same as an RPi 2 CPU core.

Many applications for the RPi are not CPU intensive, and it is possible to pack about a hundred simulated devices in a large VM. This simplifies stress testing in a Cloud-only environment.

What about RPi I/O, like GPIO pins? For example, the `caf_rpi_gpio` package uses local files and `inotify` to mock GPIO pins.

Simulating a device will create two containers:

* A privileged container that manages apps, providing tokens for single sign-on, or building images locally. Its corresponding CA is an instance of the `root-gadget` application. See package `extra/caf_gadget_daemon` for details.
* An application container to run your app.

The `device_options` to `cafjs device` are:

* `--deviceId <string>`: a name for this device of the form `<owner>-<caLocalName>`, for example, `foo-device1`. The user `foo` is always present with password `bar`.
* `--password <string>`: a password to obtain authentication tokens. This argument is optional because the default password is valid for user `foo`.
* `--rootDir <string>`: the configuration root directory. It defaults to `/tmp`. To support multiple devices, `cafjs` creates subdirectories with the device name, e.g., `/tmp/foo-device1/config`.
* `--appSuffix <string>`: the URL suffix for the Cloud services. It defaults to `vcap.me`. If set to a non-local suffix, the protocol switches to `https`, e.g., `https://root-accounts.cafjs.com`. This allows the connection of a simulated device to a service deployed in the Cloud.
* `--ipAddress <string>` The network interface for the service. Defaults to `localhost`.
* `--port <number>` The port number for the service. Defaults to port 80.
* `--debugApplication` (or just `-d`) Start the node debugger listening on host port 9230 (app only).

#### `cafjs mkIoTImage <appLocalName> [privileged:boolean]`

This command is not commonly used because `cafjs device` creates device container images when needed.

To execute this command we need the app running (see `cafjs run` above). `cafjs mkIoTImage` pretends to be a manager container, downloads a tar file with the app, and creates the device container image.


#### `cafjs help [command]`

Prints a help summary, or details of any of the above commands.


### Putting it all together: Workflows with a simulated device

#### Let's start in *quick prototyping mode*

First, we build and run an IoT `Caf.js` application:
```
    cd $HOME/caf/apps/caf_hellorpi; cafjs build; cafjs run hellorpi
```
Login with a browser for user `foo`, password `bar`, and URL `http://root-launcher.vcap.me`.

Create a gadget CA instance to manage the device `device1` using the main menu. The application publisher is `root`, application name `gadget`, and CA name `device1`. Choose the target application name `root-hellorpi` and press the `update` button. Ignore the `No token` warning, the token propagates with the next step.

Create another CA instance, but this time for the application: owner `root`, local name `hellorpi`, and CA name `device1`, i.e., the previous device name.

And now we are ready to start in debug mode the simulated device, i.e., with `-d`, so that we can see pin changes in the console:
```
    cafjs device -d foo-device1
```
This command first builds the device app image using the ARM emulator and, after a few minutes, the main loop should start reporting device status.

In the browser, choose the `hellorpi` app and press the `Do it!` button. The output log should show the default pin turned on for about a second.

#### And now in *validation mode*

Build the container image, and run the app with a simulated device:
```
    cd $HOME/caf/apps/caf_hellorpi
    cafjs mkImage . gcr.io/cafjs-k8/root-hellorpi
    cafjs run --appImage gcr.io/cafjs-k8/root-hellorpi hellorpi
    cafjs device -d foo-device1
```

### Local multi-host deployment

Pick an external network interface for the service. For example, if `192.168.1.15` is the address of `wlan0` in my laptop:
```
    cafjs run --appImage gcr.io/cafjs-k8/root-hellorpi --ipAddress 192.168.1.15 --port 8080 hellorpi
```
and to connect a simulated device running in a different host:
```
    cafjs device -d --ipAddress 192.168.1.15 --port 8080 --password bar foo-device1
```

Note that the URL for the service changes to
```
    http://root-launcher.192.168.1.15.xip.io:8080
```
where `xip.io` provides a DNS wildcard domain that maps `whatever.192.168.1.15.xip.io` to my IP address `192.168.1.15`.

Multi-host deployments can also connect to real devices by using the previous URL. Some devices are hard to mock...
