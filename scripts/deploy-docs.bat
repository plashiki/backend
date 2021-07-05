@echo off
set cwd=%cd%

call npm run build:docs

cd docs/.vuepress/dist

git init
git add -A
git commit -m deploy
git push -f https://github.com/plashiki/plashiki.github.io.git master

cd %cwd%
