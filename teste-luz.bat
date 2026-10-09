@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (16.1b): compara a luz nova (adiada) com a velha, na rua, semente 42. Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DA LUZ NOVA (16.1b, passo 1: a rua) - semente 42
echo  ============================================================
echo   O jogo abre na avenida, de dia. Seu save NAO e tocado.
echo   F7 troca a luz VELHA e a NOVA (F3: a linha de baixo diz
echo   LIGHT OLD ou LIGHT NEW). Shift+F7 pinta cada tipo de
echo   superficie de uma cor (debug; Shift+F7 de novo desliga).
echo.
echo   O passo 1 troca o encanamento da luz, nao a cara: a rua
echo   deve ficar QUASE IGUAL nas duas. Procure o que piorou.
echo.
echo   1. De dia, aperte F7 algumas vezes olhando a avenida.
echo      O fundo da rua (longe) fica da cor do ceu na nova.
echo   2. Ande ate a borda da cidade e olhe para fora: na nova
echo      o chao de fora emenda no ceu, sem faixa branca.
echo   3. T ate umas 22h. F7 de novo: as calcadas sob os postes,
echo      as fachadas, os carros, as pessoas.
echo   4. Y ate chover (RAIN). F7 com o asfalto molhado: o
echo      brilho dos postes no chao ficou fraco demais na nova?
echo   5. Dentro (passo 2): entre num escritorio ou loja de dia.
echo      F7: a luz entra pelas janelas e cai longe delas; as
echo      lampadas e telas continuam visiveis. De noite deve
echo      ficar igual a velha.
echo   6. De dia, da rua, olhe as janelas: na nova o interior
echo      fica escuro atras do vidro (antes: buraco claro).
echo   7. Suba num telhado: o chao do telhado com sol e ceu.
echo   8. A porta com neon rosa do predio 45 (canto noroeste da
echo      cidade): de noite, com F7 ligado, entre devagar e olhe
echo      o relogio. A cor rosa some aos poucos, nao num passo.
echo   9. A escada do mesmo predio 45 (atras da porta rosa),
echo      andares 1 a 3: com F7 ligado, a cor da escada muda
echo      de um andar para o outro? tem chuvisco?
echo.
echo   Achou algo estranho? F8 e escreva (diga OLD ou NEW).
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=42 pos=828,800 look=0 at=2008-07-03T12:00
