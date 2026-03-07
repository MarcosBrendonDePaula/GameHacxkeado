import { Keypair, PublicKey } from "@solana/web3.js";
import { eq, desc, and, sql, lt } from "drizzle-orm";
import { FishingService } from "../services/fishing";
import { CastLogMonitor } from "../services/log-monitor";
import { getPlayerStatePDA } from "../utils/pda";
import { BOT_CONFIG } from "../config/constants";
import { db, bots, castResults, botHistory, logs, accounts } from "../db";
import type { Bot, NewBot, NewCastResult, NewBotHistory, NewLog } from "../db";
import * as path from "path";

// Requisitos de casts por nível para upgrade (L2-L60)
const UPGRADE_CAST_REQUIREMENTS = [
  0, 0, 3750, 3869, 3998, 4139, 4291, 4457, 4636, 4831, 5042, 5271, 5520, 5789, 6082, 6400, 6746, 7122, 7531,
  7976, 8461, 8991, 9569, 10200, 10891, 11647, 12476, 13384, 14382, 15480, 16687, 18017, 19484, 21104, 22895,
  24876, 27073, 29509, 32215, 35225, 38576, 42312, 46482, 51144, 56360, 62205, 68762, 76129, 84416, 93749, 104275,
  116162, 129602, 144820, 162073, 181659, 203924, 229267, 258152, 291119, 328795
];

// ============================================================
// DB Write Batcher - acumula INSERTs e grava em lote
// Reduz de ~500 INSERTs/sec para ~5 batch INSERTs/sec
// ============================================================
class DbWriteBatcher {
  private logBuffer: NewLog[] = [];
  private resultBuffer: { walletPubkey: string; type: "catch" | "miss"; fishAmount?: number }[] = [];
  private historyBuffer: NewBotHistory[] = [];
  private flushTimer: ReturnType<typeof setInterval>;
  private static readonly FLUSH_INTERVAL = 2000; // flush a cada 2s
  private static readonly BUFFER_LIMIT = 100; // flush se buffer > 100

  constructor() {
    this.flushTimer = setInterval(() => this.flush(), DbWriteBatcher.FLUSH_INTERVAL);
  }

  addLog(entry: NewLog) {
    this.logBuffer.push(entry);
    if (this.logBuffer.length >= DbWriteBatcher.BUFFER_LIMIT) this.flushLogs();
  }

  addResult(walletPubkey: string, type: "catch" | "miss", fishAmount?: number) {
    this.resultBuffer.push({ walletPubkey, type, fishAmount });
    if (this.resultBuffer.length >= DbWriteBatcher.BUFFER_LIMIT) this.flushResults();
  }

  addHistory(entry: NewBotHistory) {
    this.historyBuffer.push(entry);
  }

  private flushLogs() {
    if (this.logBuffer.length === 0) return;
    const batch = this.logBuffer.splice(0);
    db.insert(logs).values(batch).catch((e) => console.error("Batch log error:", e));
  }

  private flushResults() {
    if (this.resultBuffer.length === 0) return;
    const batch = this.resultBuffer.splice(0);
    db.insert(castResults).values(batch.map(r => ({
      walletPubkey: r.walletPubkey,
      type: r.type,
      fishAmount: r.fishAmount,
    }))).catch((e) => console.error("Batch result error:", e));
  }

  private flushHistory() {
    if (this.historyBuffer.length === 0) return;
    const batch = this.historyBuffer.splice(0);
    db.insert(botHistory).values(batch).catch((e) => console.error("Batch history error:", e));
  }

  flush() {
    this.flushLogs();
    this.flushResults();
    this.flushHistory();
  }

  stop() {
    clearInterval(this.flushTimer);
    this.flush();
  }
}

// Singleton do batcher
const dbBatcher = new DbWriteBatcher();

/**
 * Stats do bot para exibição
 */
export interface BotStats {
  walletPubkey: string;
  status: "online" | "offline";
  catches: number;
  misses: number;
  totalFish: number;
  delayMin: number;
  delayMax: number;
  uptime: string;
  startedAt?: Date;
  pendingCasts?: number;
  sessionPubkey?: string;
  rodLevel?: number;
  durability?: {
    current: number;
    max: number;
    percent: number;
  };
  upgrade?: {
    inProgress: boolean;
    targetLevel: number;
    castsRequired: number;
    castsDone: number;
    castsRemaining: number;
    percent: number;
    estimatedSeconds: number;
  };
  websocket?: {
    status: "connected" | "connecting" | "disconnected" | "reconnecting";
    reconnectAttempts: number;
    lastError?: string;
    lastConnectedAt?: Date;
  };
}

/**
 * Instância de um bot em execução
 * Mantida apenas em memória enquanto o bot está rodando
 */
class BotInstance {
  public stats: BotStats;
  private service?: FishingService;
  private logMonitor?: CastLogMonitor;
  private isRunning = false;
  private startTime?: Date;
  private iterationCount = 0;
  private pendingCount = 0;
  private lastFishCaught = "0";
  private isRepairing = false;
  private isFinishingUpgrade = false;
  private upgradeRetryCount = 0;
  private upgradeNextRetryTime = 0;
  private autoRestartTimer?: NodeJS.Timeout;
  private restartCallback?: () => Promise<void>;
  private currentRepairThreshold: number = 20; // Threshold atual (randomizado)

  constructor(
    public walletPubkey: string,
    public keypair: Keypair,
    public delayMin: number,
    public delayMax: number,
    public proxy?: string,
    public autoRepair: boolean = true,
    public autoRepairMin: number = 15,
    public autoRepairMax: number = 25,
    public autoUpgrade: boolean = false,
    public autoRestartMinutes: number = 240
  ) {
    // Sorteia threshold inicial dentro da range
    this.currentRepairThreshold = this.randomThreshold();

    this.stats = {
      walletPubkey,
      status: "offline",
      catches: 0,
      misses: 0,
      totalFish: 0,
      delayMin,
      delayMax,
      uptime: "0m",
      sessionPubkey: keypair.publicKey.toBase58(),
    };
  }

  /**
   * Gera um delay aleatório dentro da range configurada
   */
  private randomDelay(): number {
    const min = Math.min(this.delayMin, this.delayMax);
    const max = Math.max(this.delayMin, this.delayMax);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Gera um threshold aleatório dentro da range configurada
   */
  private randomThreshold(): number {
    const min = Math.min(this.autoRepairMin, this.autoRepairMax);
    const max = Math.max(this.autoRepairMin, this.autoRepairMax);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = new Date();
    this.stats.status = "online";
    this.stats.startedAt = this.startTime;
    this.pendingCount = 0;

    const sanitizedWallet = this.walletPubkey.slice(0, 8);
    const logFile = path.join("logs", `bot-${sanitizedWallet}.log`);
    const botName = `BOT [${sanitizedWallet}...]`;

    // Usa a wallet original como owner (session key)
    const ownerPublicKey = new PublicKey(this.walletPubkey);

    // Cria serviço de fishing
    this.service = new FishingService(
      this.keypair,
      BOT_CONFIG.rpc_endpoint,
      this.proxy,
      botName,
      logFile,
      ownerPublicKey
    );

    // Calcula PlayerState PDA para WebSocket
    const [playerStatePDA] = getPlayerStatePDA(ownerPublicKey);

    // Cria WebSocket monitor
    this.logMonitor = new CastLogMonitor(
      BOT_CONFIG.rpc_endpoint,
      this.proxy,
      botName,
      playerStatePDA.toBase58()
    );

    // Força início da conexão WebSocket (registra um cast dummy)
    this.logMonitor.registerCast("dummy");

    // Configura callback para resultados do WebSocket
    this.logMonitor.onResult(async (result) => {
      this.pendingCount = Math.max(0, this.pendingCount - 1);

      if (result.isCatch) {
        this.stats.catches++;
        const fishAmount = result.fishAmount || 0;
        this.stats.totalFish += fishAmount;

        // Salva resultado no banco
        this.saveResult("catch", fishAmount);

        this.addLog("success", `🐟 CATCH via WS! +${fishAmount.toFixed(3)} fish`, "websocket");
      } else {
        this.stats.misses++;
        this.saveResult("miss");
        this.addLog("warn", `🔴 MISS via WS`, "websocket");
      }

      this.updateUptime();

      // Registra ponto no histórico a cada 5 resultados
      this.iterationCount++;
      if (this.iterationCount % 5 === 0) {
        this.recordHistoryPoint();
      }
    });

    // Inicia loops em paralelo
    this.castLoop();
    this.stateUpdateLoop();

    // Configura auto-restart se habilitado
    if (this.autoRestartMinutes > 0) {
      this.startAutoRestartTimer();
    }
  }

  /**
   * Define callback para restart (chamado pelo BotManager)
   */
  setRestartCallback(callback: () => Promise<void>) {
    this.restartCallback = callback;
  }

  private startAutoRestartTimer() {
    if (this.autoRestartTimer) {
      clearTimeout(this.autoRestartTimer);
    }

    const intervalMs = this.autoRestartMinutes * 60 * 1000;
    this.autoRestartTimer = setTimeout(async () => {
      if (!this.isRunning) return;

      this.addLog("info", `🔄 Auto-restart programado (${this.autoRestartMinutes} min)`);

      if (this.restartCallback) {
        await this.restartCallback();
      }
    }, intervalMs);
  }

  private async stateUpdateLoop() {
    const updateInterval = 2000;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 10; // Mais tolerante que o cast loop

    while (this.isRunning) {
      try {
        if (!this.service) {
          this.addLog("error", `❌ Service não disponível no stateUpdateLoop, encerrando...`);
          break;
        }

        const playerState = await this.service.fetchPlayerState();
        if (playerState) {
          // Reset contador de erros em caso de sucesso
          if (consecutiveErrors > 0) {
            consecutiveErrors = 0;
          }

          this.lastFishCaught = playerState.fishCaughtAllTime;
          this.stats.rodLevel = playerState.rodLevel;
          const durabilityPercent = playerState.maxDurability > 0
            ? Math.round((playerState.currentDurability / playerState.maxDurability) * 100)
            : 0;
          this.stats.durability = {
            current: playerState.currentDurability,
            max: playerState.maxDurability,
            percent: durabilityPercent,
          };

          // Auto-reparo quando durabilidade <= threshold (randomizado)
          if (this.autoRepair && durabilityPercent <= this.currentRepairThreshold && !this.isRepairing) {
            this.isRepairing = true;
            this.addLog("info", `🔧 Durabilidade ${durabilityPercent}% (threshold: ${this.currentRepairThreshold}%), reparando...`);

            try {
              const signature = await this.service.repairRod();
              if (signature) {
                // Sorteia novo threshold para próximo reparo
                const oldThreshold = this.currentRepairThreshold;
                this.currentRepairThreshold = this.randomThreshold();
                this.addLog("success", `🔧 Reparo OK! Próximo em ~${this.currentRepairThreshold}%`, "repair");
              } else {
                this.addLog("error", `🔧 Falha no reparo automático`, "repair");
              }
            } catch (error: any) {
              this.addLog("error", `🔧 Erro no reparo: ${error.message}`, "repair");
            }

            this.isRepairing = false;
          }

          // Calcula progresso do upgrade para stats
          if (playerState.upgradeInProgress) {
            const targetLevel = playerState.upgradeTargetLevel;
            const castsRequired = UPGRADE_CAST_REQUIREMENTS[targetLevel] || 0;
            const castsDone = parseInt(playerState.castCount) - parseInt(playerState.upgradeCastsAtStart);
            const castsRemaining = Math.max(0, castsRequired - castsDone);
            const percent = castsRequired > 0 ? Math.min(100, Math.round((castsDone / castsRequired) * 100)) : 0;

            // Estima tempo: delay médio + ~500ms overhead por cast
            const avgDelay = (this.delayMin + this.delayMax) / 2;
            const msPerCast = avgDelay + 500;
            const estimatedSeconds = Math.round((castsRemaining * msPerCast) / 1000);

            this.stats.upgrade = {
              inProgress: true,
              targetLevel,
              castsRequired,
              castsDone,
              castsRemaining,
              percent,
              estimatedSeconds,
            };
          } else {
            this.stats.upgrade = undefined;
          }

          // Auto-finish upgrade quando requisito de casts atingido
          if (playerState.upgradeInProgress && !this.isFinishingUpgrade) {
            const targetLevel = playerState.upgradeTargetLevel;
            const castsRequired = UPGRADE_CAST_REQUIREMENTS[targetLevel] || 0;
            const castsDone = parseInt(playerState.castCount) - parseInt(playerState.upgradeCastsAtStart);

            const MAX_UPGRADE_RETRIES = 5;
            if (castsDone >= castsRequired && castsRequired > 0 && Date.now() >= this.upgradeNextRetryTime && this.upgradeRetryCount < MAX_UPGRADE_RETRIES) {
              this.isFinishingUpgrade = true;
              this.addLog("info", `🔨 Upgrade para level ${targetLevel} pronto! Finalizando automaticamente... (tentativa ${this.upgradeRetryCount + 1}/${MAX_UPGRADE_RETRIES})`);

              try {
                const result = await this.finishUpgrade();
                if (result.success) {
                  this.addLog("success", `🔨 Upgrade para level ${targetLevel} finalizado com sucesso!`);
                  this.upgradeRetryCount = 0;
                  this.upgradeNextRetryTime = 0;
                } else {
                  this.upgradeRetryCount++;
                  const backoffMs = Math.min(300_000, 30_000 * Math.pow(2, this.upgradeRetryCount - 1));
                  this.upgradeNextRetryTime = Date.now() + backoffMs;
                  this.addLog("error", `🔨 Falha ao finalizar upgrade: ${result.error} (retry em ${Math.round(backoffMs / 1000)}s)`);
                }
              } catch (error: any) {
                this.upgradeRetryCount++;
                const backoffMs = Math.min(300_000, 30_000 * Math.pow(2, this.upgradeRetryCount - 1));
                this.upgradeNextRetryTime = Date.now() + backoffMs;
                this.addLog("error", `🔨 Erro ao finalizar upgrade: ${error.message} (retry em ${Math.round(backoffMs / 1000)}s)`);
              }

              this.isFinishingUpgrade = false;
            } else if (this.upgradeRetryCount >= MAX_UPGRADE_RETRIES && castsDone >= castsRequired) {
              // Log only once when max retries exceeded
              if (this.upgradeRetryCount === MAX_UPGRADE_RETRIES) {
                this.addLog("error", `🔨 Auto-finish upgrade desativado após ${MAX_UPGRADE_RETRIES} falhas. Finalize manualmente pelo dashboard.`);
                this.upgradeRetryCount++; // prevent re-logging
              }
            }
          } else if (!playerState.upgradeInProgress && this.upgradeRetryCount > 0) {
            // Reset retry state when upgrade is no longer in progress
            this.upgradeRetryCount = 0;
            this.upgradeNextRetryTime = 0;
          }

          // Auto-start upgrade quando não tem upgrade em progresso e autoUpgrade está ligado
          if (this.autoUpgrade && !playerState.upgradeInProgress && !this.isFinishingUpgrade) {
            const nextLevel = playerState.rodLevel + 1;
            if (nextLevel <= 60) {
              this.addLog("info", `🔨 Auto-upgrade: iniciando upgrade para level ${nextLevel}...`);
              try {
                const result = await this.startUpgrade(nextLevel);
                if (result.success) {
                  this.addLog("success", `🔨 Auto-upgrade para level ${nextLevel} iniciado!`);
                } else {
                  this.addLog("error", `🔨 Falha no auto-upgrade: ${result.error}`);
                }
              } catch (error: any) {
                this.addLog("error", `🔨 Erro no auto-upgrade: ${error.message}`);
              }
            }
          }
        } else {
          // Não conseguiu buscar playerState
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            this.addLog("error", `❌ Falha ao buscar playerState ${MAX_CONSECUTIVE_ERRORS} vezes, reiniciando bot...`);
            if (this.restartCallback) {
              await this.restartCallback();
            }
            break;
          }
        }

        await Bun.sleep(updateInterval);
      } catch (error: any) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          this.addLog("error", `❌ Muitos erros no stateUpdateLoop (${MAX_CONSECUTIVE_ERRORS}), reiniciando bot...`);
          if (this.restartCallback) {
            await this.restartCallback();
          }
          break;
        }
        await Bun.sleep(updateInterval * 2);
      }
    }
  }

  async stop() {
    this.isRunning = false;
    this.stats.status = "offline";
    this.pendingCount = 0;

    if (this.autoRestartTimer) {
      clearTimeout(this.autoRestartTimer);
      this.autoRestartTimer = undefined;
    }

    if (this.logMonitor) {
      this.logMonitor.close();
      this.logMonitor = undefined;
    }
  }

  private async castLoop() {
    const botName = `BOT [${this.walletPubkey.slice(0, 8)}...]`;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 10; // Mais tolerante, WebSocket reconecta em background

    try {
      const initialState = await this.service?.fetchPlayerState();
      this.lastFishCaught = initialState?.fishCaughtAllTime || "0";
      if (initialState) {
        this.stats.rodLevel = initialState.rodLevel;
        const durabilityPercent = initialState.maxDurability > 0
          ? Math.round((initialState.currentDurability / initialState.maxDurability) * 100)
          : 0;
        this.stats.durability = {
          current: initialState.currentDurability,
          max: initialState.maxDurability,
          percent: durabilityPercent,
        };
        this.addLog("info", `📊 Estado inicial: ${(parseInt(this.lastFishCaught) / 1_000_000).toFixed(2)} fish | 🎣 Rod Level: ${initialState.rodLevel} | 🔧 Durabilidade: ${durabilityPercent}%`);
      } else {
        this.addLog("info", `📊 Estado inicial: ${(parseInt(this.lastFishCaught) / 1_000_000).toFixed(2)} fish`);
      }
    } catch {
      this.addLog("warn", `⚠️ Não foi possível buscar estado inicial`);
    }

    while (this.isRunning) {
      try {
        // Verifica apenas se service e logMonitor existem (não verifica se estão conectados)
        if (!this.service || !this.logMonitor) {
          this.addLog("error", `❌ Service ou LogMonitor não disponível, encerrando...`);
          break;
        }

        if (this.pendingCount >= 20) {
          await Bun.sleep(200);
          continue;
        }

        const signature = await this.service.castLine(false);

        if (signature) {
          // Cast bem-sucedido - reseta contador de erros
          if (consecutiveErrors > 0) {
            consecutiveErrors = 0;
          }

          this.logMonitor.registerCast(signature);
          this.pendingCount++;
          this.addLog("info", `🎣 Cast enviado! Sig: ${signature.slice(0, 12)}... (⏳ ${this.pendingCount} pendentes)`, "cast");
        } else {
          // Cast falhou
          consecutiveErrors++;
          this.addLog("warn", `⚠️ Falha ao enviar cast (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`, "cast");

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            this.addLog("error", `❌ Falha ao enviar cast ${MAX_CONSECUTIVE_ERRORS} vezes consecutivas, reiniciando bot...`);

            if (this.restartCallback) {
              await this.restartCallback();
            }
            break;
          }
        }

        const currentDelay = this.randomDelay();
        await Bun.sleep(currentDelay);
      } catch (error: any) {
        consecutiveErrors++;
        this.addLog("error", `❌ Erro no cast (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${error.message}`);

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          this.addLog("error", `❌ Muitos erros consecutivos, reiniciando bot...`);

          if (this.restartCallback) {
            await this.restartCallback();
          }
          break;
        }

        const errorDelay = this.randomDelay() * 2;
        await Bun.sleep(errorDelay);
      }
    }
  }

  private saveResult(type: "catch" | "miss", fishAmount?: number) {
    dbBatcher.addResult(this.walletPubkey, type, fishAmount);
  }

  private addLog(level: "info" | "success" | "warn" | "error", message: string, category: "general" | "websocket" | "cast" | "repair" = "general") {
    const botName = `BOT [${this.walletPubkey.slice(0, 8)}...]`;
    const levelEmoji = level === "success" ? "✅" : level === "warn" ? "⚠️" : level === "error" ? "❌" : "ℹ️";
    console.log(`${botName} ${levelEmoji} ${message}`);

    dbBatcher.addLog({
      walletPubkey: this.walletPubkey,
      level,
      category,
      message,
    });
  }

  private recordHistoryPoint() {
    // Usa durabilidade ja em memoria (do stateUpdateLoop) em vez de RPC extra
    const durabilityPercent = this.stats.durability?.percent;

    dbBatcher.addHistory({
      walletPubkey: this.walletPubkey,
      catches: this.stats.catches,
      misses: this.stats.misses,
      totalFish: this.stats.totalFish,
      durability: durabilityPercent,
    });
  }

  private updateUptime() {
    if (this.startTime) {
      const uptimeMs = Date.now() - this.startTime.getTime();
      const hours = Math.floor(uptimeMs / 3600000);
      const minutes = Math.floor((uptimeMs % 3600000) / 60000);
      this.stats.uptime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
  }

  getPendingCount(): number {
    return this.logMonitor?.getPendingCount() || this.pendingCount;
  }

  getWebSocketStatus() {
    if (!this.logMonitor) {
      return { status: "disconnected" as const, reconnectAttempts: 0 };
    }
    return this.logMonitor.getStatus();
  }

  async startUpgrade(targetLevel: number): Promise<{ success: boolean; error?: string }> {
    if (!this.service) {
      return { success: false, error: "Bot não está rodando" };
    }
    try {
      const signature = await this.service.startUpgrade(targetLevel);
      if (signature) {
        this.addLog("success", `🔨 Upgrade para level ${targetLevel} iniciado!`, "general");
        return { success: true };
      }
      return { success: false, error: "Falha ao enviar transação de upgrade" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async finishUpgrade(): Promise<{ success: boolean; error?: string }> {
    if (!this.service) {
      return { success: false, error: "Bot não está rodando" };
    }
    try {
      const signature = await this.service.finishUpgrade();
      if (signature) {
        this.addLog("success", `🔨 Upgrade finalizado com sucesso!`, "general");
        return { success: true };
      }
      return { success: false, error: "Falha ao enviar transação de finish upgrade" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

/**
 * Gerenciador de bots usando SQLite
 * Cada wallet = max 1 bot
 */
export class BotManager {
  // Bots em execução (em memória)
  private runningBots: Map<string, BotInstance> = new Map();

  constructor() {}

  /**
   * Obtém o bot de uma wallet do banco
   */
  async getBot(walletPubkey: string): Promise<Bot | null> {
    const result = await db
      .select()
      .from(bots)
      .where(eq(bots.walletPubkey, walletPubkey))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Cria ou atualiza o bot de uma wallet
   * Session key armazenada em plaintext (Base64)
   */
  async upsertBot(params: {
    walletPubkey: string;
    sessionSecretKey: string; // Base64 encoded (32 bytes)
    sessionPublicKey: string; // Base58
    delayMin?: number;
    delayMax?: number;
    proxy?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const botData: Partial<NewBot> = {
        walletPubkey: params.walletPubkey,
        sessionSecretKey: params.sessionSecretKey,
        sessionPubkey: params.sessionPublicKey,
        delayMin: params.delayMin ?? 1500,
        delayMax: params.delayMax ?? 3000,
        proxy: params.proxy,
        enabled: true,
        updatedAt: new Date(),
      };

      // Verifica se já existe
      const existing = await this.getBot(params.walletPubkey);

      if (existing) {
        await db
          .update(bots)
          .set(botData)
          .where(eq(bots.walletPubkey, params.walletPubkey));
      } else {
        await db.insert(bots).values(botData as NewBot);
      }

      return { success: true };
    } catch (error: any) {
      console.error("Erro ao salvar bot:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Inicia o bot de uma wallet
   * Session key lida diretamente do DB (plaintext Base64)
   */
  async startBot(
    walletPubkey: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verifica se já está rodando
      if (this.runningBots.has(walletPubkey)) {
        return { success: false, error: "Bot já está rodando" };
      }

      // Busca o bot no banco
      const bot = await this.getBot(walletPubkey);
      if (!bot) {
        return { success: false, error: "Bot não encontrado" };
      }

      if (!bot.sessionSecretKey) {
        return { success: false, error: "Session key não configurada" };
      }

      // Decodifica session key do Base64
      const sessionKeyBytes = new Uint8Array(Buffer.from(bot.sessionSecretKey, "base64"));

      // Reconstrói o keypair (32 bytes secret + 32 bytes public = 64 bytes)
      const publicKey = new PublicKey(bot.sessionPubkey!);
      const publicKeyBytes = publicKey.toBytes();

      const fullSecretKey = new Uint8Array(64);
      fullSecretKey.set(sessionKeyBytes, 0);
      fullSecretKey.set(publicKeyBytes, 32);

      const keypair = Keypair.fromSecretKey(fullSecretKey);

      // Cria instância do bot
      const instance = new BotInstance(
        walletPubkey,
        keypair,
        bot.delayMin ?? 1500,
        bot.delayMax ?? 3000,
        bot.proxy || undefined,
        bot.autoRepair ?? true,
        bot.autoRepairMin ?? 15,
        bot.autoRepairMax ?? 25,
        bot.autoUpgrade ?? false,
        bot.autoRestartMinutes ?? 240
      );

      // Configura callback de restart
      instance.setRestartCallback(async () => {
        await this.restartBot(walletPubkey);
      });

      // Inicia
      await instance.start();

      // Salva na memória
      this.runningBots.set(walletPubkey, instance);

      // Atualiza enabled no banco
      await db
        .update(bots)
        .set({ enabled: true, updatedAt: new Date() })
        .where(eq(bots.walletPubkey, walletPubkey));

      return { success: true };
    } catch (error: any) {
      console.error("Erro ao iniciar bot:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Para o bot de uma wallet
   */
  async stopBot(walletPubkey: string): Promise<{ success: boolean; error?: string }> {
    const instance = this.runningBots.get(walletPubkey);
    if (!instance) {
      return { success: false, error: "Bot não está rodando" };
    }

    await instance.stop();
    this.runningBots.delete(walletPubkey);

    // Atualiza enabled no banco
    await db
      .update(bots)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(bots.walletPubkey, walletPubkey));

    return { success: true };
  }

  /**
   * Reinicia o bot (para e inicia novamente)
   */
  async restartBot(walletPubkey: string): Promise<{ success: boolean; error?: string }> {
    console.log(`🔄 Reiniciando bot ${walletPubkey.slice(0, 8)}...`);

    // Para o bot atual (sem mudar enabled no banco)
    const instance = this.runningBots.get(walletPubkey);
    if (instance) {
      await instance.stop();
      this.runningBots.delete(walletPubkey);
    }

    // Aguarda um pouco antes de reiniciar
    await Bun.sleep(2000);

    // Inicia novamente
    return this.startBot(walletPubkey);
  }

  /**
   * Remove o bot de uma wallet
   */
  async removeBot(walletPubkey: string): Promise<{ success: boolean; error?: string }> {
    // Para se estiver rodando
    if (this.runningBots.has(walletPubkey)) {
      await this.stopBot(walletPubkey);
    }

    // Remove do banco
    await db.delete(bots).where(eq(bots.walletPubkey, walletPubkey));

    return { success: true };
  }

  /**
   * Obtém stats do bot em execução
   */
  getBotStats(walletPubkey: string): BotStats | null {
    const instance = this.runningBots.get(walletPubkey);
    if (!instance) {
      return null;
    }

    instance.stats.pendingCasts = instance.getPendingCount();

    // Adiciona informações do WebSocket
    const wsStatus = instance.getWebSocketStatus();
    instance.stats.websocket = {
      status: wsStatus.status,
      reconnectAttempts: wsStatus.reconnectAttempts,
      lastError: wsStatus.lastError,
    };

    return instance.stats;
  }

  /**
   * Verifica se o bot está rodando
   */
  isRunning(walletPubkey: string): boolean {
    return this.runningBots.has(walletPubkey);
  }

  /**
   * Obtém resultados do bot
   */
  async getResults(
    walletPubkey: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ results: any[]; total: number }> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const results = await db
      .select()
      .from(castResults)
      .where(eq(castResults.walletPubkey, walletPubkey))
      .orderBy(desc(castResults.timestamp))
      .limit(limit)
      .offset(offset);

    // TODO: Implementar count
    const total = results.length;

    return { results, total };
  }

  /**
   * Obtém histórico do bot
   */
  async getHistory(
    walletPubkey: string,
    options: { limit?: number } = {}
  ): Promise<any[]> {
    const limit = options.limit || 100;

    return db
      .select()
      .from(botHistory)
      .where(eq(botHistory.walletPubkey, walletPubkey))
      .orderBy(desc(botHistory.timestamp))
      .limit(limit);
  }

  /**
   * Obtém logs do bot
   */
  async getLogs(
    walletPubkey: string,
    options: { limit?: number; offset?: number; level?: string; category?: string } = {}
  ): Promise<{ logs: any[]; total: number }> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    // Constrói condições de filtro
    const conditions = [eq(logs.walletPubkey, walletPubkey)];
    if (options.level) {
      conditions.push(eq(logs.level, options.level as any));
    }
    if (options.category && options.category !== 'all') {
      conditions.push(eq(logs.category, options.category as any));
    }

    const result = await db
      .select()
      .from(logs)
      .where(and(...conditions))
      .orderBy(desc(logs.timestamp))
      .limit(limit)
      .offset(offset);

    // Conta total com mesmo filtro
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(logs)
      .where(and(...conditions));

    const total = countResult[0]?.count || result.length;

    return { logs: result, total };
  }

  /**
   * Obtém estatísticas globais
   */
  async getGlobalStats(): Promise<{
    totalBots: number;
    activeBots: number;
    totalCatches: number;
    totalMisses: number;
    totalFish: number;
  }> {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bots);

    let totalCatches = 0;
    let totalMisses = 0;
    let totalFish = 0;

    for (const instance of this.runningBots.values()) {
      totalCatches += instance.stats.catches;
      totalMisses += instance.stats.misses;
      totalFish += instance.stats.totalFish;
    }

    return {
      totalBots: countResult[0]?.count || 0,
      activeBots: this.runningBots.size,
      totalCatches,
      totalMisses,
      totalFish,
    };
  }

  /**
   * Auto-inicia bots que estavam enabled=true no banco
   * Chamado ao iniciar o servidor para restaurar estado anterior
   */
  async autoStartBots(): Promise<number> {
    console.log(`🔄 Auto-start: verificando bots habilitados no banco...`);

    try {
      // Pequeno delay para garantir que tudo está inicializado
      await Bun.sleep(1000);

      const enabledBots = await db
        .select()
        .from(bots)
        .where(eq(bots.enabled, true));

      if (enabledBots.length === 0) {
        console.log(`🔄 Auto-start: nenhum bot habilitado encontrado`);
        return 0;
      }

      console.log(`🔄 Restaurando ${enabledBots.length} bot(s) do banco...`);

      let started = 0;
      for (const bot of enabledBots) {
        if (!bot.sessionSecretKey) {
          console.log(`  ⚠️ ${bot.walletPubkey.slice(0, 8)}... sem session key, pulando`);
          continue;
        }

        try {
          const result = await this.startBot(bot.walletPubkey);
          if (result.success) {
            console.log(`  ✅ ${bot.walletPubkey.slice(0, 8)}... restaurado`);
            started++;
          } else {
            console.log(`  ❌ ${bot.walletPubkey.slice(0, 8)}... falhou: ${result.error}`);
          }
        } catch (botError: any) {
          console.error(`  ❌ ${bot.walletPubkey.slice(0, 8)}... erro: ${botError.message}`);
        }

        // Pequeno delay entre bots para não sobrecarregar
        await Bun.sleep(500);
      }

      console.log(`🔄 ${started}/${enabledBots.length} bot(s) restaurados`);
      return started;
    } catch (error: any) {
      console.error(`❌ Erro no auto-start:`, error.message);
      return 0;
    }
  }

  /**
   * Limpeza periódica de dados antigos
   * Remove logs, castResults e botHistory com mais de maxAgeDays dias
   */
  async cleanupOldData(maxAgeDays: number = 3): Promise<{ logsDeleted: number; resultsDeleted: number; historyDeleted: number }> {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

    const logsResult = await db.delete(logs).where(lt(logs.timestamp, cutoff));
    const resultsResult = await db.delete(castResults).where(lt(castResults.timestamp, cutoff));
    const historyResult = await db.delete(botHistory).where(lt(botHistory.timestamp, cutoff));

    const logsDeleted = logsResult.changes;
    const resultsDeleted = resultsResult.changes;
    const historyDeleted = historyResult.changes;

    if (logsDeleted > 0 || resultsDeleted > 0 || historyDeleted > 0) {
      console.log(`🧹 Cleanup: ${logsDeleted} logs, ${resultsDeleted} results, ${historyDeleted} history (>${maxAgeDays} dias)`);
    }

    return { logsDeleted, resultsDeleted, historyDeleted };
  }

  /**
   * Inicia upgrade da vara do bot
   */
  async startUpgrade(walletPubkey: string, targetLevel: number): Promise<{ success: boolean; error?: string }> {
    const instance = this.runningBots.get(walletPubkey);
    if (!instance) {
      return { success: false, error: "Bot não está rodando" };
    }
    return instance.startUpgrade(targetLevel);
  }

  /**
   * Finaliza upgrade da vara do bot
   */
  async finishUpgrade(walletPubkey: string): Promise<{ success: boolean; error?: string }> {
    const instance = this.runningBots.get(walletPubkey);
    if (!instance) {
      return { success: false, error: "Bot não está rodando" };
    }
    return instance.finishUpgrade();
  }

  /**
   * Atualiza configurações do bot
   */
  async updateBotConfig(
    walletPubkey: string,
    config: { delayMin?: number; delayMax?: number; proxy?: string; autoRepair?: boolean; autoRepairMin?: number; autoRepairMax?: number; autoUpgrade?: boolean; autoRestartMinutes?: number }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Só inclui campos que foram definidos (evita sobrescrever com undefined)
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (config.delayMin !== undefined) updateData.delayMin = config.delayMin;
      if (config.delayMax !== undefined) updateData.delayMax = config.delayMax;
      if (config.proxy !== undefined) updateData.proxy = config.proxy;
      if (config.autoRepair !== undefined) updateData.autoRepair = config.autoRepair;
      if (config.autoRepairMin !== undefined) updateData.autoRepairMin = config.autoRepairMin;
      if (config.autoRepairMax !== undefined) updateData.autoRepairMax = config.autoRepairMax;
      if (config.autoUpgrade !== undefined) updateData.autoUpgrade = config.autoUpgrade;
      if (config.autoRestartMinutes !== undefined) updateData.autoRestartMinutes = config.autoRestartMinutes;

      await db
        .update(bots)
        .set(updateData)
        .where(eq(bots.walletPubkey, walletPubkey));

      // Se o bot está rodando, atualiza as configs em memória
      const instance = this.runningBots.get(walletPubkey);
      if (instance) {
        if (config.delayMin !== undefined) {
          instance.delayMin = config.delayMin;
          instance.stats.delayMin = config.delayMin;
        }
        if (config.delayMax !== undefined) {
          instance.delayMax = config.delayMax;
          instance.stats.delayMax = config.delayMax;
        }
        if (config.autoRepair !== undefined) {
          instance.autoRepair = config.autoRepair;
        }
        if (config.autoRepairMin !== undefined) {
          instance.autoRepairMin = config.autoRepairMin;
        }
        if (config.autoRepairMax !== undefined) {
          instance.autoRepairMax = config.autoRepairMax;
        }
        if (config.autoUpgrade !== undefined) {
          instance.autoUpgrade = config.autoUpgrade;
        }
        if (config.autoRestartMinutes !== undefined) {
          instance.autoRestartMinutes = config.autoRestartMinutes;
        }
        // Nota: proxy e autoRestartMinutes requerem reiniciar o bot para aplicar totalmente
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

// Exporta instância singleton
export const botManager = new BotManager();
