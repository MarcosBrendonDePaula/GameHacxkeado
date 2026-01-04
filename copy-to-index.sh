#!/bin/bash

# Script para copiar source.js para arquivo index-*.js
# Encontra automaticamente o arquivo index correto e substitui o conteúdo

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo
echo -e "${BLUE}🔄 GameHacxkeado - Copy to Index${NC}"
echo "=================================="

# Verificar se source.js existe
if [ ! -f "source.js" ]; then
    echo -e "${RED}❌ Erro: source.js não encontrado!${NC}"
    echo -e "${YELLOW}💡 Execute o unminify primeiro ou verifique se está na pasta correta.${NC}"
    exit 1
fi

# Procurar por arquivos index-*.js
echo -e "${BLUE}🔍 Procurando arquivos index-*.js...${NC}"
INDEX_FILES=(index-*.js)
COUNT=0
INDEX_FILE=""

# Verificar se encontrou arquivos (expandindo o glob)
if [ -e "${INDEX_FILES[0]}" ]; then
    for file in "${INDEX_FILES[@]}"; do
        if [ -f "$file" ]; then
            ((COUNT++))
            INDEX_FILE="$file"
            echo "   Encontrado: $file"
        fi
    done
fi

# Verificar resultados da busca
if [ $COUNT -eq 0 ]; then
    echo -e "${RED}❌ Nenhum arquivo index-*.js encontrado na pasta!${NC}"
    echo -e "${YELLOW}💡 Verifique se há arquivos com padrão index-[ID].js na pasta.${NC}"
    exit 1
fi

if [ $COUNT -gt 1 ]; then
    echo -e "${YELLOW}⚠️  Múltiplos arquivos index-*.js encontrados ($COUNT arquivos)${NC}"
    echo -e "${BLUE}🎯 Usando o último encontrado: $INDEX_FILE${NC}"
    echo
fi

# Mostrar informações dos arquivos
echo
echo -e "${BLUE}📊 Informações dos arquivos:${NC}"
if [ -f "source.js" ]; then
    SOURCE_SIZE=$(stat -f%z "source.js" 2>/dev/null || stat -c%s "source.js" 2>/dev/null || echo "N/A")
    echo "   source.js: $SOURCE_SIZE bytes"
fi

if [ -f "$INDEX_FILE" ]; then
    INDEX_SIZE=$(stat -f%z "$INDEX_FILE" 2>/dev/null || stat -c%s "$INDEX_FILE" 2>/dev/null || echo "N/A")
    echo "   $INDEX_FILE: $INDEX_SIZE bytes"
fi

echo
echo -e "${BLUE}🎯 Arquivo destino: $INDEX_FILE${NC}"

# Confirmar operação
echo
read -p "Copiar source.js para $INDEX_FILE? (s/N): " CONFIRM
case $CONFIRM in
    [Ss]|[Ss][Ii][Mm])
        ;;
    *)
        echo -e "${RED}❌ Operação cancelada pelo usuário.${NC}"
        exit 0
        ;;
esac

# Fazer backup do arquivo original (opcional)
echo
echo -e "${YELLOW}💾 Criando backup do arquivo original...${NC}"
BACKUP_FILE="${INDEX_FILE}.backup.$(date +%Y%m%d-%H%M%S)"

if cp "$INDEX_FILE" "$BACKUP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Backup criado: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠️  Aviso: Não foi possível criar backup (arquivo pode não existir ou ter permissões)${NC}"
fi

# Copiar source.js para index-*.js
echo
echo -e "${BLUE}🔄 Copiando source.js para $INDEX_FILE...${NC}"

if cp "source.js" "$INDEX_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Cópia concluída com sucesso!${NC}"

    # Mostrar informações finais
    echo
    echo -e "${BLUE}📊 Resultado:${NC}"
    FINAL_SIZE=$(stat -f%z "$INDEX_FILE" 2>/dev/null || stat -c%s "$INDEX_FILE" 2>/dev/null || echo "N/A")
    echo "   $INDEX_FILE: $FINAL_SIZE bytes"

    echo
    echo -e "${YELLOW}💡 Dicas:${NC}"
    echo "   • O arquivo $INDEX_FILE agora contém o código modificado"
    echo "   • Backup do original foi salvo como $BACKUP_FILE"
    echo "   • Você pode usar este arquivo no jogo"

else
    echo -e "${RED}❌ Erro ao copiar arquivo!${NC}"
    echo -e "${YELLOW}💡 Verifique permissões e espaço em disco.${NC}"
    exit 1
fi

echo
echo -e "${GREEN}🎉 Processo concluído!${NC}"