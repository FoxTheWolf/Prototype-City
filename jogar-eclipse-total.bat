@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem o eclipse lunar total de 20/02/2008 (totalidade 22:05-22:55 no relogio do jogo): um jogo NOVO nessa hora (clique em NEW GAME, nao em CONTINUE; olhe para o sudeste, alto)
call npm run build && npx electron electron/main.cjs new at=2008-02-20T22:15
