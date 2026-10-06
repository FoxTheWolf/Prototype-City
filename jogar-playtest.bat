@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem the game in Electron with the playtest record on (13.10p): playtest\ gets one file per session; F8 writes a note
call npm run electron -- playtest
