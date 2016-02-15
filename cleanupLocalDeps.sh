#!/bin/bash
DIR_EXEC="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
set -e
dir="$1"
dir=${dir%/}
pushd ${dir}

find . -name all.tgz | xargs rm

popd #dir
