#!/bin/bash
ALL=`docker ps -af name=root- -q`
if [ "$ALL" != "" ]; then
    docker rm -f ${ALL}
fi

docker network rm localtest.me 2> /dev/null
exit 0
