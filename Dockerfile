# VERSION 0.1
# DOCKER-VERSION  1.9.0
# AUTHOR:         Antonio Lain <antlai@cafjs.com>
# DESCRIPTION:    Cloud Assistants  debugging tool: Data Center In A Box (dcinabox)
# TO_BUILD:       cafjs mkImage . registry.cafjs.com:32000/root-dcinabox
# TO_RUN:         docker run  --privileged -v /var/run/docker.sock:/var/run/docker.sock  -v /usr/bin/docker:/bin/docker   registry.cafjs.com:32000/root-dcinabox  --appLocalName application --appImage registry.cafjs.com:32000/root-helloworld

FROM node:8

EXPOSE 3000

RUN mkdir -p /usr/src

ENV PATH="/usr/src/node_modules/.bin:${PATH}"

RUN apt-get update && apt-get install -y rsync

COPY . /usr/src

RUN  cd /usr/src/app && yarn install  --ignore-optional && cafjs build &&  yarn install --production --ignore-optional && yarn cache clean

WORKDIR /usr/src/app

ENTRYPOINT [ "./dcinabox.js"]
