@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (16.1c, passo 0): o ceu pela fisica. Abre na rua olhando para o poente, as 19h. Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DO CEU FISICO (16.1c) - semente 42
echo  ============================================================
echo   O jogo abre na rua, as 19h, olhando para o lado do por do
echo   sol (ele se poe as 19h28). Seu save NAO e tocado.
echo.
echo   1. So espere e olhe: das 19h as 19h50 passam ~4 minutos
echo      reais. O horizonte vai de dourado a laranja e vermelho;
echo      o alto do ceu, de azul para violeta. Nada e pintado: sai
echo      da posicao do sol e do ar.
echo   2. As fachadas: no fim da tarde ficam alaranjadas (so o
echo      vermelho atravessa tanto ar) e escurecem com o ceu, sem
echo      ficar mais escuras que a noite.
echo   3. Shift+T volta 1 hora. Aperte Y ate a linha de debug (F3)
echo      dizer WEATHER HIGH (o veu alto de nuvem, o cirro). Veja
echo      de novo o por do sol: logo depois que o sol some, o ceu
echo      INTEIRO fica rosa por ~2 minutos (o efeito de Miami) e
echo      depois roxo.
echo   4. Com Y em PARTLY: as nuvens baixas ficam rosadas so por
echo      uns segundos e viram silhuetas escuras contra o ceu roxo
echo      (elas estao a 1,5 km; o sol deixa de chegar antes).
echo   5. Vire de costas para o sol no por do sol: as fachadas
echo      viradas para ele ficam vermelho-alaranjadas.
echo   6. De dia (T avanca 1 hora), com o ar seco o halo em volta
echo      do sol e pequeno; com chuva (Y em RAIN) fica leitoso.
echo   7. A noite tem que estar igual a antes.
echo.
echo   Achou algo estranho? F8 e escreva.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=42 pos=810.9,344.8 look=270 at=2008-07-03T19:00
