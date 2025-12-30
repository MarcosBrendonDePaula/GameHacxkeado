#!/bin/bash

# Apply All Patches - Script simples para aplicar todos os patches

echo "========================================"
echo "   APLICAR TODOS OS PATCHES"
echo "========================================"
echo

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "[ERRO] Node.js não encontrado!"
    echo "Instale Node.js em: https://nodejs.org/"
    exit 1
fi

# Verificar se os arquivos existem
if [ ! -f "apply-all-patches.js" ]; then
    echo "[ERRO] apply-all-patches.js não encontrado!"
    exit 1
fi

if [ ! -f "source.js" ]; then
    echo "[AVISO] source.js não encontrado!"
    echo "Execute primeiro: ./unminify.sh"
    echo
fi

echo "Aplicando todos os patches essenciais..."
echo
node apply-all-patches.js

echo
echo "========================================"
echo "Processo finalizado!"
echo
echo "Todos os patches foram processados."
echo "Use o source.js modificado no seu projeto."
echo