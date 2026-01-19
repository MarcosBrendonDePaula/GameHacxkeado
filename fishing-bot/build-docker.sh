#!/bin/bash

echo "========================================"
echo "   Docker Build - Fishing Bot"
echo "========================================"
echo

cd "$(dirname "$0")"

# ============================================
# Le versao atual
# ============================================
if [ ! -f version.txt ]; then
    echo "0.0.0" > version.txt
fi

CURRENT_VERSION=$(cat version.txt)
MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
PATCH=$(echo $CURRENT_VERSION | cut -d. -f3)

echo "Versao atual: $CURRENT_VERSION"
echo

# ============================================
# Determina tipo de incremento
# ============================================
INCREMENT_TYPE=${1:-patch}

case $INCREMENT_TYPE in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
    none)
        echo "[INFO] Mantendo versao atual (sem incremento)"
        ;;
    *)
        echo "[ERRO] Tipo de incremento invalido: $INCREMENT_TYPE"
        echo "Uso: ./build-docker.sh [major|minor|patch|none]"
        exit 1
        ;;
esac

# ============================================
# Atualiza versao
# ============================================
if [ "$INCREMENT_TYPE" != "none" ]; then
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
    echo "$NEW_VERSION" > version.txt
    echo "Nova versao: $NEW_VERSION"
    echo
fi

# ============================================
# Le a versao final para o build
# ============================================
BUILD_VERSION=$(cat version.txt)

# Nome da imagem
IMAGE_NAME="fishing-bot"
FULL_TAG="$IMAGE_NAME:$BUILD_VERSION"
LATEST_TAG="$IMAGE_NAME:latest"

echo "========================================"
echo "   Construindo Imagem Docker"
echo "========================================"
echo
echo "Tag: $FULL_TAG"
echo "Tag: $LATEST_TAG"
echo

# ============================================
# Build da imagem
# ============================================
echo "[1/2] Construindo imagem..."
docker build -t "$FULL_TAG" -t "$LATEST_TAG" .
if [ $? -ne 0 ]; then
    echo
    echo "[ERRO] Falha ao construir imagem Docker"
    exit 1
fi

echo
echo "[2/2] Imagem construida com sucesso!"
echo

# ============================================
# Mostra informacoes
# ============================================
echo "========================================"
echo "   Build Concluido!"
echo "========================================"
echo
echo "Versao: $BUILD_VERSION"
echo
echo "Imagens criadas:"
echo "  - $FULL_TAG"
echo "  - $LATEST_TAG"
echo
echo "Para executar:"
echo "  docker run -p 3000:3000 -v ./data:/app/data $FULL_TAG"
echo
echo "Ou use docker-compose:"
echo "  docker-compose up -d"
echo
