#!/bin/bash

# Patch System - Unix Shell Script
# Script conveniente para usar o sistema de patches

echo "========================================"
echo "   PATCH SYSTEM - GameHacxkeado"
echo "========================================"
echo

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "[ERRO] Node.js não encontrado!"
    echo "Instale Node.js em: https://nodejs.org/"
    exit 1
fi

# Verificar se o arquivo existe
if [ ! -f "patch-system.js" ]; then
    echo "[ERRO] patch-system.js não encontrado!"
    exit 1
fi

# Verificar se source.js existe
if [ ! -f "source.js" ]; then
    echo "[AVISO] source.js não encontrado!"
    echo "Certifique-se de ter um arquivo source.js para aplicar patches."
    echo
fi

# Executar o script com argumentos passados
if [ $# -eq 0 ]; then
    echo "Mostrando status do sistema..."
    echo
    node patch-system.js status
else
    echo "Executando: patch-system.js $*"
    echo
    node patch-system.js "$@"
fi

echo
echo "Processo finalizado!"

if [ "$1" != "help" ] && [ "$1" != "status" ]; then
    echo
    echo "Comandos disponíveis:"
    echo "  ./patch.sh                    - Status do sistema"
    echo "  ./patch.sh list               - Listar patches"
    echo "  ./patch.sh apply <patch>      - Aplicar patch específico"
    echo "  ./patch.sh apply-all          - Aplicar TODOS os patches"
    echo "  ./patch.sh remove <patch>     - Remover patch específico"
    echo "  ./patch.sh remove-all         - Remover TODOS os patches"
    echo "  ./patch.sh backups            - Ver backups"
    echo "  ./patch.sh help               - Ajuda completa"
fi

echo