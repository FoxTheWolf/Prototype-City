@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (16.1b): a luz nova (adiada), a unica agora. Semente 42. Nao mexe no seu save e nao salva.
rem (A velha ficou na tag luz-velha do Git, para comparar se precisar.)
echo.
echo  ============================================================
echo   TESTE DA LUZ NOVA (16.1b) - semente 42
echo  ============================================================
echo   O jogo abre na avenida, de dia. Seu save NAO e tocado.
echo   A luz velha foi apagada: tudo agora e uma luz so. F7
echo   pinta cada tipo de superficie de uma cor (debug).
echo.
echo   1. De dia, olhe a avenida: o fundo da rua (longe) fica
echo      da cor do ceu. Ande ate a borda da cidade: o chao de
echo      fora emenda no ceu, sem faixa branca.
echo   2. T ate umas 22h: calcadas sob os postes, fachadas,
echo      carros, pessoas. Algo mais escuro ou claro que antes?
echo   3. Y ate chover (RAIN): o brilho dos postes no asfalto
echo      molhado ficou fraco?
echo   4. Entre num escritorio ou loja de dia: a luz entra pelas
echo      janelas e cai longe delas; lampadas e telas visiveis.
echo      De noite: o teto mais escuro que as paredes e os
echo      moveis com lado claro e escuro (volume). Escuro demais?
echo   5. De dia, da rua, olhe as janelas: o interior fica
echo      escuro atras do vidro (antes: buraco claro).
echo   6. Suba num telhado: o chao do telhado com sol e ceu.
echo   7. A porta com neon rosa do predio 45 (canto noroeste da
echo      cidade): de noite, entre devagar e olhe o relogio. A
echo      cor rosa some aos poucos, nao num passo.
echo   8. A escada do mesmo predio 45, andares 1 a 3: a cor da
echo      escada muda de um andar para o outro? tem chuvisco?
echo.
echo   Achou algo estranho? F8 e escreva.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=42 pos=828,800 look=0 at=2008-07-03T12:00
