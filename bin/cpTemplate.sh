#!/bin/sh

OUT_DIR=${OUT_DIR:-$PWD}
OUT_DIR=${1:-${OUT_DIR}}
echo $OUT_DIR

SRC_IMAGE=${SRC_IMAGE:-gcr.io/cafjs-k8/root-template:latest}
SRC_IMAGE=${2:-${SRC_IMAGE}}
echo $SRC_IMAGE

TEMPLATE_DIR=${TEMPLATE_DIR:-default}
TEMPLATE_DIR=${3:-${TEMPLATE_DIR}}
echo $TEMPLATE_DIR

UPDATE_IMAGE=${UPDATE_IMAGE:-false}
UPDATE_IMAGE=${4:-${UPDATE_IMAGE}}

if [ "$UPDATE_IMAGE" = true ]
then
   docker pull ${SRC_IMAGE}
fi


mkdir -p ${OUT_DIR}

docker run --rm -u $(id -u):$(id -g) -v ${OUT_DIR}:/out ${SRC_IMAGE} ${TEMPLATE_DIR} /out
