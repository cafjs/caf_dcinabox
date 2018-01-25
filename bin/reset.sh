#!/bin/bash
ALL=`docker ps -af name=root- -q`
if [ "$ALL" != "" ]; then
    docker rm -f ${ALL}
fi

docker network rm vcap.me 2> /dev/null
exit 0
