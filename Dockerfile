# VERSION 0.1
# DOCKER-VERSION  1.9.0
# AUTHOR:         Antonio Lain <antlai@cafjs.com>
# DESCRIPTION:    Cloud Assistants  debugging tool: Data Center In A Box (dcinabox)
# TO_BUILD:       docker build --rm -t registry.cafjs.com:32000/root-dcinabox .
# TO_RUN:         docker run  --privileged -v /var/run/docker.sock:/var/run/docker.sock  -v /usr/bin/docker:/bin/docker   registry.cafjs.com:32000/root-dcinabox  --appLocalName application --appImage registry.cafjs.com:32000/root-helloworld
 
FROM node:0.10

EXPOSE 3000

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY . /usr/src/app

RUN  . /usr/src/app/http_proxy_build;  rm -fr node_modules/*; npm install --production  . ; npm run build

ENTRYPOINT [ "./dcinabox.js"]
