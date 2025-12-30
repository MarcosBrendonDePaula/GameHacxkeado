@echo off
title GameHacxkeado Auto Update
color 0A

echo.
echo  ####################################
echo  # GameHacxkeado Auto Update System #
echo  ####################################
echo.

cd /d "%~dp0\.."

if not exist "auto-update.js" (
    echo ❌ Arquivo auto-update.js nao encontrado!
    echo 💡 Certifique-se de estar na pasta raiz do projeto
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo 📦 Instalando dependencias...
    call npm install
    if errorlevel 1 (
        echo ❌ Falha na instalacao de dependencias
        pause
        exit /b 1
    )
)

echo 🚀 Executando Auto Update...
echo.

node auto-update.js

if errorlevel 1 (
    echo.
    echo ❌ Update falhou! Verifique os erros acima.
    pause
    exit /b 1
) else (
    echo.
    echo ✅ Update concluido com sucesso!
    echo.
    echo 📋 Proximos passos sugeridos:
    echo    - Aplicar patches: scripts\apply-all.bat
    echo    - Verificar source.js gerado
    echo.
    pause
)