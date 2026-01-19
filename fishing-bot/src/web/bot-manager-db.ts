import { Keypair, PublicKey } from "@solana/web3.js";
import { eq, desc } from "drizzle-orm";
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
  delay: number;
  uptime: string;
  startedAt?: Date;
  pendingCasts?: number;
  sessionPubkey?: string;
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

  constructor(
    public walletPubkey: string,
    public keypair: Keypair,
    public delay: number,
    public proxy?: string
  ) {
    this.stats = {
      walletPubkey,
      status: "offline",
      catches: 0,
      misses: 0,
      totalFish: 0,
      delay,
      uptime: "0m",
      sessionPubkey: keypair.publicKey.toBase58(),
    };
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
  }

  private async stateUpdateLoop() {
    const updateInterval = 2000;

    while (this.isRunning) {
      try {
        if (!this.service) break;

        const playerState = await this.service.fetchPlayerState();
        if (playerState) {
          this.lastFishCaught = playerState.fishCaughtAllTime;
        }

        await Bun.sleep(updateInterval);
      } catch {
        await Bun.sleep(updateInterval * 2);
      }
    }
  }

  async stop() {
    this.isRunning = false;
    this.stats.status = "offline";
    this.pendingCount = 0;

    if (this.logMonitor) {
      this.logMonitor.close();
      this.logMonitor = undefined;
    }
  }

  private async castLoop() {
    const botName = `BOT [${this.walletPubkey.slice(0, 8)}...]`;

    try {
      const initialState = await this.service?.fetchPlayerState();
      this.lastFishCaught = initialState?.fishCaughtAllTime || "0";
      await this.addLog("info", `📊 Estado inicial: ${(parseInt(this.lastFishCaught) / 1_000_000).toFixed(2)} fish`);
    } catch {
      await this.addLog("warn", `⚠️ Não foi possível buscar estado inicial`);
    }

    while (this.isRunning) {
      try {
        if (!this.service || !this.logMonitor) break;

        if (this.pendingCount >= 20) {
          await Bun.sleep(200);
          continue;
        }

        const signature = await this.service.castLine(false);

        if (signature) {
          this.logMonitor.registerCast(signature, this.lastFishCaught);
          this.pendingCount++;
          await this.addLog("info", `🎣 Cast enviado! Sig: ${signature.slice(0, 12)}... (⏳ ${this.pendingCount} pendentes)`);
        }

        await Bun.sleep(this.delay);
      } catch (error: any) {
        await this.addLog("error", `❌ Erro no cast: ${error.message}`);
        await Bun.sleep(this.delay * 2);
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
    delay?: number;
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
        delay: params.delay || BOT_CONFIG.autocast_delay,
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
        bot.delay || BOT_CONFIG.autocast_delay,
        bot.proxy || undefined
      );

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

    let query = db
      .select()
      .from(logs)
      .where(eq(logs.walletPubkey, walletPubkey))
      .orderBy(desc(logs.timestamp))
      .limit(limit)
      .offset(offset);

    const result = await query;

    return { logs: result, total: result.length };
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
    config: { delay?: number; proxy?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await db
        .update(bots)
        .set({
          delay: config.delay,
          proxy: config.proxy,
          updatedAt: new Date(),
        })
        .where(eq(bots.walletPubkey, walletPubkey));

      // Se o bot está rodando, atualiza as configs em memória
      const instance = this.runningBots.get(walletPubkey);
      if (instance) {
        instance.stats.delay = config.delay || instance.stats.delay;
        // Nota: proxy requer reiniciar o bot
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

// Exporta instância singleton
export const botManager = new BotManager();
