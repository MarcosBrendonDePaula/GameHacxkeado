#!/bin/bash

# GameHacxkeado Auto Update System
# Atualiza automaticamente o código do jogo

set -e  # Sair se algum comando falhar

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}"
echo "  ####################################"
echo "  # GameHacxkeado Auto Update System #"
echo "  ####################################"
echo -e "${NC}"

# Ir para o diretório do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo -e "${BLUE}📁 Diretório do projeto: $PROJECT_DIR${NC}"

# Verificar se existe auto-update.js
if [ ! -f "auto-update.js" ]; then
    echo -e "${RED}❌ Arquivo auto-update.js não encontrado!${NC}"
    echo -e "${YELLOW}💡 Certifique-se de estar na pasta raiz do projeto${NC}"
    exit 1
fi

# Verificar/instalar dependências
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Instalando dependências...${NC}"
    npm install
fi

# Executar auto-update
echo -e "${GREEN}🚀 Executando Auto Update...${NC}"
echo

if node auto-update.js; then
    echo
    echo -e "${GREEN}✅ Update concluído com sucesso!${NC}"
    echo
    echo -e "${BLUE}📋 Próximos passos sugeridos:${NC}"
    echo -e "   - Aplicar patches: ${YELLOW}./scripts/apply-all.sh${NC}"
    echo -e "   - Verificar source.js gerado"
    echo
else
    echo
    echo -e "${RED}❌ Update falhou! Verifique os erros acima.${NC}"
    exit 1
fi