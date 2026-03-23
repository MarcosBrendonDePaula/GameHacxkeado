import { sqliteTable, text, integer, real, blob } from "drizzle-orm/sqlite-core";

// Contas - Uma por wallet
export const accounts = sqliteTable("accounts", {
  walletPubkey: text("wallet_pubkey").primaryKey(), // Base58
  name: text("name"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
});

// Bots - Max 1 por wallet
export const bots = sqliteTable("bots", {
  walletPubkey: text("wallet_pubkey")
    .primaryKey()
    .references(() => accounts.walletPubkey, { onDelete: "cascade" }),
  sessionSecretKey: text("session_secret_key"), // Base64 encoded (32 bytes) - plaintext
  sessionPubkey: text("session_pubkey"), // Public key da session
  delayMin: integer("delay_min").default(2300), // Delay minimo entre casts (ms)
  delayMax: integer("delay_max").default(2600), // Delay maximo entre casts (ms)
  proxy: text("proxy"),
  autoRepair: integer("auto_repair", { mode: "boolean" }).default(false), // Auto-reparo habilitado
  autoRepairMin: integer("auto_repair_min").default(15), // Durabilidade minima da range (%)
  autoRepairMax: integer("auto_repair_max").default(25), // Durabilidade maxima da range (%)
  autoRepairWaitMinMinutes: integer("auto_repair_wait_min_minutes").default(0), // Espera minima apos repair (min)
  autoRepairWaitMaxMinutes: integer("auto_repair_wait_max_minutes").default(0), // Espera maxima apos repair (min)
  autoWaitDurability: integer("auto_wait_durability", { mode: "boolean" }).default(false), // Espera por durabilidade sem reparar
  autoWaitDurabilityMin: integer("auto_wait_durability_min").default(15), // Durabilidade minima da range (%)
  autoWaitDurabilityMax: integer("auto_wait_durability_max").default(25), // Durabilidade maxima da range (%)
  autoWaitMinutesMin: integer("auto_wait_minutes_min").default(0), // Espera minima quando entrar no modo pausa (min)
  autoWaitMinutesMax: integer("auto_wait_minutes_max").default(0), // Espera maxima quando entrar no modo pausa (min)
  currentWaitThreshold: integer("current_wait_threshold").default(0), // Threshold sorteado atual para a pausa por durabilidade
  durabilityPauseUntil: integer("durability_pause_until", { mode: "timestamp" }), // Quando a pausa atual termina
  autoUpgrade: integer("auto_upgrade", { mode: "boolean" }).default(false), // Auto-upgrade da vara
  autoRestartMinutes: integer("auto_restart_minutes").default(240), // Auto-restart a cada X minutos (0 = desabilitado)
  autoBuyBait: integer("auto_buy_bait", { mode: "boolean" }).default(false), // Auto-compra de iscas
  autoBuyBaitIds: text("auto_buy_bait_ids").default(""), // IDs das iscas para auto-compra (ex: "1,3,7")
  autoUseBaitId: integer("auto_use_bait_id").default(0), // ID da isca para auto-equipar (0 = desativado) - DEPRECATED, usar autoUseBaitOrder
  autoUseBaitOrder: text("auto_use_bait_order").default(""), // Ordem de prioridade das iscas para auto-equipar (ex: "1,5,3")
  autoBuyBaitThreshold: integer("auto_buy_bait_threshold").default(100), // DEPRECATED: fallback global quando threshold individual nao definido
  autoBuyBaitThresholds: text("auto_buy_bait_thresholds").default(""), // Threshold individual por isca (ex: "1:100,3:50,7:200")
  autoBuyBaitQty: text("auto_buy_bait_qty").default(""), // Quantidade por isca para auto-compra (ex: "1:5,3:10")
  autoBuyBaitStock: text("auto_buy_bait_stock").default(""), // Manter estoque por isca (ex: "1:500,3:1000") - compra quando cair abaixo
  autoStockEnabled: integer("auto_stock_enabled", { mode: "boolean" }).default(false), // Toggle para habilitar modo estoque
  enabled: integer("enabled", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Resultados de Cast
export const castResults = sqliteTable("cast_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  walletPubkey: text("wallet_pubkey")
    .notNull()
    .references(() => accounts.walletPubkey, { onDelete: "cascade" }),
  type: text("type", { enum: ["catch", "miss"] }).notNull(),
  fishAmount: real("fish_amount"),
  signature: text("signature"),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Histórico temporal (snapshots periódicos)
export const botHistory = sqliteTable("bot_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  walletPubkey: text("wallet_pubkey")
    .notNull()
    .references(() => accounts.walletPubkey, { onDelete: "cascade" }),
  catches: integer("catches").notNull().default(0),
  misses: integer("misses").notNull().default(0),
  totalFish: real("total_fish").notNull().default(0),
  durability: real("durability"),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Logs
export const logs = sqliteTable("logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  walletPubkey: text("wallet_pubkey").references(() => accounts.walletPubkey, {
    onDelete: "cascade",
  }),
  level: text("level", { enum: ["info", "success", "warn", "error"] }).notNull(),
  category: text("category", { enum: ["general", "websocket", "cast", "repair"] }).default("general"),
  message: text("message").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Presets de Isca - Configurações salváveis e compartilháveis
export const baitPresets = sqliteTable("bait_presets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  walletPubkey: text("wallet_pubkey")
    .notNull()
    .references(() => accounts.walletPubkey, { onDelete: "cascade" }),
  name: text("name").notNull(),
  autoBuyBaitIds: text("auto_buy_bait_ids").notNull().default(""),         // IDs das iscas (ex: "1,3,7")
  autoBuyBaitThresholds: text("auto_buy_bait_thresholds").notNull().default(""), // thresholds (para auto-buy config)
  autoBuyBaitQty: text("auto_buy_bait_qty").notNull().default(""),         // Meta: quanto comprar (ex: "1:10,6:50")
  autoUseBaitOrder: text("auto_use_bait_order").notNull().default(""),     // Ordem de prioridade
  autoBuyBaitStock: text("auto_buy_bait_stock").notNull().default(""),     // Manter estoque (ex: "1:500,3:1000")
  // Execução do carrinho
  purchasedQty: text("purchased_qty").notNull().default(""),               // Progresso: quanto já comprou (ex: "1:3,6:12")
  status: text("status", { enum: ["idle", "running", "done", "error"] }).notNull().default("idle"),
  statusMessage: text("status_message"),                                   // Mensagem de erro ou info
  shareCode: text("share_code").unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Types para TypeScript
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Bot = typeof bots.$inferSelect;
export type NewBot = typeof bots.$inferInsert;
export type CastResult = typeof castResults.$inferSelect;
export type NewCastResult = typeof castResults.$inferInsert;
export type BotHistory = typeof botHistory.$inferSelect;
export type NewBotHistory = typeof botHistory.$inferInsert;
export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;
export type BaitPreset = typeof baitPresets.$inferSelect;
export type NewBaitPreset = typeof baitPresets.$inferInsert;
