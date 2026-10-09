@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (13.21): abre o jogo dentro do cybercafe do predio 487 da semente 42. Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DAS LOJAS (0.13.21) - semente 42
echo  ============================================================
echo   O jogo abre DENTRO de um cybercafe, perto da porta. Seu
echo   save NAO e tocado.
echo.
echo   1. Olhe as fileiras de computadores: cada mesa com a cadeira
echo      do lado da tela; o caixa e a geladeira junto da vitrine.
echo      Sente numa cadeira (F).
echo   2. Saia e entre em outras lojas da rua (lanchonete, bar,
echo      mercearia, lavanderia, farmacia): todas sairam agora do
echo      mesmo modelo desenhado das casas. Procure balcao fechando
echo      porta, movel dentro de parede, balcao de parede a parede.
echo   3. A recepcao de motel mais perto: x=743 y=79 (o predio 143),
echo      uns 300 m a oeste. Balcao de 2 m, sofa, geladeira.
echo.
echo   Achou algo estranho? F8 e escreva.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=42 pos=1045,168.6,0 look=0 at=2008-07-03T21:00
