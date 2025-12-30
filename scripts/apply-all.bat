@echo off
REM Apply All Patches - Script simples para aplicar todos os patches

echo ========================================
echo    APLICAR TODOS OS PATCHES
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

REM Verificar se os arquivos existem
if not exist "apply-all-patches.js" (
    echo [ERRO] apply-all-patches.js não encontrado!
    pause
    exit /b 1
)

if not exist "source.js" (
    echo [AVISO] source.js não encontrado!
    echo Execute primeiro: unminify.bat
    echo.
    pause
)

echo Aplicando todos os patches essenciais...
echo.
node apply-all-patches.js

echo.
echo ========================================
echo Processo finalizado!
echo.
echo Todos os patches foram processados.
echo Use o source.js modificado no seu projeto.
echo.
pause