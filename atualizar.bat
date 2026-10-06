@echo off
cd /d "%~dp0"
rem Traz o trabalho mais novo do GitHub (a main) para esta pasta.
for /f %%h in ('git rev-parse HEAD:package-lock.json') do set LOCK_ANTES=%%h
git pull origin main
if errorlevel 1 (
  echo.
  echo O git pull falhou. Mande a mensagem acima para o Claude.
  pause
  exit /b 1
)
for /f %%h in ('git rev-parse HEAD:package-lock.json') do set LOCK_DEPOIS=%%h
if not "%LOCK_ANTES%"=="%LOCK_DEPOIS%" call npm install
echo.
git log --oneline -5
pause
