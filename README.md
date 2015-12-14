# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app and IoT devices.

See http://www.cafjs.com 

## CAF Data Center In A Box (debugging tool to run locally apps in containers)

Launches in your Linux desktop all the Docker containers needed to emulate the behavior of our cloud setup, so that it becomes easier to debug apps, or run then without Internet connectivity.


To start your app:

    ./dcinabox.js --appImage <your-local-app-image> --appLocalName <app-name>

for example:

    ./dcinabox.js  --appImage registry.cafjs.com:32000/root-helloworld --appLocalName application

With a browser start the launcher ( http://root-launcher.vcap.me), and login with account `foo` and password `pleasechange` (or create a new account). Note that `*.vcap.me` resolves to your local loop IP address `127.0.0.1`. Press '+' and add an instance of your app (`appPublisher` is always `root`, and the application name is the previous  `appLocalName` value). 

To stop it and clean up just control-C the previous command, and wait a couple of seconds to properly remove containers and internal networks.

Some details. We use an internal Docker network (also called `vcap.me`) so you need Docker >= 1.9. We also make visible  container ports in the host (`127.0.0.1`) using the range 3000 to 3100, and the `redis` backend in port 6380 (use `docker ps` and `docker network inspect vcap.me` to find actual port mappings, or look in `lib/dcinabox.json`). 



