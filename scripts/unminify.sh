#!/bin/bash

# Auto Unminify - Unix Shell Script
# Este script facilita a execução do auto-unminify.js

echo "========================================"
echo "   AUTO UNMINIFY - GameHacxkeado"
echo "========================================"
echo

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "[ERRO] Node.js não encontrado!"
    echo "Instale Node.js em: https://nodejs.org/"
    exit 1
fi

# Verificar se o arquivo existe
if [ ! -f "auto-unminify.js" ]; then
    echo "[ERRO] auto-unminify.js não encontrado!"
    exit 1
fi

# Executar o script com argumentos passados
if [ $# -eq 0 ]; then
    echo "Executando processo automático..."
    echo
    node auto-unminify.js
else
    echo "Executando com parâmetros: $*"
    echo
    node auto-unminify.js "$@"
fi

echo
echo "Processo finalizado!"

if [ "$1" != "help" ]; then
    echo
    echo "Comandos disponíveis:"
    echo "  ./unminify.sh          - Processo automático"
    echo "  ./unminify.sh verbose  - Modo detalhado"
    echo "  ./unminify.sh list     - Listar arquivos"
    echo "  ./unminify.sh help     - Ajuda completa"
fi

echo