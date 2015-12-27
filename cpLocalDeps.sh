#!/bin/bash

dir="$1"
links="${@:2}" 
dir=${dir%/}
tmpFile=/tmp/xx-"$RANDOM"."$RANDOM"
pushd ${dir}

rm -fr node_modules/*
rm -f npm-shrinkwrap.json

for i in $links; do
    npm link --production $i
done

npm install .


find node_modules/ -name .bin  > $tmpFile
tar cvf all2.tar  -T $tmpFile
tar cvhf all.tar --exclude=.bin node_modules/
tar --concatenate --file=all.tar all2.tar
gzip all.tar
mv all.tar.gz all.tgz
rm all2.tar $tmpFile
rm -fr node_modules/*

popd #dir
