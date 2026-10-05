@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem so para ver o Sarcofago de perto (13.15): a cupula fica a 200 m da cerca. Clique em NEW GAME e ande ate a borda da cidade do lado dele (de noite o fogo aparece pelas frestas)
call npm run build && npx electron electron/main.cjs new sarcnear at=2008-03-10T21:00
