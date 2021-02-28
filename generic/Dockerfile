# VERSION 0.1
# DOCKER-VERSION  1.7.0
# AUTHOR:         Antonio Lain <antlai@cafjs.com>
# DESCRIPTION:    Cloud Assistants application hellodiffie
# TO_BUILD:       docker build --rm -t gcr.io/cafjs-k8/root-generic .
# TO_RUN:         to use dcinabox with a local directory build, e.g.,
# dcinabox.js --appLocalName helloworld --appImage gcr.io/cafjs-k8/root-generic --appWorkingDir $PWD --hostVolume $HOME --appVolume $HOME

FROM node:14

EXPOSE 3000


ENTRYPOINT ["node"]

CMD [ "./index.js" ]
