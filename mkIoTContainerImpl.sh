#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TMP_DIR=${TMP_DIR:-'/tmp/cafjs'}
TMP_DIR=${TMP_DIR}-$1
REGISTRY_LOCAL_PREFIX=${REGISTRY_LOCAL_PREFIX:-'localhost.localdomain:5000'}
REGISTRY_USER=${REGISTRY_USER:-'root'}
APP_SUFFIX=${APP_SUFFIX:-'vcap.me'}
url=http://${REGISTRY_USER}-$1.${APP_SUFFIX}/iot.tgz

id=`curl -sI $url | grep ETag | awk '{print $2}' | sed s/\"//g | sed s#W/##g | sed s/+/0/g | sed s#/#0#g `
id="${id/$'\r'/}"
container=${REGISTRY_LOCAL_PREFIX}/${REGISTRY_USER}-$1:${id}$2
echo $container

rm -fr ${TMP_DIR}
mkdir -p  ${TMP_DIR}
curl -s $url > ${TMP_DIR}/iot.tgz
pushd ${TMP_DIR}
tar xvf iot.tgz
${DIR}/mkContainer.js --src ${TMP_DIR}/package --container ${container}
popd
