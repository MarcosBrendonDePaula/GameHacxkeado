#!/bin/bash

# GameHacxkeado Check Updates
# Verifica por atualizações sem baixar

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}"
echo "  ####################################"
echo "  # GameHacxkeado Check for Updates  #"
echo "  ####################################"
echo -e "${NC}"

# Ir para o diretório do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ ! -f "auto-update.js" ]; then
    echo -e "${RED}❌ Arquivo auto-update.js não encontrado!${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 Verificando por atualizações...${NC}"
echo

node auto-update.js --check