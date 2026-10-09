@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (13.23): abre o jogo no telhado do predio 45 da semente 42 (um walk-up de 3 andares), de tarde. Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DO TELHADO (0.13.23) - semente 42
echo  ============================================================
echo   O jogo abre EM CIMA de um predio de tijolo, as 15h30.
echo   Seu save NAO e tocado.
echo.
echo   1. Olhe em volta: a casinha da escada, a caixa d'agua no
echo      suporte de aco, o ar-condicionado, a cadeira e o vaso.
echo      Os telhados vizinhos tambem tem casinha e caixa d'agua.
echo   2. Ande ate o parapeito: ele segura (ninguem cai).
echo   3. Entre na casinha e desca a escada ate o ultimo andar;
echo      suba de volta. A escada tem de chegar inteira.
echo   4. Aperte T ate a noite e Y ate RAIN: a chuva cai em cima
echo      do telhado, na sua frente (dentro da casinha, nao).
echo   5. De dentro de um predio de moradia, suba pela escada
echo      ate o telhado (os predios de tijolo baixos tem).
echo.
echo   Achou algo estranho? F8 e escreva.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=42 pos=161.2,74.2,3 look=90 at=2008-07-03T15:30
