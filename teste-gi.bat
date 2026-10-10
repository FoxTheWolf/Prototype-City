@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem TEMPORARIO (16.1c, partes 1 e 2): a luz indireta por raios. Abre no centro, as 13h. Nao mexe no seu save e nao salva.
echo.
echo  ============================================================
echo   TESTE DA LUZ INDIRETA POR RAIOS (16.1c) - semente 42
echo  ============================================================
echo   O jogo abre na avenida do centro, as 13h. Seu save NAO e
echo   tocado. F3 mostra a linha de debug (anote o GPU ... ms).
echo.
echo   1. RUIDO: pare de frente para uma parede na sombra e
echo      espere 2 segundos. Ainda aparece xadrez/granulado?
echo   2. A SOMBRA DOS PREDIOS na avenida: escura demais para
echo      jogar, ou parece uma foto de verdade?
echo   3. Ande ate uma rua estreita (um beco): a base das
echo      paredes escurece (sombra de contato) e a parede de
echo      frente para outra ensolarada fica mais clara e quente.
echo   4. T avanca 1 hora. As 17h-18h: a sombra azulada pelo ceu.
echo   5. Va ate as 21h-22h (T): a NOITE MUDOU. Sem a claridade
echo      falsa em tudo: as fachadas longe escurecem, as janelas
echo      acesas saltam, a luz dos postes rebate do asfalto nas
echo      paredes. Diga se esta bonito ou escuro demais.
echo   6. Andando, a luz nao pode "arrastar" (atrasar) visivelmente.
echo.
echo   Achou algo estranho? F8 e escreva.
echo  ============================================================
echo.
pause
call npm run build && npx electron electron/main.cjs playtest seed=42 pos=828,800 look=0 at=2008-07-03T13:00
