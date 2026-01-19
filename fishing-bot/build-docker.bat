@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    Docker Build - Fishing Bot
echo ========================================
echo.

cd /d "%~dp0"

:: ============================================
:: Le versao atual
:: ============================================
if not exist version.txt (
    echo 0.0.0 > version.txt
)

set /p CURRENT_VERSION=<version.txt
for /f "tokens=1,2,3 delims=." %%a in ("%CURRENT_VERSION%") do (
    set MAJOR=%%a
    set MINOR=%%b
    set PATCH=%%c
)

echo Versao atual: %CURRENT_VERSION%
echo.

:: ============================================
:: Determina tipo de incremento
:: ============================================
set INCREMENT_TYPE=%1
if "%INCREMENT_TYPE%"=="" set INCREMENT_TYPE=patch

if /i "%INCREMENT_TYPE%"=="major" (
    set /a MAJOR+=1
    set MINOR=0
    set PATCH=0
) else if /i "%INCREMENT_TYPE%"=="minor" (
    set /a MINOR+=1
    set PATCH=0
) else if /i "%INCREMENT_TYPE%"=="patch" (
    set /a PATCH+=1
) else if /i "%INCREMENT_TYPE%"=="none" (
    echo [INFO] Mantendo versao atual (sem incremento)
    goto :build
) else (
    echo [ERRO] Tipo de incremento invalido: %INCREMENT_TYPE%
    echo Uso: build-docker.bat [major^|minor^|patch^|none]
    exit /b 1
)

:: ============================================
:: Atualiza versao
:: ============================================
set NEW_VERSION=%MAJOR%.%MINOR%.%PATCH%
echo %NEW_VERSION%> version.txt
echo Nova versao: %NEW_VERSION%
echo.

:build
:: ============================================
:: Le a versao final para o build
:: ============================================
set /p BUILD_VERSION=<version.txt

:: Nome da imagem
set IMAGE_NAME=fishing-bot
set FULL_TAG=%IMAGE_NAME%:%BUILD_VERSION%
set LATEST_TAG=%IMAGE_NAME%:latest

echo ========================================
echo    Construindo Imagem Docker
echo ========================================
echo.
echo Tag: %FULL_TAG%
echo Tag: %LATEST_TAG%
echo.

:: ============================================
:: Build da imagem
:: ============================================
echo [1/2] Construindo imagem...
docker build -t %FULL_TAG% -t %LATEST_TAG% .
if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao construir imagem Docker
    pause
    exit /b 1
)

echo.
echo [2/2] Imagem construida com sucesso!
echo.

:: ============================================
:: Mostra informacoes
:: ============================================
echo ========================================
echo    Build Concluido!
echo ========================================
echo.
echo Versao: %BUILD_VERSION%
echo.
echo Imagens criadas:
echo   - %FULL_TAG%
echo   - %LATEST_TAG%
echo.
echo Para executar:
echo   docker run -p 3000:3000 -v ./data:/app/data %FULL_TAG%
echo.
echo Ou use docker-compose:
echo   docker-compose up -d
echo.

pause
