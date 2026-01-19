# Dockerfile para Fishing Bot - Desenvolvimento
# Usa Bun como runtime

FROM oven/bun:1 AS base
WORKDIR /app

# ============================================
# Stage: dependencies
# ============================================
FROM base AS dependencies

# Instala dependencias de build para better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copia arquivos de dependencias
COPY package.json bun.lock* ./

# Instala dependencias
RUN bun install --frozen-lockfile

# ============================================
# Stage: build
# ============================================
FROM base AS build

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Build do frontend (Vite)
RUN bun run --cwd src/web/client vite build

# ============================================
# Stage: production
# ============================================
FROM base AS production

ENV NODE_ENV=production
ENV FISHING_BOT_PROD=1
ENV APP_DIR=/app

# Copia node_modules e codigo
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./

# Cria diretorio para dados persistentes
RUN mkdir -p /app/data

# Expoe a porta do servidor web
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["bun", "run", "src/web/server.ts"]
