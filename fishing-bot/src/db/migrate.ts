import { Database } from "bun:sqlite";
import { resolve } from "path";

// Caminho do banco de dados
const appDir = process.env.APP_DIR || resolve(import.meta.dir, "../..");
const DB_PATH = resolve(appDir, "data/fishing-bot.db");

console.log(`📦 Migrando banco de dados: ${DB_PATH}`);

// Criar conexão SQLite
const sqlite = new Database(DB_PATH, { create: true });

// Habilitar WAL mode para melhor performance
sqlite.exec("PRAGMA journal_mode = WAL;");

// Criar tabelas
sqlite.exec(`
  -- Contas - Uma por wallet
  CREATE TABLE IF NOT EXISTS accounts (
    wallet_pubkey TEXT PRIMARY KEY,
    name TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_login_at INTEGER
  );

  -- Bots - Max 1 por wallet
  CREATE TABLE IF NOT EXISTS bots (
    wallet_pubkey TEXT PRIMARY KEY REFERENCES accounts(wallet_pubkey) ON DELETE CASCADE,
    encrypted_session_key BLOB,
    session_key_iv BLOB,
    session_pubkey TEXT,
    delay INTEGER DEFAULT 500,
    proxy TEXT,
    enabled INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Resultados de Cast
  CREATE TABLE IF NOT EXISTS cast_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_pubkey TEXT NOT NULL REFERENCES accounts(wallet_pubkey) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('catch', 'miss')),
    fish_amount REAL,
    signature TEXT,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Histórico temporal (snapshots periódicos)
  CREATE TABLE IF NOT EXISTS bot_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_pubkey TEXT NOT NULL REFERENCES accounts(wallet_pubkey) ON DELETE CASCADE,
    catches INTEGER NOT NULL DEFAULT 0,
    misses INTEGER NOT NULL DEFAULT 0,
    total_fish REAL NOT NULL DEFAULT 0,
    durability REAL,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Logs
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_pubkey TEXT REFERENCES accounts(wallet_pubkey) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('info', 'success', 'warn', 'error')),
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Índices para performance
  CREATE INDEX IF NOT EXISTS idx_cast_results_wallet ON cast_results(wallet_pubkey);
  CREATE INDEX IF NOT EXISTS idx_cast_results_timestamp ON cast_results(timestamp);
  CREATE INDEX IF NOT EXISTS idx_bot_history_wallet ON bot_history(wallet_pubkey);
  CREATE INDEX IF NOT EXISTS idx_bot_history_timestamp ON bot_history(timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_wallet ON logs(wallet_pubkey);
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
`);

sqlite.close();

console.log(`✅ Migração concluída com sucesso!`);
