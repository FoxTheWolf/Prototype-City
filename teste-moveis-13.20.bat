@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (13.20): abre o jogo dentro da quitinete do terreo do predio 4375 da semente 1393987109 (as notas 4 e 5 do playtest). Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DOS MOVEIS (0.13.20) - predio 4375
echo  ============================================================
echo   O jogo abre DENTRO da quitinete do terreo (a das notas 4 e
echo   5: moveis espalhados, mesa colada na porta). Seu save NAO
echo   e tocado.
echo.
echo   1. Olhe a sala: a TV, o sofa e a cama devem estar agrupados,
echo      e a mesa com a cadeira LONGE da porta de entrada.
echo   2. Suba a escada e entre em alguns apartamentos (neste teste
echo      TODAS as portas estao destrancadas): cada um
echo      agora escolhe a arrumacao pelo morador (renda, casal,
echo      estudante, gamer...), entao dois iguais podem variar.
echo   3. Procure movel dentro de parede, na frente de porta ou
echo      tampando janela com guarda-roupa.
echo.
echo   Achou algo estranho? F8 e escreva.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest unlock seed=1393987109 pos=860.5,1182.5,0 look=270 at=2008-07-03T22:00
