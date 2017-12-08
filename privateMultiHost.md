# Private multi-host deployment

## Make visible  a local daemon outside a host

change suffix to a wildcard DNS resolved to your IP address

    export APP_SUFFIX=192.168.1.15.xip.io

change ip address to external interface:

    export HOST_IP=192.168.1.15

(optionally) change the port is listening to:

    export HTTP_EXTERNAL_PORT=8080

change the accounts service:

    export ACCOUNTS_URL=http://root-accounts.192.168.1.15.xip.io:8080


change the device manager service:

    export IOT_DEVICE_MANAGER_APP_URL=http://root-gadget.192.168.1.15.xip.io:8080

now start the daemon

    cafjs run <whatever>

and use the url in the browser (the host should be in the 192.168.X.X subnet)

    http://root-launcher.192.168.1.15.xip.io:8080


## Connect to a device in a different host

First generate a token (or alternatively cut/paste from device manager web page)

    docker run --rm -e ACCOUNTS_URL=http://root-accounts.192.168.1.15.xip.io:8080  -e MY_ID=foo-projector1 -e PASSWD=pleasechange -v /config-foo-projector1:/config registry.cafjs.com:32000/root-rpitoken

and then start a management daemon with that token:


    docker run -d --name=root-rpidaemon-foo-admin --restart=always -e MY_ID=foo-projector1 -v /var/run/docker.sock:/var/run/docker.sock  -v /config-foo-projector1:/config -e CONFIG_VOLUME=/config-foo-projector1 -e APP_PROTOCOL=http -e APP_SUFFIX=192.168.1.15.xip.io:8080 -e APP_DEVICES=[] registry.cafjs.com:32000/root-rpidaemon

we set `APP_DEVICES=[]` when the device is not a Raspberry Pi and has no GPIO pins...
