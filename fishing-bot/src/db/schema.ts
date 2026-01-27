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
  encryptedSessionKey: blob("encrypted_session_key", { mode: "buffer" }), // AES-GCM encrypted
  sessionKeyIv: blob("session_key_iv", { mode: "buffer" }), // IV para decriptar
  sessionPubkey: text("session_pubkey"), // Public key da session
  delayMin: integer("delay_min").default(1500), // Delay minimo entre casts (ms)
  delayMax: integer("delay_max").default(3000), // Delay maximo entre casts (ms)
  proxy: text("proxy"),
  autoRepair: integer("auto_repair", { mode: "boolean" }).default(true), // Auto-reparo habilitado
  autoRepairMin: integer("auto_repair_min").default(15), // Durabilidade minima da range (%)
  autoRepairMax: integer("auto_repair_max").default(25), // Durabilidade maxima da range (%)
  autoRestartMinutes: integer("auto_restart_minutes").default(240), // Auto-restart a cada X minutos (0 = desabilitado)
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
  message: text("message").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" })
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
