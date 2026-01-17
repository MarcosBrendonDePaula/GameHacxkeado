import { Keypair, PublicKey } from "@solana/web3.js";
import { FishingService } from "../services/fishing";
import { CastLogMonitor } from "../services/log-monitor";
import { getPlayerStatePDA } from "../utils/pda";
import { Logger } from "../utils/helpers";
import { BOT_CONFIG } from "../config/constants";
import { logManager } from "./log-manager";
import { historyManager } from "./history-manager";
import { resultsManager } from "./results-manager";
import * as fs from "fs";
import * as path from "path";

export interface BotConfig {
  name: string;
  enabled: boolean;
  keypair_path?: string;
  keypair?: string;
  proxy?: string;
  delay?: number;
}

export interface BotStats {
  id: string;
  name: string;
  status: "online" | "offline";
  wallet: string;
  catches: number;
  misses: number;
  totalFish: number;
  delay: number;
  uptime: string;
  startedAt?: Date;
  pendingCasts?: number; // Quantidade de casts aguardando resultado
}

class BotInstance {
  public stats: BotStats;
  private service?: FishingService;
  private logMonitor?: CastLogMonitor;
  private isRunning = false;
  private startTime?: Date;
  private iterationCount = 0;
  private pendingCount = 0;
  private lastFishCaught = "0"; // Estado compartilhado entre loops

  constructor(
    public id: string,
    public config: BotConfig,
    public keypair: Keypair
  ) {
    this.stats = {
      id,
      name: config.name,
      status: "offline",
      wallet: keypair.publicKey.toBase58(),
      catches: 0,
      misses: 0,
      totalFish: 0,
      delay: config.delay || BOT_CONFIG.autocast_delay,
      uptime: "0m",
    };
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = new Date();
    this.stats.status = "online";
    this.stats.startedAt = this.startTime;
    this.pendingCount = 0;

    const sanitizedName = this.config.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const logFile = path.join("logs", `bot-${this.id}-${sanitizedName}.log`);
    const botName = `BOT-${this.id} [${this.config.name}]`;

    // Cria serviço de fishing
    this.service = new FishingService(
      this.keypair,
      BOT_CONFIG.rpc_endpoint,
      this.config.proxy,
      botName,
      logFile
    );

    // Calcula PlayerState PDA para WebSocket
    const [playerStatePDA] = getPlayerStatePDA(this.keypair.publicKey);

    // Cria WebSocket monitor para este bot
    this.logMonitor = new CastLogMonitor(
      BOT_CONFIG.rpc_endpoint,
      this.config.proxy,
      botName,
      playerStatePDA.toBase58()
    );

    // Configura callback para resultados do WebSocket
    this.logMonitor.onResult((result) => {
      this.pendingCount = Math.max(0, this.pendingCount - 1);

      if (result.isCatch) {
        this.stats.catches++;
        const fishAmount = result.fishAmount || 0;
        this.stats.totalFish += fishAmount;

        // Registra resultado
        resultsManager.addResult(this.id, this.config.name, "catch", fishAmount);

        if (fishAmount > 0) {
          logManager.addLog(botName, "success", `🐟 CATCH via WS! +${fishAmount.toFixed(3)} fish`);
        } else {
          logManager.addLog(botName, "success", `🐟 CATCH via WS!`);
        }
      } else {
        this.stats.misses++;
        resultsManager.addResult(this.id, this.config.name, "miss");
        logManager.addLog(botName, "warn", `🔴 MISS via WS`);
      }

      // Atualiza uptime
      this.updateUptime();

      // Registra ponto no histórico a cada 5 resultados
      this.iterationCount++;
      if (this.iterationCount % 5 === 0) {
        this.recordHistoryPoint();
      }
    });

    // Inicia loops em PARALELO (não-bloqueante)
    this.castLoop();
    this.stateUpdateLoop(); // Atualiza estado a cada 2s
  }

  // Loop paralelo: Atualiza estado do jogador periodicamente
  private async stateUpdateLoop() {
    const botName = `BOT-${this.id} [${this.config.name}]`;
    const updateInterval = 2000; // 2 segundos

    while (this.isRunning) {
      try {
        if (!this.service) break;

        const playerState = await this.service.fetchPlayerState();
        if (playerState) {
          this.lastFishCaught = playerState.fishCaughtAllTime;
        }

        await Bun.sleep(updateInterval);
      } catch (error: any) {
        // Silencioso - não precisa logar erro de atualização de estado
        await Bun.sleep(updateInterval * 2);
      }
    }
  }

  async stop() {
    this.isRunning = false;
    this.stats.status = "offline";
    this.pendingCount = 0;

    // Fecha WebSocket
    if (this.logMonitor) {
      this.logMonitor.close();
      this.logMonitor = undefined;
    }
  }

  // Loop de casts usando WebSocket para resultados (NÃO-BLOQUEANTE)
  private async castLoop() {
    const delay = this.config.delay || BOT_CONFIG.autocast_delay;
    const botName = `BOT-${this.id} [${this.config.name}]`;

    // Busca estado inicial (stateUpdateLoop vai manter atualizado)
    try {
      const initialState = await this.service?.fetchPlayerState();
      this.lastFishCaught = initialState?.fishCaughtAllTime || "0";
      logManager.addLog(botName, "info", `📊 Estado inicial: ${(parseInt(this.lastFishCaught) / 1_000_000).toFixed(2)} fish`);
    } catch (error) {
      logManager.addLog(botName, "warn", `⚠️ Não foi possível buscar estado inicial`);
    }

    while (this.isRunning) {
      try {
        if (!this.service || !this.logMonitor) break;

        // Limita pendentes para não crescer demais (mas permite vários simultâneos)
        if (this.pendingCount >= 20) {
          await Bun.sleep(200);
          continue;
        }

        // Faz o cast IMEDIATAMENTE (não busca estado antes de cada cast)
        const signature = await this.service.castLine(false);

        if (signature) {
          // Registra cast pendente no WebSocket monitor (usa estado atualizado pelo loop paralelo)
          this.logMonitor.registerCast(signature, this.lastFishCaught);
          this.pendingCount++;

          logManager.addLog(botName, "info", `🎣 Cast enviado! Sig: ${signature.slice(0, 12)}... (⏳ ${this.pendingCount} pendentes)`);
        }

        // Aguarda delay configurado entre casts
        await Bun.sleep(delay);
      } catch (error: any) {
        logManager.addLog(botName, "error", `❌ Erro no cast: ${error.message}`);
        console.error(`Erro no cast do bot ${this.id}:`, error);
        await Bun.sleep(delay * 2);
      }
    }
  }

  private async recordHistoryPoint() {
    if (!this.service) return;

    let durabilityPercent: number | undefined;
    try {
      const playerState = await this.service.fetchPlayerState();
      if (playerState) {
        const current = playerState.currentDurability;
        const max = playerState.maxDurability;
        durabilityPercent = max > 0 ? (current / max) * 100 : 0;
      }
    } catch (error) {
      // Ignora erro
    }

    historyManager.addPoint(
      this.id,
      this.stats.catches,
      this.stats.misses,
      this.stats.totalFish,
      durabilityPercent
    );
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

export class BotManager {
  private bots: Map<string, BotInstance> = new Map();
  private configFile: string;
  private accountsPath: string;
  private configs: BotConfig[] = [];

  constructor(configFile: string = "accounts.json") {
    this.configFile = configFile;
    this.accountsPath = path.resolve(configFile);
  }

  async loadBots() {
    const configPath = path.resolve(this.configFile);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    const configContent = fs.readFileSync(configPath, "utf-8");
    const accounts: BotConfig[] = JSON.parse(configContent);

    // Salva configs na memória
    this.configs = accounts;

    let index = 1;
    for (const account of accounts) {
      if (!account.enabled) continue;

      const id = String(index++);
      const keypair = this.loadKeypair(account);
      const bot = new BotInstance(id, account, keypair);

      this.bots.set(id, bot);
    }

    console.log(`✅ Carregados ${this.bots.size} bots`);
  }

  private loadKeypair(config: BotConfig): Keypair {
    // Se tem keypair direto, usa ele
    if (config.keypair) {
      try {
        const secretKey = Uint8Array.from(JSON.parse(config.keypair));
        return Keypair.fromSecretKey(secretKey);
      } catch (error) {
        throw new Error(`Erro ao carregar keypair direto do bot "${config.name}": ${error}`);
      }
    }

    // Caso contrário, carrega do arquivo
    if (config.keypair_path) {
      return this.loadKeypairFromFile(config.keypair_path);
    }

    throw new Error(`Bot "${config.name}" não tem keypair_path nem keypair configurado`);
  }

  private loadKeypairFromFile(filePath: string): Keypair {
    const absolutePath = path.resolve(filePath);
    const secretKeyString = fs.readFileSync(absolutePath, "utf-8");
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
  }

  getAllBots(): BotStats[] {
    // Atualiza uptime e pendentes de bots online antes de retornar
    this.bots.forEach((bot) => {
      if (bot.stats.status === "online") {
        (bot as any).updateUptime();
        bot.stats.pendingCasts = bot.getPendingCount();
      }
    });

    return Array.from(this.bots.values()).map((bot) => bot.stats);
  }

  getBot(id: string): BotStats | null {
    const bot = this.bots.get(id);
    if (bot && bot.stats.status === "online") {
      (bot as any).updateUptime();
      bot.stats.pendingCasts = bot.getPendingCount();
    }
    return bot ? bot.stats : null;
  }

  async startBot(id: string): Promise<boolean> {
    const bot = this.bots.get(id);
    if (!bot) return false;

    await bot.start();
    return true;
  }

  async stopBot(id: string): Promise<boolean> {
    const bot = this.bots.get(id);
    if (!bot) return false;

    await bot.stop();
    return true;
  }

  async startAllBots(): Promise<number> {
    let count = 0;
    for (const [id, bot] of this.bots) {
      if (bot.stats.status === "offline") {
        await bot.start();
        count++;
      }
    }
    return count;
  }

  async stopAllBots(): Promise<number> {
    let count = 0;
    for (const [id, bot] of this.bots) {
      if (bot.stats.status === "online") {
        await bot.stop();
        count++;
      }
    }
    return count;
  }

  getStats() {
    // Atualiza uptime de todos os bots antes de retornar stats
    this.bots.forEach((bot) => {
      if (bot.stats.status === "online") {
        (bot as any).updateUptime();
      }
    });

    const bots = this.getAllBots();
    const activeBots = bots.filter((b) => b.status === "online").length;
    const totalCatches = bots.reduce((sum, b) => sum + b.catches, 0);
    const totalMisses = bots.reduce((sum, b) => sum + b.misses, 0);
    const totalFish = bots.reduce((sum, b) => sum + b.totalFish, 0);
    const totalPendingCasts = bots.reduce((sum, b) => sum + (b.pendingCasts || 0), 0);

    return {
      totalBots: bots.length,
      activeBots,
      totalCatches,
      totalMisses,
      totalFish,
      totalPendingCasts,
      successRate:
        totalCatches > 0
          ? ((totalCatches / (totalCatches + totalMisses)) * 100).toFixed(1)
          : "0.0",
    };
  }

  getLogs(options: any = {}) {
    return logManager.getLogs(options);
  }

  getTotalLogsCount(botFilter?: string, level?: any) {
    return logManager.getTotalCount(botFilter, level);
  }

  getAvailableBots() {
    return logManager.getAvailableBots();
  }

  async getBotDetailed(id: string) {
    const bot = this.bots.get(id);
    if (!bot) return null;

    // Atualiza uptime se online
    if (bot.stats.status === "online") {
      (bot as any).updateUptime();
    }

    // Busca player state se o bot estiver online
    let playerState = null;
    if (bot.stats.status === "online" && (bot as any).service) {
      try {
        playerState = await (bot as any).service.fetchPlayerState();
      } catch (error) {
        console.error(`Erro ao buscar player state do bot ${id}:`, error);
      }
    }

    return {
      bot: bot.stats,
      playerState,
    };
  }

  getBotHistory(id: string) {
    return historyManager.getHistory(id);
  }

  getBotConfigs(): BotConfig[] {
    return this.configs;
  }

  async saveBotConfigs(configs: BotConfig[]): Promise<void> {
    try {
      // Detecta bots que foram alterados
      const changedBots = new Map<string, { old: BotConfig; new: BotConfig; wasOnline: boolean }>();

      // Compara configs antigas com novas
      let botIndex = 1;
      for (let i = 0; i < configs.length; i++) {
        const newConfig = configs[i];
        const oldConfig = this.configs[i];

        if (!newConfig.enabled) continue;

        const botId = String(botIndex);
        const bot = this.bots.get(botId);

        // Verifica se o bot existe e se houve mudanças
        if (bot && oldConfig) {
          const hasChanges =
            oldConfig.delay !== newConfig.delay ||
            oldConfig.proxy !== newConfig.proxy ||
            oldConfig.keypair !== newConfig.keypair ||
            oldConfig.keypair_path !== newConfig.keypair_path;

          if (hasChanges) {
            changedBots.set(botId, {
              old: oldConfig,
              new: newConfig,
              wasOnline: bot.stats.status === "online"
            });
          }
        }

        botIndex++;
      }

      // Salva no arquivo
      await Bun.write(this.accountsPath, JSON.stringify(configs, null, 2));

      // Atualiza as configs na memória
      this.configs = configs;

      console.log(`✅ Configurações salvas em ${this.accountsPath}`);

      // Aplica mudanças nos bots em execução
      if (changedBots.size > 0) {
        console.log(`🔄 Aplicando mudanças em ${changedBots.size} bot(s)...`);

        for (const [botId, change] of changedBots) {
          const bot = this.bots.get(botId);
          if (!bot) continue;

          console.log(`🔄 Recarregando bot ${botId} (${change.new.name})...`);

          // Para o bot se estava online
          if (change.wasOnline) {
            await bot.stop();
            console.log(`⏸️ Bot ${botId} parado`);
          }

          // Atualiza as configurações do bot
          bot.config.delay = change.new.delay;
          bot.config.proxy = change.new.proxy;
          bot.config.keypair = change.new.keypair;
          bot.config.keypair_path = change.new.keypair_path;
          bot.stats.delay = change.new.delay || BOT_CONFIG.autocast_delay;

          // Se estava online, reinicia com novas configs
          if (change.wasOnline) {
            // Aguarda um pouco antes de reiniciar
            await Bun.sleep(500);
            await bot.start();
            console.log(`▶️ Bot ${botId} reiniciado com novas configurações`);
          }
        }

        console.log(`✅ Mudanças aplicadas com sucesso!`);
      }
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      throw error;
    }
  }
}
