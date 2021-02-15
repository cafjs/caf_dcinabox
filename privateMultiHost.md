# Private multi-host deployment

## Make visible  a local daemon outside a host

    cafjs run --appImage gcr.io/cafjs-k8/root-helloiot --ipAddress 192.168.1.15 --port 8080 helloiot

and internally this is what happens:

change suffix to a wildcard DNS resolved to your IP address

    export APP_SUFFIX=192.168.1.15.xip.io

change ip address to external interface:

    export HOST_IP=192.168.1.15

(optionally) change the port is listening to:

    export HTTP_EXTERNAL_PORT=8080

change the internal http port from the default 3000 to:

    export HTTP_INTERNAL_PORT=null (when HTTP_EXTERNAL_PORT was not set) or
    export HTTP_INTERNAL_PORT=HTTP_EXTERNAL_PORT

change the accounts service:

    export ACCOUNTS_URL=http://root-accounts.192.168.1.15.xip.io:8080


change the device manager service:

    export IOT_DEVICE_MANAGER_APP_URL=http://root-gadget.192.168.1.15.xip.io:8080

and run the app with vanilla `cafjs run`


use the url in the browser (the host should be in the 192.168.X.X subnet)

    http://root-launcher.192.168.1.15.xip.io:8080


## Connect a device running in a different host

    cafjs device --ipAddress 192.168.1.15 --port 8080 --password bar foo-device1

and this is equivalent to:

generates a token (or alternatively cut/paste from device manager web page)

    docker run --rm -e ACCOUNTS_URL=http://root-accounts.192.168.1.15.xip.io:8080  -e MY_ID=foo-projector1 -e PASSWD=bar -v /config-foo-projector1:/config gcr.io/cafjs-k8/root-rpitoken

and then starts a management daemon with that token:

    docker run -d --name=root-rpidaemon-foo-admin --restart=always -e MY_ID=foo-projector1 -v /var/run/docker.sock:/var/run/docker.sock  -v /config-foo-projector1:/config -e CONFIG_VOLUME=/config-foo-projector1 -e APP_PROTOCOL=http -e APP_SUFFIX=192.168.1.15.xip.io:8080 -e APP_DEVICES=[] gcr.io/cafjs-k8/root-rpidaemon

we set `APP_DEVICES=[]` when the device is not a Raspberry Pi and has no GPIO pins...
