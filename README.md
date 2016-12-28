# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app and IoT devices.

See http://www.cafjs.com

## CAF Command Line Tools

To setup see {@link external:caf} (https://cafjs.github.io/api/caf/index.html).

The wrapper tool `cafjs` has subcommands of the form:

    cafjs <command> <commandOptions> arg1 arg2...

The `commandOptions` always start with `--`, and are passed unchanged to the underlying tools. They are mostly for power users.

The other arguments, e.g., `arg1`, `arg2`, are always ordered, and if one of them is optional, and missing, the ones after it cannot be present. To fix this, there are always equivalent `commandOptions` for any positional argument. If both are specified, the `commandOptions` choice has priority.


#### `cafjs run  <run_options> <appLocalName> [appWorkingDir] [host/app Vol]`

Starts a simulated cloud to run your app. Uses separate Docker containers for a HAProxy-based http router, a Redis backend, and supporting apps for authentication, managing CAs, and registering devices.

There are two scenarios:

*  In *quick prototyping mode*, we build the app outside the container (`cafjs build`) using linked local dependencies, and we just need a wrapper container that directly mounts our home directory.
* In *validation mode*, we created a self-contained container using `cafjs mkImage` and, before uploading it to the cloud service, we want to test it locally.

How to implement these two cases?

* *Quick prototyping mode* always uses the same generic image (see `generic/Dockerfile`) that does not build the project. The app working directory is in a host volume, and a consistent volume mapping ensures that symbolic links to modules still work.
* *Validation mode* creates a new image (see any of the example apps `Dockerfile`) that, as part of its build process, copies local dependencies inside the container, and builds the application.

The way to indicate to `cafjs run` that we are in *validation mode* is to specify the container image with `--appImage`. In that case, we change the default options for working directory, or host volume mounts.

The `run_options` to `cafjs run` are:

* `--appImage <string>` Container image with your app (*validation mode* only).
* `--appLocalName <string>` A local name for your app. The owner is always `root`.
* `--appWorkingDir <string>` The working directory for your app inside the container (*quick prototyping mode* only).
* `--hostVolume <string>` The host directory made visible inside the container (*quick prototyping mode* only).
* `--appVolume <string>`The internal container directory where the `hostVolume` is mounted (*quick prototyping mode* only).

In *quick prototyping mode* the positional option `appWorkingDir` defaults to `$PWD`, and the `host/appVolume` defaults to `$HOME`.

Why this defaults? In a typical node.js installation using `nvm`, linked or global modules are under `$HOME/.nvm`, and as long as your app is also within your `$HOME` directory, running it cannot get any easier:

    cd $HOME/caf/apps/caf_helloworld; cafjs build; cafjs run helloworld

What about *validation mode*? We just need the image name and the local application name:

    cafjs run --appImage registry.cafjs.com:32000/root-helloworld helloworld

#### `cafjs build`

Wrapper to `npm` to build an application in the current directory using local dependencies. It links dependent modules with prefix `caf_`, and installs the rest.

It is only needed in *quick prototyping mode*, the *validation mode* builds the app internally.

#### `cafjs reset`

Brute force clean up of both containers and networks.

A reset for a running application is also triggered after two `Control-C` keystrokes.

#### `cafjs mkImage <src> <imageName>`

Builds a Docker image with the app. The arguments are the app directory and the image name. For example, in directory `caf/apps/caf_helloworld`:

    cafjs mkImage . registry.cafjs.com:32000/root-helloworld

It copies local dependencies with the `caf_` prefix, and to ensure that no dev dependencies are used anywhere, first run again:

    ./tools/setupLinks.sh

#### `cafjs device <device_options> <deviceId>`

Simulates a device that access a CA. It uses `qemu-arm-static` to execute ARM instructions on your laptop or VM. This allows to test or build Docker images for the Raspberry Pi anywhere, even if they need node.js modules with native extensions. No more cross-compilation nightmares...

The requirement on the Linux host is that `binfmt` should be enabled. In Ubuntu just install the packages `qemu-user-static` and `binfmt-support`. Our base container images already include `qemu-arm-static`, but installing it in the host provides the correct configuration for `binfmt`.

Download Docker ARM base images with:

    ./extra/caf_rpi/setup.sh

this script will also try, and fail, to create a token for a device. Ignore this failure, `cafjs device` already generates those tokens.

The execution speed is not that bad, mostly because `qemu-arm-static` only emulates the application, and not the OS (i.e., the I/O). A core of my high-end laptop is roughly the same as a RPi 2 core.

Many applications in the RPi are not CPU intensive, and it is possible to pack a hundred simulated devices in a large VM, simplifiying stress testing, or debugging, in a Cloud-only environment.

What about RPi I/O, like GPIO pins? For example, the `caf_rpi_gpio` package uses files and `inotify` to mock GPIO pins.

A device typically has two containers running:

* A privileged, manager container that switches/updates apps, provides tokens for single sign-on, or builds images locally. Its CA is an instance of the `root-gadget` application. See package `extra/caf_gadget_daemon` for details.
* An application container that could be privileged, or not, depending on the application needs. We use different base container images for each case, and the manager container starts them with different security profiles.

The `device_options` to `cafjs device` are:

* `--deviceId <string>`: a name for this device of the form `<owner>-<caLocalName>`, for example, `foo-device1`. The user `foo` is always present with password `pleasechange`.
* `--password <string>`: a password to obtain authentication tokens. This argument is optional because the default password is valid for user `foo`.
* `--rootDir <string>`: the host configuration root directory. It defaults to `/tmp`. To allow multiple devices, we create subdirectories with the device name, e.g., `/tmp/foo-device1/config`.
* `--appSuffix <string>`: the URL suffix for the Cloud services. It defaults to `vcap.me`. If it is set, we also switch the protocol to `https`, e.g., `https://root-accounts.cafjs.com`. This allows to simulate devices directly connected to the real Cloud.

#### `cafjs mkIoTImage <appLocalName> [privileged:boolean]`

Devices build their own images locally, after downloading from the cloud a shrink-wrapped, `npm` package. The device chooses the Docker base image, and this allows supporting very different devices in a transparent way.

For example:

    wget https://root-helloiot.cafjs.com/iot.tgz; tar xvf iot.tgz

The `ETag` of that HTTP response is a cryptographic hash of the contents of that bundle, and we use it to tag the Docker images. For example, if the `ETag` field is `1ab3-dDwruH2Ccnkes2ObeJPGeQ` the image will be called:

    localhost.localdomain:5000/root-helloiot:1ab3-dDwruH2Ccnkes2ObeJPGeQ

The manager container periodically queries the Cloud for the current `ETag` value and, when it changes, it rebuilds the image and restarts the container app.

The catch is that, if we are simulating a device in development mode, some module dependencies are likely to be local-only, and the manager container will not be able to find them.

To solve this problem, we create the image with the expected name beforehand, using `cafjs mkIoTImage`. Then, the manager container will not try to build it again.

In order to execute this command we need the app running (see `cafjs run` above). `cafjs mkIoTImage` pretends to be a manager container, downloads the bundle and the `ETag`, and builds the container with local dependencies. For example, if the previous app is not privileged, the command is:

    cafjs mkIoTImage helloiot false

`mkIotImage` is slower than `mkImage` because it has to emulate ARM instructions with qemu, as we mentioned above. It takes about 100 sec to build `caf_helloiot` in my laptop.

#### `cafjs help [command]`

Prints a help summary, or details of any of the above commands.


### Putting it all together: Workflows with a simulated device

#### Let's start in *quick prototyping mode*

First, we build and run an IoT CAF application:

    cd $HOME/caf/apps/caf_helloiot; cafjs build; cafjs run helloiot

Login with user `foo`, password `pleasechange`, and URL `http://root-launcher.vcap.me`.

With the browser create a CA instance for application with owner`root`, local name `helloiot`, and CA name the device name, e.g., `device1`.

Create a gadget  CA instance to manage the device `device1`. The application owner is `root`, local name `gadget`, and CA name `device1`. Configure in that app the target application as `root-helloiot` (don't click the privileged option). If `App Token Ready?` is `NO`, just go back to the `helloiot` app for `device1` to transparently register the token with the manager.

Then, we need to make sure that the IoT image for the device is pre-built with the local dependencies:

    cafjs mkIoTImage helloiot false

And now we are ready to start the device:

    cafjs device foo-device1

It should not try to build again the image, and after about 30 seconds the main loop should be reporting information from the CA.

In the browser, choosing the `helloiot` app again, we can configure a pin `11` as input, and a pin `12` as `Output`, and change the pin `12` value. The simulated device main loop should print the new values. We can also interact with the mocked gpio pins using files:

    docker exec -ti root-helloiot-foo-device1 /bin/ash
    cat /tmp/gpio/out/gpio12
    echo 1 > /tmp/gpio/in/gpio11

and the browser should now show the new input for pin `11`.

#### And now in *validation mode*

Build the container image, and run the app:

    cd $HOME/caf/apps/caf_helloiot
    cafjs mkImage . registry.cafjs.com:32000/root-helloiot
    cafjs run --appImage registry.cafjs.com:32000/root-helloiot helloiot

Then, before publishing the app in the cloud service, it is wise to ensure that all the local dependencies of the IoT device app have been published, e.g., `npm publish` or to `github`, and devices can build their own images.

The simplest way to do this is to skip the `mkIoTImage` step, and just run the simulated device:

    cafjs device foo-device1

If the device image is missing (use `docker rmi` to delete it, if needed), the manager container will try to build it using only external dependencies. It takes about 2 minutes in my laptop.

The rest of the setup is similar to the previous case. In fact, since the `Redis` container persists changes in a host volume, all your CAs should still be there.
