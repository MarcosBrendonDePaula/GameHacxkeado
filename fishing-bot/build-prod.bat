@echo off
echo ========================================
echo    Build de Producao - Fishing Bot
echo ========================================
echo.

echo [1/3] Buildando frontend (Vite)...
cd /d "%~dp0"
call bun run --cwd src/web/client vite build
if errorlevel 1 (
    echo ERRO: Falha ao buildar frontend
    pause
    exit /b 1
)
echo Frontend buildado com sucesso!
echo.

echo [2/3] Buildando executavel...
call bun build src/web/server.ts --compile --outfile dist/fishing-bot-web.exe --external vite --external @coral-xyz/anchor --external lightningcss
if errorlevel 1 (
    echo ERRO: Falha ao buildar executavel
    pause
    exit /b 1
)
echo Executavel buildado com sucesso!
echo.

echo [3/3] Copiando arquivos...
if exist accounts.json (
    copy /Y accounts.json dist\accounts.json >nul
    echo accounts.json copiado
) else (
    echo AVISO: accounts.json nao encontrado na raiz
)
echo.

echo ========================================
echo    Build concluido com sucesso!
echo ========================================
echo.
echo Arquivos em dist/:
dir /b dist\
echo.
echo Para executar: dist\fishing-bot-web.exe
echo.
pause
