@echo off
REM Script para executar o bot com proxy no Windows

REM Configura as variáveis de ambiente do proxy
set HTTP_PROXY=http://2.56.249.17:50100
set HTTPS_PROXY=http://2.56.249.17:50100

REM Mostra configuração
echo ================================
echo Proxy configurado:
echo HTTP_PROXY=%HTTP_PROXY%
echo HTTPS_PROXY=%HTTPS_PROXY%
echo ================================
echo.

REM Executa o bot
bun run src/index.ts %*
