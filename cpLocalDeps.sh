#!/bin/bash
DIR_EXEC="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
set -e
echo "CURRENT PATH"
echo $PWD
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
tar cf all2.tar  -T $tmpFile
tar chf all.tar --exclude=.bin .
tar --concatenate --file=all.tar all2.tar

#need to shrinkwrap without links.
# caf_* libraries in production mode have no cyclic deps, and we just
# use tar -h (follow links) to resolve them.
tmpDir=/tmp/yy-"$RANDOM"."$RANDOM"
mkdir -p ${tmpDir}
tar xf all.tar -C ${tmpDir} 
pushd ${tmpDir}
npm shrinkwrap
tar cf all2.tar  -T $tmpFile
tar chf all.tar --exclude=.bin node_modules/ npm-shrinkwrap.json
tar --concatenate --file=all.tar all2.tar
popd
cp ${tmpDir}/all.tar .
rm -fr ${tmpDir}

${DIR_EXEC}/dedupe.js --src all.tar --dst alldedupe.tar
gzip alldedupe.tar
mv alldedupe.tar.gz all.tgz
rm -f all.tar
rm -f all2.tar $tmpFile
rm -fr node_modules/*

popd #dir
