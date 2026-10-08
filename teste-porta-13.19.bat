@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (13.18 e 13.19): abre o jogo ja na frente do predio 4085 da semente 1393987109, as 21:55. Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DAS PORTAS (0.13.18 e 0.13.19) - predio 4085
echo  ============================================================
echo   O jogo abre direto na calcada, de frente para a porta
echo   do predio, de noite. Seu save NAO e tocado.
echo.
echo   1. A PORTA DA RUA (a sua frente): deve ser de madeira,
echo      com um vidro em cima, uma janelinha acesa sobre ela
echo      com o numero e o interfone ao lado. Compare com a
echo      porta de vidro de uma loja.
echo   2. Aperte F para abrir e entre. Vire para tras: sobre a
echo      porta, uma placa EXIT VERMELHA com o homenzinho.
echo   3. Va ate a escada (fundo do saguao) e olhe de volta para
echo      o saguao: outra placa EXIT sobre a passagem.
echo   4. Suba ate o andar 3: a porta da casa no patamar, o hall
echo      de entrada, moveis encostados na parede, sem fresta no
echo      topo da escada, e NENHUMA placa EXIT dentro da casa.
echo.
echo   F8 grava uma nota com a captura, como no playtest.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=1393987109 pos=867,1160.5 look=0 at=2008-07-03T21:55
