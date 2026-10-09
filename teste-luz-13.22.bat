@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (13.22): abre o jogo dentro do cybercafe do predio 487 da semente 42, de noite. Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DA LUZ, DO VIDRO E DO OLHO (0.13.22) - semente 42
echo  ============================================================
echo   O jogo abre DENTRO de um cybercafe, de noite. Seu save
echo   NAO e tocado.
echo.
echo   1. Aperte Y cinco vezes ate o clima ficar RAIN (chuva).
echo   2. De dentro, olhe a rua pela vitrine: as gotas no vidro.
echo   3. Saia e olhe para dentro pela mesma vitrine, de perto e
echo      de uns 10 m: o vidro agora e o MESMO dos dois lados
echo      (mesma cor, mesmo reflexo, as gotas tambem por fora).
echo      Ande pela rua e olhe outras janelas acesas: estao mais
echo      claras que antes de noite? Bom ou demais?
echo   4. O olho: entre e saia da loja algumas vezes. Ao entrar
echo      no claro, a vista agora fecha devagar (~1 s), sem tranco.
echo   5. Esc e Esc de novo: o mouse volta sozinho ao jogo.
echo   6. Interruptores: entre num predio de moradia, suba a
echo      escada e entre num apartamento. Ao lado de cada porta,
echo      do lado da macaneta, ha uma placa na parede: F apaga e
echo      acende a luz do comodo (com um clique).
echo   7. A cidade dormindo: na rua, aperte T algumas vezes ate
echo      umas 3h. As janelas das casas apagam quase todas; ficam
echo      o saguao e a escada. Os escritorios apagam fora do
echo      expediente (sobram poucas salas acesas).
echo.
echo   Achou algo estranho? F8 e escreva.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=42 pos=1045,168.6,0 look=0 at=2008-07-03T22:00
