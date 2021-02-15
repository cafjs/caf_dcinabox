#!/bin/sh
#DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
#npm link `${DIR}/findDepsCAF.js`
#npm link `${DIR}/findDevDepsCAF.js`
#npm install
#yarn install --ignore-optional

[ ! -d "node_modules" ] && echo "Error: Call 'cafjs install' first" && exit 1

yarn run build
