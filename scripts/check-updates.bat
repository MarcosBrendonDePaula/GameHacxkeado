@echo off
title GameHacxkeado Check Updates
color 0B

echo.
echo  ##################################
echo  # GameHacxkeado Check for Updates #
echo  ##################################
echo.

cd /d "%~dp0\.."

if not exist "auto-update.js" (
    echo ❌ Arquivo auto-update.js nao encontrado!
    pause
    exit /b 1
)

echo 🔍 Verificando por atualizacoes...
echo.

node auto-update.js --check

echo.
pause