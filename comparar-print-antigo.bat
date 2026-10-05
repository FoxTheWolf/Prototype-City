@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem a mesma semente e posicao de uma captura antiga (SEED 711445483, POS 771.2,971.9), para comparar: clique em NEW GAME e gire ate ver a mesma vista. A cidade da semente mudou desde entao (a diagonal saiu, os terrenos foram para a grade de 2 m), entao a vista nao vai bater exatamente
call npm run build && npx electron electron/main.cjs new seed=711445483 pos=771.2,971.9
