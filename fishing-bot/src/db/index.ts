import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { resolve } from "path";

// Caminho do banco de dados
const DB_PATH = resolve(import.meta.dir, "../../data/fishing-bot.db");

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
