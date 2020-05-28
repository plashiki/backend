#!/bin/sh

set -e
npm run build:docs
cd docs/.vuepress/dist

git init
git add -A
git commit -m 'deploy'
git push -f git@github.com:plashiki/plashiki.github.io.git master
cd -
