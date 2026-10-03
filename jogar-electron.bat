@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem builds the game and opens it full screen (F11 leaves full screen, Alt+F4 closes)
call npm run electron
