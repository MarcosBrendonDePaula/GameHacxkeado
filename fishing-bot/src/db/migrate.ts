import { Database } from "bun:sqlite";
import { resolve, dirname, basename } from "path";
import { mkdirSync, existsSync } from "fs";

// Detecta se está rodando como executável compilado
const entryArg = Bun.argv[0] ?? "";
const exeName = basename(entryArg).toLowerCase();
const isExecutable =
  import.meta.path.includes("~BUN") ||
  (exeName.endsWith(".exe") && !exeName.includes("bun")) ||
  process.env.FISHING_BOT_PROD === "1";

// Em dev: relativo ao source. Em prod: relativo ao executável
const appDir = process.env.APP_DIR || (isExecutable ? dirname(entryArg || process.cwd()) : resolve(import.meta.dir, "../.."));
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

// Migração: adicionar colunas de bait (auto-buy/auto-use iscas)
try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_buy_bait INTEGER DEFAULT 0;`);
  console.log("  ✓ Coluna 'auto_buy_bait' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_buy_bait:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_buy_bait_ids TEXT DEFAULT '';`);
  console.log("  ✓ Coluna 'auto_buy_bait_ids' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_buy_bait_ids:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_use_bait_id INTEGER DEFAULT 0;`);
  console.log("  ✓ Coluna 'auto_use_bait_id' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_use_bait_id:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_buy_bait_threshold INTEGER DEFAULT 100;`);
  console.log("  ✓ Coluna 'auto_buy_bait_threshold' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_buy_bait_threshold:", e.message);
  }
}

// Migração: adicionar autoUseBaitOrder (ordem de prioridade para auto-equipar)
try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_use_bait_order TEXT DEFAULT '';`);
  console.log("  ✓ Coluna 'auto_use_bait_order' adicionada à tabela bots");
  // Migra autoUseBaitId antigo para novo formato
  sqlite.exec(`UPDATE bots SET auto_use_bait_order = CAST(auto_use_bait_id AS TEXT) WHERE auto_use_bait_id > 0 AND (auto_use_bait_order IS NULL OR auto_use_bait_order = '');`);
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_use_bait_order:", e.message);
  }
}

// Migração: adicionar autoBuyBaitQty (quantidade por isca para auto-compra)
try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_buy_bait_qty TEXT DEFAULT '';`);
  console.log("  ✓ Coluna 'auto_buy_bait_qty' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_buy_bait_qty:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_repair_wait_min_minutes INTEGER DEFAULT 0;`);
  console.log("  âœ“ Coluna 'auto_repair_wait_min_minutes' adicionada Ã  tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  âš ï¸ Erro ao adicionar coluna auto_repair_wait_min_minutes:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_repair_wait_max_minutes INTEGER DEFAULT 0;`);
  console.log("  âœ“ Coluna 'auto_repair_wait_max_minutes' adicionada Ã  tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  âš ï¸ Erro ao adicionar coluna auto_repair_wait_max_minutes:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_wait_durability INTEGER DEFAULT 0;`);
  console.log("  âœ“ Coluna 'auto_wait_durability' adicionada Ã  tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  âš ï¸ Erro ao adicionar coluna auto_wait_durability:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_wait_durability_min INTEGER DEFAULT 15;`);
  console.log("  âœ“ Coluna 'auto_wait_durability_min' adicionada Ã  tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  âš ï¸ Erro ao adicionar coluna auto_wait_durability_min:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_wait_durability_max INTEGER DEFAULT 25;`);
  console.log("  âœ“ Coluna 'auto_wait_durability_max' adicionada Ã  tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  âš ï¸ Erro ao adicionar coluna auto_wait_durability_max:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_wait_minutes_min INTEGER DEFAULT 0;`);
  console.log("  âœ“ Coluna 'auto_wait_minutes_min' adicionada Ã  tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  âš ï¸ Erro ao adicionar coluna auto_wait_minutes_min:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_wait_minutes_max INTEGER DEFAULT 0;`);
  console.log("  âœ“ Coluna 'auto_wait_minutes_max' adicionada Ã  tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  âš ï¸ Erro ao adicionar coluna auto_wait_minutes_max:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN current_wait_threshold INTEGER DEFAULT 0;`);
  console.log("  ✓ Coluna 'current_wait_threshold' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna current_wait_threshold:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN durability_pause_until INTEGER;`);
  console.log("  ✓ Coluna 'durability_pause_until' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna durability_pause_until:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_buy_bait_thresholds TEXT DEFAULT '';`);
  console.log("  ✓ Coluna 'auto_buy_bait_thresholds' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_buy_bait_thresholds:", e.message);
  }
}

// Migração: Criar tabela bait_presets (presets/carrinhos de isca compartilháveis)
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bait_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_pubkey TEXT NOT NULL REFERENCES accounts(wallet_pubkey) ON DELETE CASCADE,
      name TEXT NOT NULL,
      auto_buy_bait_ids TEXT NOT NULL DEFAULT '',
      auto_buy_bait_thresholds TEXT NOT NULL DEFAULT '',
      auto_buy_bait_qty TEXT NOT NULL DEFAULT '',
      auto_use_bait_order TEXT NOT NULL DEFAULT '',
      purchased_qty TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'done', 'error')),
      status_message TEXT,
      share_code TEXT UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_bait_presets_wallet ON bait_presets(wallet_pubkey);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_bait_presets_share_code ON bait_presets(share_code);`);
  console.log("  ✓ Tabela 'bait_presets' criada com índices");
} catch (e: any) {
  if (!e.message?.includes("already exists")) {
    console.error("  ⚠️ Erro ao criar tabela bait_presets:", e.message);
  }
}

// Migração: Adicionar colunas de execução ao bait_presets (para bancos existentes)
try {
  sqlite.exec(`ALTER TABLE bait_presets ADD COLUMN purchased_qty TEXT NOT NULL DEFAULT '';`);
  console.log("  ✓ Coluna 'purchased_qty' adicionada à tabela bait_presets");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna purchased_qty:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bait_presets ADD COLUMN status TEXT NOT NULL DEFAULT 'idle';`);
  console.log("  ✓ Coluna 'status' adicionada à tabela bait_presets");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna status:", e.message);
  }
}

try {
  sqlite.exec(`ALTER TABLE bait_presets ADD COLUMN status_message TEXT;`);
  console.log("  ✓ Coluna 'status_message' adicionada à tabela bait_presets");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna status_message:", e.message);
  }
}

// Migração: adicionar coluna auto_buy_bait_stock (manter estoque por isca)
try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_buy_bait_stock TEXT DEFAULT '';`);
  console.log("  ✓ Coluna 'auto_buy_bait_stock' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_buy_bait_stock:", e.message);
  }
}

// Migração: Adicionar coluna auto_buy_bait_stock ao bait_presets
try {
  sqlite.exec(`ALTER TABLE bait_presets ADD COLUMN auto_buy_bait_stock TEXT NOT NULL DEFAULT '';`);
  console.log("  ✓ Coluna 'auto_buy_bait_stock' adicionada à tabela bait_presets");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_buy_bait_stock em bait_presets:", e.message);
  }
}

// Migração: Adicionar coluna auto_stock_enabled à tabela bots
try {
  sqlite.exec(`ALTER TABLE bots ADD COLUMN auto_stock_enabled INTEGER NOT NULL DEFAULT 0;`);
  console.log("  ✓ Coluna 'auto_stock_enabled' adicionada à tabela bots");
} catch (e: any) {
  if (!e.message?.includes("duplicate column name")) {
    console.error("  ⚠️ Erro ao adicionar coluna auto_stock_enabled:", e.message);
  }
}

sqlite.close();

console.log(`✅ Migração concluída com sucesso!`);
