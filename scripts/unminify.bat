@echo off
REM Auto Unminify - Windows Batch Script
REM Este script facilita a execução do auto-unminify.js

echo ========================================
echo    AUTO UNMINIFY - GameHacxkeado
echo ========================================
echo.

REM Verificar se Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js não encontrado!
    echo Instale Node.js em: https://nodejs.org/
    pause
    exit /b 1
)

REM Verificar se o arquivo existe
if not exist "auto-unminify.js" (
    echo [ERRO] auto-unminify.js não encontrado!
    pause
    exit /b 1
)

REM Executar o script com argumentos passados
if "%1"=="" (
    echo Executando processo automático...
    echo.
    node auto-unminify.js
) else (
    echo Executando com parâmetros: %*
    echo.
    node auto-unminify.js %*
)

echo.
echo Processo finalizado!
if not "%1"=="help" (
    echo.
    echo Comandos disponíveis:
    echo   unminify.bat          - Processo automático
    echo   unminify.bat verbose  - Modo detalhado
    echo   unminify.bat list     - Listar arquivos
    echo   unminify.bat help     - Ajuda completa
)
echo.
pause