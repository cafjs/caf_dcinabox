#!/bin/bash
pushd $1
docker build -f Dockerfile.gh . -t $2
popd
