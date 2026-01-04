@echo off
REM Script para copiar source.js para arquivo index-*.js
REM Chama o script Node.js que faz o trabalho

REM Verificar se Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js não encontrado. Instale em: https://nodejs.org/
    pause
    exit /b 1
)

REM Executar script JavaScript
node copy-to-index.js

pause