import { Keypair, PublicKey } from "@solana/web3.js";
import { eq, desc, and, sql } from "drizzle-orm";
import { FishingService } from "../services/fishing";
import { CastLogMonitor } from "../services/log-monitor";
import { getPlayerStatePDA } from "../utils/pda";
import { BOT_CONFIG } from "../config/constants";
import { db, bots, castResults, botHistory, logs, accounts } from "../db";
import type { Bot, NewBot, NewCastResult, NewBotHistory, NewLog } from "../db";
import { decryptSessionKey, encryptSessionKey, sessionKeyFromBase64 } from "../crypto";
import * as path from "path";

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

    // Configura callback para resultados do WebSocket
    this.logMonitor.onResult(async (result) => {
      this.pendingCount = Math.max(0, this.pendingCount - 1);

      if (result.isCatch) {
        this.stats.catches++;
        const fishAmount = result.fishAmount || 0;
        this.stats.totalFish += fishAmount;

        // Salva resultado no banco
        await this.saveResult("catch", fishAmount);

        await this.addLog("success", `🐟 CATCH via WS! +${fishAmount.toFixed(3)} fish`);
      } else {
        this.stats.misses++;
        await this.saveResult("miss");
        await this.addLog("warn", `🔴 MISS via WS`);
      }

      this.updateUptime();

      // Registra ponto no histórico a cada 5 resultados
      this.iterationCount++;
      if (this.iterationCount % 5 === 0) {
        await this.recordHistoryPoint();
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

      await this.addLog("info", `🔄 Auto-restart programado (${this.autoRestartMinutes} min)`);

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
          await this.addLog("error", `❌ Service não disponível no stateUpdateLoop, encerrando...`);
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
            await this.addLog("info", `🔧 Durabilidade ${durabilityPercent}% (threshold: ${this.currentRepairThreshold}%), reparando...`);

            try {
              const signature = await this.service.repairRod();
              if (signature) {
                // Sorteia novo threshold para próximo reparo
                const oldThreshold = this.currentRepairThreshold;
                this.currentRepairThreshold = this.randomThreshold();
                await this.addLog("success", `🔧 Reparo OK! Próximo em ~${this.currentRepairThreshold}%`);
              } else {
                await this.addLog("error", `🔧 Falha no reparo automático`);
              }
            } catch (error: any) {
              await this.addLog("error", `🔧 Erro no reparo: ${error.message}`);
            }

            this.isRepairing = false;
          }
        } else {
          // Não conseguiu buscar playerState
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            await this.addLog("error", `❌ Falha ao buscar playerState ${MAX_CONSECUTIVE_ERRORS} vezes, reiniciando bot...`);
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
          await this.addLog("error", `❌ Muitos erros no stateUpdateLoop (${MAX_CONSECUTIVE_ERRORS}), reiniciando bot...`);
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
    const MAX_CONSECUTIVE_ERRORS = 5;
    const RECOVERY_WAIT_MS = 5000; // 5 segundos para dar chance de reconectar

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
        await this.addLog("info", `📊 Estado inicial: ${(parseInt(this.lastFishCaught) / 1_000_000).toFixed(2)} fish | 🎣 Rod Level: ${initialState.rodLevel} | 🔧 Durabilidade: ${durabilityPercent}%`);
      } else {
        await this.addLog("info", `📊 Estado inicial: ${(parseInt(this.lastFishCaught) / 1_000_000).toFixed(2)} fish`);
      }
    } catch {
      await this.addLog("warn", `⚠️ Não foi possível buscar estado inicial`);
    }

    while (this.isRunning) {
      try {
        // Verifica se service existe
        if (!this.service) {
          await this.addLog("error", `❌ Service não disponível, encerrando...`);
          break;
        }

        // Verifica se logMonitor existe e está saudável
        if (!this.logMonitor) {
          await this.addLog("error", `❌ LogMonitor não disponível, encerrando...`);
          break;
        }

        if (!this.logMonitor.isHealthy()) {
          consecutiveErrors++;
          await this.addLog("warn", `⚠️ WebSocket não está saudável (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}), aguardando reconexão...`);

          // Aguarda um tempo para dar chance de reconectar
          await Bun.sleep(RECOVERY_WAIT_MS);

          // Se atingiu o máximo de erros, tenta reiniciar o bot
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            await this.addLog("error", `❌ WebSocket falhou ${MAX_CONSECUTIVE_ERRORS} vezes, reiniciando bot...`);

            // Chama callback de restart se disponível
            if (this.restartCallback) {
              await this.restartCallback();
            }
            break;
          }
          continue;
        }

        // Se chegou aqui, está tudo ok - reseta contador de erros
        if (consecutiveErrors > 0) {
          await this.addLog("success", `✅ WebSocket recuperado!`);
          consecutiveErrors = 0;
        }

        if (this.pendingCount >= 20) {
          await Bun.sleep(200);
          continue;
        }

        const signature = await this.service.castLine(false);

        if (signature) {
          this.logMonitor.registerCast(signature, this.lastFishCaught);
          this.pendingCount++;
          await this.addLog("info", `🎣 Cast enviado! Sig: ${signature.slice(0, 12)}... (⏳ ${this.pendingCount} pendentes)`);
        } else {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            await this.addLog("error", `❌ Falha ao enviar cast ${MAX_CONSECUTIVE_ERRORS} vezes, reiniciando bot...`);

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
        await this.addLog("error", `❌ Erro no cast (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${error.message}`);

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          await this.addLog("error", `❌ Muitos erros consecutivos, reiniciando bot...`);

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

  private async saveResult(type: "catch" | "miss", fishAmount?: number) {
    try {
      await db.insert(castResults).values({
        walletPubkey: this.walletPubkey,
        type,
        fishAmount,
      });
    } catch (error) {
      console.error("Erro ao salvar resultado:", error);
    }
  }

  private async addLog(level: "info" | "success" | "warn" | "error", message: string) {
    // Imprime no console também
    const botName = `BOT [${this.walletPubkey.slice(0, 8)}...]`;
    const levelEmoji = level === "success" ? "✅" : level === "warn" ? "⚠️" : level === "error" ? "❌" : "ℹ️";
    console.log(`${botName} ${levelEmoji} ${message}`);

    try {
      await db.insert(logs).values({
        walletPubkey: this.walletPubkey,
        level,
        message,
      });
    } catch (error) {
      console.error("Erro ao salvar log:", error);
    }
  }

  private async recordHistoryPoint() {
    let durabilityPercent: number | undefined;
    try {
      const playerState = await this.service?.fetchPlayerState();
      if (playerState) {
        const current = playerState.currentDurability;
        const max = playerState.maxDurability;
        durabilityPercent = max > 0 ? (current / max) * 100 : 0;
      }
    } catch {
      // Ignora erro
    }

    try {
      await db.insert(botHistory).values({
        walletPubkey: this.walletPubkey,
        catches: this.stats.catches,
        misses: this.stats.misses,
        totalFish: this.stats.totalFish,
        durability: durabilityPercent,
      });
    } catch (error) {
      console.error("Erro ao salvar histórico:", error);
    }
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
   * A session key é criptografada usando a assinatura fornecida
   */
  async upsertBot(params: {
    walletPubkey: string;
    sessionSecretKey: string; // Base64 encoded (32 bytes)
    sessionPublicKey: string; // Base58
    encryptionSignature: string; // Assinatura para criptografar
    delayMin?: number;
    delayMax?: number;
    proxy?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Decodifica a session key
      const sessionKeyBytes = sessionKeyFromBase64(params.sessionSecretKey);

      // Criptografa a session key
      const encrypted = await encryptSessionKey(sessionKeyBytes, params.encryptionSignature);

      const botData: Partial<NewBot> = {
        walletPubkey: params.walletPubkey,
        encryptedSessionKey: encrypted.encrypted,
        sessionKeyIv: encrypted.iv,
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
        // Atualiza
        await db
          .update(bots)
          .set(botData)
          .where(eq(bots.walletPubkey, params.walletPubkey));
      } else {
        // Cria
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
   * Requer a assinatura de criptografia para descriptografar a session key
   */
  async startBot(
    walletPubkey: string,
    encryptionSignature: string
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

      if (!bot.encryptedSessionKey || !bot.sessionKeyIv) {
        return { success: false, error: "Session key não configurada" };
      }

      // Descriptografa a session key
      let sessionKeyBytes: Uint8Array;
      try {
        sessionKeyBytes = await decryptSessionKey(
          bot.encryptedSessionKey,
          bot.sessionKeyIv,
          encryptionSignature
        );
      } catch {
        return { success: false, error: "Falha ao descriptografar session key - assinatura inválida" };
      }

      // Reconstrói o keypair
      // sessionKeyBytes são 32 bytes (só a parte privada)
      // Precisamos combinar com a public key
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
        bot.autoRestartMinutes ?? 240
      );

      // Configura callback de restart
      instance.setRestartCallback(async () => {
        await this.restartBot(walletPubkey, encryptionSignature);
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
  async restartBot(walletPubkey: string, encryptionSignature: string): Promise<{ success: boolean; error?: string }> {
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
    return this.startBot(walletPubkey, encryptionSignature);
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
    options: { limit?: number; offset?: number; level?: string } = {}
  ): Promise<{ logs: any[]; total: number }> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    // Constrói condições de filtro
    const conditions = [eq(logs.walletPubkey, walletPubkey)];
    if (options.level) {
      conditions.push(eq(logs.level, options.level as any));
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
    const allBots = await db.select().from(bots);

    let totalCatches = 0;
    let totalMisses = 0;
    let totalFish = 0;

    for (const instance of this.runningBots.values()) {
      totalCatches += instance.stats.catches;
      totalMisses += instance.stats.misses;
      totalFish += instance.stats.totalFish;
    }

    return {
      totalBots: allBots.length,
      activeBots: this.runningBots.size,
      totalCatches,
      totalMisses,
      totalFish,
    };
  }

  /**
   * Atualiza configurações do bot
   */
  async updateBotConfig(
    walletPubkey: string,
    config: { delayMin?: number; delayMax?: number; proxy?: string; autoRepair?: boolean; autoRepairMin?: number; autoRepairMax?: number; autoRestartMinutes?: number }
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
