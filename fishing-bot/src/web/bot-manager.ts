import { Keypair } from "@solana/web3.js";
import { FishingService } from "../services/fishing";
import { Logger } from "../utils/helpers";
import { BOT_CONFIG } from "../config/constants";
import { logManager } from "./log-manager";
import { historyManager } from "./history-manager";
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
}

class BotInstance {
  public stats: BotStats;
  private service?: FishingService;
  private isRunning = false;
  private startTime?: Date;
  private iterationCount = 0;

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

    const sanitizedName = this.config.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const logFile = path.join("logs", `bot-${this.id}-${sanitizedName}.log`);

    // Cria serviço de fishing
    this.service = new FishingService(
      this.keypair,
      BOT_CONFIG.rpc_endpoint,
      this.config.proxy,
      `BOT-${this.id} [${this.config.name}]`,
      logFile
    );

    // Inicia auto-cast em background
    this.runAutoCast();
  }

  async stop() {
    this.isRunning = false;
    this.stats.status = "offline";
    // TODO: Implementar parada graceful do auto-cast
  }

  private async runAutoCast() {
    const delay = this.config.delay || BOT_CONFIG.autocast_delay;
    const botName = `BOT-${this.id} [${this.config.name}]`;

    while (this.isRunning) {
      try {
        if (!this.service) break;

        const playerStateBefore = await this.service.fetchPlayerState();
        const fishCaughtBefore = playerStateBefore?.fishCaughtAllTime || "0";

        const signature = await this.service.castLine(false);

        if (signature) {
          // Log de cast realizado
          logManager.addLog(botName, "info", `✅ Cast realizado! Sig: ${signature.slice(0, 12)}...`);

          const result = await this.service.checkCastResult(signature, fishCaughtBefore);

          if (result !== null) {
            if (result.isCatch) {
              this.stats.catches++;
              const fishAmount = result.fishAmount || 0;
              this.stats.totalFish += fishAmount;

              // Log de catch
              if (fishAmount > 0) {
                logManager.addLog(botName, "success", `🐟 CATCH! +${fishAmount.toLocaleString()} fish`);
              } else {
                logManager.addLog(botName, "success", `🐟 CATCH!`);
              }
            } else {
              this.stats.misses++;
              // Log de miss
              logManager.addLog(botName, "warn", `🔴 MISS`);
            }
          }
        }

        // Atualiza uptime a cada iteração
        this.updateUptime();

        // Registra ponto no histórico a cada 5 casts
        this.iterationCount++;
        if (this.iterationCount % 5 === 0) {
          historyManager.addPoint(
            this.id,
            this.stats.catches,
            this.stats.misses,
            this.stats.totalFish
          );
        }

        await Bun.sleep(delay);
      } catch (error: any) {
        logManager.addLog(botName, "error", `❌ Erro: ${error.message}`);
        console.error(`Erro no bot ${this.id}:`, error);
        await Bun.sleep(delay * 2);
      }
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
    // Atualiza uptime de bots online antes de retornar
    this.bots.forEach((bot) => {
      if (bot.stats.status === "online") {
        (bot as any).updateUptime();
      }
    });

    return Array.from(this.bots.values()).map((bot) => bot.stats);
  }

  getBot(id: string): BotStats | null {
    const bot = this.bots.get(id);
    if (bot && bot.stats.status === "online") {
      (bot as any).updateUptime();
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

    return {
      totalBots: bots.length,
      activeBots,
      totalCatches,
      totalMisses,
      totalFish,
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
      // Salva no arquivo
      await Bun.write(this.accountsPath, JSON.stringify(configs, null, 2));

      // Atualiza as configs na memória
      this.configs = configs;

      console.log(`✅ Configurações salvas em ${this.accountsPath}`);
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      throw error;
    }
  }
}
