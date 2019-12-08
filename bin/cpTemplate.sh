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

mkdir -p ${OUT_DIR}

docker run -u $(id -u):$(id -g) -v ${OUT_DIR}:/out ${SRC_IMAGE} ${TEMPLATE_DIR} /out
