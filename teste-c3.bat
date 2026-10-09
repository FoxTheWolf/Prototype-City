@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (C3): o retorno do playtest de 2026-10-09. Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DO C3 (o softlock, a chuva, o telhado) - semente 42
echo  ============================================================
echo   O jogo abre no predio 491, na porta em que o F prendia.
echo   Seu save NAO e tocado.
echo.
echo   1. Olhe para a porta e aperte F: ela abre (o interruptor
echo      do lado nao rouba mais o F). Para acender ou apagar,
echo      mire NA placa do interruptor (aparece a mira "+").
echo   2. Apague a luz: a tecla do interruptor brilha verde
echo      fraquinho no escuro (fosforescente).
echo   3. Va ao Nova Net Cafe (6th Ave e 3rd St), Y ate RAIN:
echo      dentro nao chove; pela vitrine, la fora, chove.
echo   4. Va a um predio de tijolo baixo, suba ao telhado:
echo      - a caixa d'agua sem manchas da cidade de dia;
echo      - nenhuma caixa d'agua velha atravessando a nova;
echo      - a cadeira olhando para a rua, nao para o vaso;
echo      - de noite, uma lampada sobre a porta da casinha
echo        iluminando a laje (o brilho e ajustavel: me diga);
echo      - nada cor-de-rosa no telhado (era o neon da quina).
echo   5. Ultimo andar do predio 288 (perto do 45): a mancha
echo      clara no teto antes de atravessar sumiu?
echo.
echo   Achou algo estranho? F8 e escreva.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=42 pos=1066.6,166.2,0 look=72 at=2008-07-03T22:20
