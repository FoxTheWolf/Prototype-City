@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (C3, parte 2): os consertos de 2026-10-09 a tarde. Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DO C3 - parte 2 (horizonte, vidro, telhado) - semente 42
echo  ============================================================
echo   O jogo abre no telhado do predio 45, de dia (15:36),
echo   olhando para fora da cidade. Seu save NAO e tocado.
echo.
echo   1. HORIZONTE: a faixa creme embaixo do ceu sumiu? A terra
echo      de fora da cidade deve sumir na nevoa ate a cor do ceu.
echo   2. SOM NO TELHADO: Y ate RAIN. No telhado a chuva e a rua
echo      soam abertas; ao entrar na casinha, abafam.
echo   3. A COLUNA: desca a escada da casinha. Se a coluna branca
echo      "ate o infinito" aparecer, deixe ela NA TELA e aperte F8
echo      (preciso da posicao e do rumo exatos para achar).
echo   4. T ate a noite, ainda no telhado: a lampada sobre a porta
echo      da casinha ilumina a laje? A parede ficou clara demais?
echo   5. Apague a luz de um comodo: o verde do interruptor agora
echo      e mais fraco (metade). Com a luz acesa ele some, como o
echo      fosforo de verdade: isso te incomoda?
echo   6. VIDRO: Nova Net Cafe (6th Ave e 3rd St). Pela porta de
echo      vidro, de fora e de dentro, nada mais tinge de azul nem
echo      escurece: o mesmo vidro do relogio.
echo   7. ESCADA DE FORA: predio 84 (perto de x 289, y 80). Da
echo      porta da rua, olhando o corredor, a escada no fundo ja
echo      aparece antes de entrar.
echo.
echo   Achou algo estranho? F8 e escreva.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=42 pos=167.0,70.6,3 look=343 at=2008-07-03T15:36
