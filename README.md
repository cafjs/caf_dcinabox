# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app and IoT devices.

See http://www.cafjs.com

## CAF Command Line Tools

To setup see {@link external:caf} (https://cafjs.github.io/api/caf/index.html).

The wrapper tool `cafjs` has subcommands of the form:

    cafjs <command> <commandOptions> arg1 arg2...

The `commandOptions` always start with `--`, and are passed unchanged to the underlying tools. They are mostly for power users.

The other arguments, e.g., `arg1`, `arg2`, are ordered. Positional arguments can always be replaced with equivalent `commandOptions`. However, when the same option is specified with conflicting values, the result is undefined.


#### `cafjs run  <run_options> <appLocalName> [appWorkingDir] [host/app Vol]`

Starts a simulated cloud to run your app. Uses separate Docker containers for a HAProxy-based http router, a Redis backend, and supporting apps for authentication, managing CAs, or registering devices.

The application can also be directly accessed using the http HOST `localhost`, i.e.,`http://localhost:<externalPort>`. Some browser features are only enabled with https or http with `localhost`, i.e., will not work with `*.vcap.me`. A valid token in the URL is required.

Two common usecases of `cafjs run`:

*  *Quick prototyping mode*: when creating a fresh container image is too expensive. Instead, build the app outside the container (`cafjs build`), and mount the host directory in a generic container image.
*  *Validation mode*: create a container image with your app  (`cafjs mkImage`), and test locally before cloud deployment.

The `run_options` to `cafjs run` are:

* `--appImage <string>` Container image with your app (*validation mode* only).
* `--appLocalName <string>` A local name for your app. The owner is always `root`.
* `--appWorkingDir <string>` The working directory for your app inside the container (*quick prototyping mode* only). Defaults to `$PWD`.
* `--hostVolume <string>` The host directory made visible inside the container (*quick prototyping mode* only). Defaults to `$HOME`.
* `--appVolume <string>` The internal container directory where the `hostVolume` is mounted (*quick prototyping mode* only). Defaults to `$HOME`.
* `--ipAddress <string>` The network interface for the service. Defaults to `localhost`.
* `--port <number>` The port number for the service. Defaults to port 80.

For example, in *Quick prototyping mode*:

    cd $HOME/caf/apps/caf_helloworld; cafjs build; cafjs run helloworld

and in *Validation mode*:

    cafjs mkImage $HOME/caf/apps/caf_helloworld gcr.io/cafjs-k8/root-helloworld
    cafjs run --appImage gcr.io/cafjs-k8/root-helloworld helloworld


#### `cafjs build`

Wrapper to `yarn` to build an application in the current directory using local dependencies. It assumes yarn workspaces, and a target task `build` in `package.json`.


#### `cafjs reset`

Brute force clean up of both containers and networks.

A reset for a running application is also triggered after two `Control-C` keystrokes. A single `Control-C` triggers a gentle, but slower, shutdown.

#### `cafjs mkImage <src> <imageName>`

Creates a Docker image with the app. The arguments are the app directory and the image name.

#### `cafjs device <device_options> <deviceId>`

Simulates a device that access a CA. It uses `qemu-arm-static` to execute ARM instructions on your laptop or VM. This enables testing or building Docker images for the Raspberry Pi anywhere, even with modules using native extensions. No more cross-compilation nightmares!

The (Linux) host should have `binfmt` enabled and properly configured. In Ubuntu just install the packages `qemu-user-static` and `binfmt-support`.

The execution speed is not that bad, mostly because `qemu-arm-static` only emulates the application, and not the OS (i.e., the I/O). A core of my laptop is roughly the same as an RPi 2 core.

Many applications in the RPi are not CPU intensive, and it is possible to pack about a hundred simulated devices in a large VM. This simplifies stress testing, CI, or debugging, in a Cloud-only environment.

What about RPi I/O, like GPIO pins? For example, the `caf_rpi_gpio` package uses files and `inotify` to mock GPIO pins.

Simulating a device needs two running containers:

* A privileged, manager container that switches/updates apps, provides tokens for single sign-on, or builds images locally. Its CA is an instance of the `root-gadget` application. See package `extra/caf_gadget_daemon` for details.
* An application container, which could be privileged or unprivileged depending on the application needs. We use different base container images for each case, and the manager container starts them with different security profiles.

The manager container transparently builds the app image when missing, or it has changed. This typicaly takes about a minute.

The `device_options` to `cafjs device` are:

* `--deviceId <string>`: a name for this device of the form `<owner>-<caLocalName>`, for example, `foo-device1`. The user `foo` is always present with password `pleasechange`.
* `--password <string>`: a password to obtain authentication tokens. This argument is optional because the default password is valid for user `foo`.
* `--rootDir <string>`: the host configuration root directory. It defaults to `/tmp`. To support multiple devices, `cafjs` creates subdirectories with the device name, e.g., `/tmp/foo-device1/config`.
* `--appSuffix <string>`: the URL suffix for the Cloud services. It defaults to `vcap.me`. If set to a non-local suffix, the protocol switches to `https`, e.g., `https://root-accounts.cafjs.com`. This allows to simulate devices connected to a Cloud service.
* `--ipAddress <string>` The network interface for the service. Defaults to `localhost`.
* `--port <number>` The port number for the service. Defaults to port 80.


#### `cafjs mkIoTImage <appLocalName> [privileged:boolean]`

This command is not commonly used because `cafjs device` transparently creates device container images.

To execute this command we need the app running (see `cafjs run` above). `cafjs mkIoTImage` pretends to be a manager container, downloads a tar file with the app, and creates the device container image.


#### `cafjs help [command]`

Prints a help summary, or details of any of the above commands.


### Putting it all together: Workflows with a simulated device

#### Let's start in *quick prototyping mode*

First, we build and run an IoT CAF application:

    cd $HOME/caf/apps/caf_helloiot; cafjs build; cafjs run helloiot

Login with user `foo`, password `pleasechange`, and URL `http://root-launcher.vcap.me`.

With the browser create a CA instance for application with owner`root`, local name `helloiot`, and CA name the device name, e.g., `device1`.

Create a gadget  CA instance to manage the device `device1`. The application owner is `root`, local name `gadget`, and CA name `device1`. Configure in that app the target application as `root-helloiot` (don't click the privileged option). If `App Token Ready?` is `NO`, just go back to the `helloiot` app for `device1` to transparently register the token with the manager.

And now we are ready to start the device:

    cafjs device foo-device1

It builds the device image, and after about a minute, the main loop should be reporting information from the CA.

In the browser, choosing the `helloiot` app again, we can configure a pin `11` as input, and a pin `12` as `Output`, and change the pin `12` value. The simulated device main loop should print the new values. We can also interact with the mocked gpio pins using files:

    docker exec -ti root-helloiot-foo-device1 /bin/ash
    cat /tmp/gpio/out/gpio12
    echo 1 > /tmp/gpio/in/gpio11

and the browser should now show the new input for pin `11`.

#### And now in *validation mode*

Build the container image, and run the app and device:

    cd $HOME/caf/apps/caf_helloiot
    cafjs mkImage . gcr.io/cafjs-k8/root-helloiot
    cafjs run --appImage gcr.io/cafjs-k8/root-helloiot helloiot
    cafjs device foo-device1

The setup is similar to the previous case. In fact, since the `Redis` container persists changes in a host volume, all your CAs should still be there.


### Local multi-host deployment

Use an external network interface for the service. For example, if `192.168.1.15` is the address of `wlan0` in my laptop:

    cafjs run --appImage gcr.io/cafjs-k8/root-helloiot --ipAddress 192.168.1.15 --port 8080 helloiot

and, in a different computer connected to the same wireless LAN, type

    cafjs device --ipAddress 192.168.1.15 --port 8080 --password pleasechange foo-device1

to simulate a device that is connected to the service in my laptop using the wireless LAN.

Note that the URL for the service is:

    http://root-launcher.192.168.1.15.xip.io:8080

the trick is that `xip.io` provides a DNS wildcard domain that maps `whatever.192.168.1.15.xip.io` to my IP address `192.168.1.15`.

Also, using that URL, we can connect real devices on the WLAN.
