@echo off
REM Patch System - Windows Batch Script
REM Script conveniente para usar o sistema de patches

echo ========================================
echo    PATCH SYSTEM - GameHacxkeado
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
if not exist "patch-system.js" (
    echo [ERRO] patch-system.js não encontrado!
    pause
    exit /b 1
)

REM Verificar se source.js existe
if not exist "source.js" (
    echo [AVISO] source.js não encontrado!
    echo Certifique-se de ter um arquivo source.js para aplicar patches.
    echo.
)

REM Executar o script com argumentos passados
if "%1"=="" (
    echo Mostrando status do sistema...
    echo.
    node patch-system.js status
) else (
    echo Executando: patch-system.js %*
    echo.
    node patch-system.js %*
)

echo.
echo Processo finalizado!
if not "%1"=="help" (
    if not "%1"=="status" (
        echo.
        echo Comandos disponíveis:
        echo   patch.bat                    - Status do sistema
        echo   patch.bat list               - Listar patches
        echo   patch.bat apply ^<patch^>      - Aplicar patch específico
        echo   patch.bat apply-all          - Aplicar TODOS os patches
        echo   patch.bat remove ^<patch^>     - Remover patch específico
        echo   patch.bat remove-all         - Remover TODOS os patches
        echo   patch.bat backups            - Ver backups
        echo   patch.bat help               - Ajuda completa
    )
)
echo.
pause