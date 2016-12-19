#!/bin/bash
ALL=`docker ps -f name=root- -q`
if [ "$ALL" != "" ]; then
    docker rm -f ${ALL}
fi

docker network rm vcap.me 2> /dev/null
exit 0
