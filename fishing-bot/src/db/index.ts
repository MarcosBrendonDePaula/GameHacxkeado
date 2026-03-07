import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { resolve, dirname, basename } from "path";
import { mkdirSync, existsSync } from "fs";

// Detecta se está rodando como executável compilado
const exeName = basename(Bun.argv[0]).toLowerCase();
const isExecutable =
  import.meta.path.includes("~BUN") ||
  (exeName.endsWith(".exe") && !exeName.includes("bun")) ||
  process.env.FISHING_BOT_PROD === "1";

// Em dev: relativo ao source. Em prod: relativo ao executável
const appDir = process.env.APP_DIR || (isExecutable ? dirname(Bun.argv[0]) : resolve(import.meta.dir, "../.."));
const dataDir = resolve(appDir, "data");
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}
const DB_PATH = resolve(dataDir, "fishing-bot.db");

// Criar conexão SQLite
const sqlite = new Database(DB_PATH, { create: true });

// Habilitar WAL mode para melhor performance
sqlite.exec("PRAGMA journal_mode = WAL;");

// Criar instância do Drizzle ORM
export const db = drizzle(sqlite, { schema });

// Exportar schema para conveniência
export * from "./schema";

// Função para fechar conexão (útil em testes ou shutdown)
export function closeDatabase() {
  sqlite.close();
}

// Função para verificar se o banco existe e está acessível
export function isDatabaseReady(): boolean {
  try {
    sqlite.exec("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
