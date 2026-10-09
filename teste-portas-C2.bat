@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (C2): abre o jogo na rua, em frente as portas da nota 4 do playtest de 2026-10-08 (semente 42). Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DAS PORTAS (C2) - semente 42
echo  ============================================================
echo   O jogo abre na rua, de frente para duas portas de predio.
echo   Seu save NAO e tocado.
echo.
echo   0. Logo ao entrar: a vista deu o giro rapido? (o mouse agora
echo      ignora os primeiros movimentos depois de ser capturado)
echo   1. As portas agora ficam no MEIO da parede, nao afundadas.
echo      Olhe de lado: as laterais e o alto do vao devem ter a cor
echo      da fachada, sem deixar ver o saguao por ali.
echo   2. Abra uma porta (F) e entre e saia algumas vezes, devagar
echo      e rapido: aparece um quadro da fachada ao cruzar? O vidro
echo      das vitrines some?
echo   3. Uma loja de porta de vidro: olhando pelo vidro fechado, as
echo      portas de dentro aparecem? (antes sumiam atras do vidro)
echo   4. Se der, va ao motel da semente 1393987109 (outro teste) e
echo      veja se a porta ainda parece recuada ou com parede invisivel.
echo.
echo   Achou algo estranho? F8 e escreva.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=42 pos=1138.8,171.5 look=36 at=2008-07-04T09:23
