#!/bin/bash
set -e

echo build.sh executing as user `whoami`
npm prune
npm install || npm install --force

# Don't need all the dev dependencies, so skip some of them

npm install grunt-handlebars-requirejs@0.0.3 grunt-requirejs@0.3.1 grunt-contrib-less@0.3.2 grunt-contrib-copy@0.3.2 grunt-exec@0.3.0 grunt-clean@0.3.0 grunt@0.3.17 jsonlint

./node_modules/.bin/grunt process
