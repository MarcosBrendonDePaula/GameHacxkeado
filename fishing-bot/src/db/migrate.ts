import { Database } from "bun:sqlite";
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
    auto_repair INTEGER DEFAULT 1,
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
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'websocket', 'cast', 'repair')),
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

// Migrações incrementais (para bancos existentes)
try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_repair INTEGER DEFAULT 1;`);
  console.log("  ✓ Coluna 'auto_repair' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_repair:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_restart_minutes INTEGER DEFAULT 240;`);
  console.log("  ✓ Coluna 'auto_restart_minutes' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_restart_minutes:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_repair_min INTEGER DEFAULT 15;`);
  console.log("  ✓ Coluna 'auto_repair_min' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_repair_min:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_repair_max INTEGER DEFAULT 25;`);
  console.log("  ✓ Coluna 'auto_repair_max' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_repair_max:", e.message);
  }
}

// Migração: delay -> delay_min/delay_max
try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN delay_min INTEGER DEFAULT 1500;`);
  console.log("  ✓ Coluna 'delay_min' adicionada à tabela bots");
  // Migra valor do delay antigo para delay_min
  sqlite.exec(`UPDATE bots SET delay_min = delay WHERE delay IS NOT NULL;`);
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna delay_min:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN delay_max INTEGER DEFAULT 3000;`);
  console.log("  ✓ Coluna 'delay_max' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna delay_max:", e.message);
  }
}

// Sempre atualiza valores NULL ou 0 com padrões
try {
  // Migra delay antigo para delay_min se delay_min estiver vazio
  sqlite.exec(`UPDATE bots SET delay_min = delay WHERE (delay_min IS NULL OR delay_min = 0) AND delay IS NOT NULL AND delay > 0;`);
  // Define delay_min padrão se ainda estiver vazio
  sqlite.exec(`UPDATE bots SET delay_min = 1500 WHERE delay_min IS NULL OR delay_min = 0;`);
  // Define delay_max como delay_min + 1500 para registros que não têm
  sqlite.exec(`UPDATE bots SET delay_max = delay_min + 1500 WHERE delay_max IS NULL OR delay_max = 0;`);
  console.log("  ✓ Valores de delay_min/delay_max atualizados");
} catch (e: any) {
  console.error("  ⚠️ Erro ao atualizar valores de delay:", e.message);
}

// Migração: adicionar coluna category na tabela logs
try {
  sqlite.exec(`ALTER TABLE logs ADD COLUMN category TEXT DEFAULT 'general' CHECK (category IN ('general', 'websocket', 'cast', 'repair'));`);
  console.log("  ✓ Coluna 'category' adicionada à tabela logs");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna category:", e.message);
  }
}

// Criar índice para category (após adicionar a coluna)
try {
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category);`);
  console.log("  ✓ Índice 'idx_logs_category' criado");
} catch (e: any) {
  if (!e.message?.includes("already exists")) {
    console.error("  ⚠️ Erro ao criar índice category:", e.message);
  }
}

// Migração: adicionar session_secret_key (plaintext, sem criptografia)
try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN session_secret_key TEXT;`);
  console.log("  ✓ Coluna 'session_secret_key' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna session_secret_key:", e.message);
  }
}

// Migração: adicionar auto_upgrade (auto-upgrade da vara)
try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_upgrade INTEGER DEFAULT 0;`);
  console.log("  ✓ Coluna 'auto_upgrade' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_upgrade:", e.message);
  }
}

sqlite.close();

console.log(`✅ Migração concluída com sucesso!`);
