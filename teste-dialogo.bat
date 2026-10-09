@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (C3b): abre o jogo dentro do cybercafe Nova Net da semente 42, as 20h. Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DO DIALOGO (C3b) - semente 42
echo  ============================================================
echo   O jogo abre DENTRO do cybercafe, as 20h. Seu save NAO e
echo   tocado.
echo.
echo   1. Fale com o atendente (F) e digite: what do you sell?
echo      Ele diz o que vende, com os precos de verdade, e o
echo      balcao abre.
echo   2. Enquanto digita, olhe a linha de cima da caixa: o
echo      "Unrecognized" sumiu (fica "Type what you want to
echo      say."); o tom aparece colorido (verde educado, vermelho
echo      grosso) e, com uma frase calma, o ponto do quadradinho
echo      a direita fica NO MEIO, nao embaixo.
echo   3. Saia para a rua, fale com alguem e digite:
echo      did you catch the game?   e depois   who won?
echo      Quem viu o jogo diz o vencedor (todo mundo concorda no
echo      mesmo dia); quem nao viu diz que nao viu.
echo   4. Pergunte: whats your name?  e, se responderem "And
echo      yours?", digite so o seu nome. Eles repetem o nome.
echo   5. Tambem vale testar: where can I stay the night?
echo      (aponta o motel mais perto) e um palavrao (respondem
echo      limpo e se ofendem).
echo   6. ESC no meio da conversa: so encerra a conversa, SEM
echo      abrir o menu de pausa, e o mouse volta a girar a vista.
echo.
echo   Achou algo estranho? F8 e escreva.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=42 pos=1045,168.6,0 look=0 at=2008-07-03T20:00
