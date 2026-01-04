#!/bin/bash

# Validador de JavaScript - Unix Script
# Valida sintaxe do source.js ou arquivo especificado

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para mostrar ajuda
show_help() {
    echo
    echo "🔍 Validador de JavaScript - GameHacxkeado"
    echo
    echo "Uso:"
    echo "  $0 [arquivo] [opções]"
    echo
    echo "Argumentos:"
    echo "  arquivo              Arquivo JS a ser validado (padrão: source.js)"
    echo
    echo "Opções:"
    echo "  --help, -h          Mostra esta ajuda"
    echo "  --verbose, -v       Saída detalhada"
    echo
    echo "Exemplos:"
    echo "  $0                         # Valida source.js"
    echo "  $0 source.js               # Valida source.js"
    echo "  $0 index-*.js              # Valida arquivo específico"
    echo "  $0 --verbose               # Valida com detalhes"
    echo "  $0 source.js -v            # Valida com detalhes"
    echo
    echo "Funcionalidades:"
    echo "  ✅ Validação de sintaxe JavaScript"
    echo "  ✅ Detecção de parênteses não balanceados"
    echo "  ✅ Verificação de vírgulas problemáticas"
    echo "  ✅ Análise de arrow functions"
    echo "  ✅ Detecção de finais de linha mistos"
    echo "  ✅ Sugestões de correção"
    echo
    exit 0
}

# Vai para diretório do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Valores padrão
ARQUIVO="source.js"
VERBOSE=""

# Parse dos argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            ;;
        --verbose|-v)
            VERBOSE="--verbose"
            shift
            ;;
        -*)
            echo -e "${RED}[ERRO]${NC} Opção desconhecida: $1"
            echo "Use --help para ver opções disponíveis"
            exit 1
            ;;
        *)
            ARQUIVO="$1"
            shift
            ;;
    esac
done

# Verifica se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERRO]${NC} Node.js não encontrado. Instale em: https://nodejs.org/"
    exit 1
fi

echo
echo -e "${BLUE}🔍 Validador de JavaScript - GameHacxkeado${NC}"
echo
echo -e "${YELLOW}📁 Validando:${NC} $ARQUIVO"

# Executa validador
if [ -n "$VERBOSE" ]; then
    node js-validator.js "$ARQUIVO" $VERBOSE
else
    node js-validator.js "$ARQUIVO"
fi

EXIT_CODE=$?

echo
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Validação concluída com sucesso!${NC}"
else
    echo -e "${RED}❌ Validação falhou - verifique os erros acima${NC}"
fi

exit $EXIT_CODE