@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem a fase parcial do mesmo eclipse (a sombra entrando na lua; 20:47-22:05): um jogo NOVO nessa hora (clique em NEW GAME, nao em CONTINUE; olhe para o sudeste, alto)
call npm run build && npx electron electron/main.cjs new at=2008-02-20T21:15
