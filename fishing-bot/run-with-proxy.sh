#!/bin/bash
# Script para executar o bot com proxy no Linux/Mac

# Configura as variáveis de ambiente do proxy
export HTTP_PROXY=http://2.56.249.17:50100
export HTTPS_PROXY=http://2.56.249.17:50100

# Mostra configuração
echo "================================"
echo "Proxy configurado:"
echo "HTTP_PROXY=$HTTP_PROXY"
echo "HTTPS_PROXY=$HTTPS_PROXY"
echo "================================"
echo ""

# Executa o bot
bun run src/index.ts "$@"
