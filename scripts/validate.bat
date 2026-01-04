@echo off
REM Validador de JavaScript - Windows Script
REM Valida sintaxe do source.js ou arquivo especificado

setlocal enabledelayedexpansion

REM Vai para diretório do projeto
cd /d "%~dp0\.."

REM Verifica se Node.js está instalado
node --version >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERRO] Node.js não encontrado. Instale em: https://nodejs.org/
    pause
    exit /b 1
)

REM Configura argumentos
set "ARQUIVO=%~1"
set "VERBOSE="

REM Se não especificou arquivo, usa source.js
if "%ARQUIVO%"=="" (
    set "ARQUIVO=source.js"
)

REM Verifica argumentos
:parse_args
if "%~1"=="--help" goto show_help
if "%~1"=="-h" goto show_help
if "%~1"=="--verbose" set "VERBOSE=--verbose"
if "%~1"=="-v" set "VERBOSE=--verbose"
shift
if not "%~1"=="" goto parse_args

echo.
echo 🔍 Validador de JavaScript - GameHacxkeado
echo.
echo 📁 Validando: %ARQUIVO%

REM Executa validador
if defined VERBOSE (
    node js-validator.js "%ARQUIVO%" %VERBOSE%
) else (
    node js-validator.js "%ARQUIVO%"
)

set "EXIT_CODE=!errorlevel!"

echo.
if !EXIT_CODE! equ 0 (
    echo ✅ Validação concluída com sucesso!
) else (
    echo ❌ Validação falhou - verifique os erros acima
)

pause
exit /b !EXIT_CODE!

:show_help
echo.
echo 🔍 Validador de JavaScript - GameHacxkeado
echo.
echo Uso:
echo   validate.bat [arquivo] [opções]
echo.
echo Argumentos:
echo   arquivo              Arquivo JS a ser validado (padrão: source.js)
echo.
echo Opções:
echo   --help, -h          Mostra esta ajuda
echo   --verbose, -v       Saída detalhada
echo.
echo Exemplos:
echo   validate.bat                    # Valida source.js
echo   validate.bat source.js          # Valida source.js
echo   validate.bat index-*.js         # Valida arquivo específico
echo   validate.bat --verbose          # Valida com detalhes
echo   validate.bat source.js -v       # Valida com detalhes
echo.
echo Funcionalidades:
echo   ✅ Validação de sintaxe JavaScript
echo   ✅ Detecção de parênteses não balanceados
echo   ✅ Verificação de vírgulas problemáticas
echo   ✅ Análise de arrow functions
echo   ✅ Detecção de finais de linha mistos
echo   ✅ Sugestões de correção
echo.
pause
exit /b 0