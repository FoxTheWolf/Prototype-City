@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (0.13.10o, bloco C1): abre o jogo dentro da recepcao do motel da semente 1393987109, olhando para a porta da rua. Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DO MOTEL (o softlock da porta, nota 1 do playtest)
echo  ============================================================
echo   O jogo abre DENTRO da recepcao do motel, de frente para a
echo   porta da rua (o recepcionista fica atras de voce, no
echo   balcao). Seu save NAO e tocado.
echo.
echo   1. Aperte F olhando para a porta: ela deve ABRIR (antes
echo      puxava conversa com o recepcionista e voce ficava preso).
echo   2. Saia e entre de novo algumas vezes.
echo   3. Vire para o balcao e aperte F: ai sim, a conversa.
echo.
echo   Se ficar preso, aperte F8 e escreva o que aconteceu.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=1393987109 pos=843.2,1179.4 look=0 at=2008-07-03T21:30
