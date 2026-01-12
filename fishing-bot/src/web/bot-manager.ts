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
  pendingCasts?: number; // Quantidade de casts aguardando resultado
}

interface PendingCast {
  signature: string;
  fishCaughtBefore: string;
  timestamp: Date;
  retries: number; // Quantas vezes tentou verificar
}

class BotInstance {
  public stats: BotStats;
  private service?: FishingService;
  private isRunning = false;
  private startTime?: Date;
  private iterationCount = 0;
  private pendingCasts: PendingCast[] = [];

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

    // Limpa fila de pendentes
    this.pendingCasts = [];

    // Inicia os dois loops em paralelo (não-bloqueante)
    this.castLoop();
    this.processLoop();
  }

  async stop() {
    this.isRunning = false;
    this.stats.status = "offline";
    // Limpa fila de pendentes ao parar
    this.pendingCasts = [];
  }

  // Loop 1: Fazer casts instantaneamente (sem delay)
  private async castLoop() {
    const delay = this.config.delay || BOT_CONFIG.autocast_delay;
    const botName = `BOT-${this.id} [${this.config.name}]`;

    while (this.isRunning) {
      try {
        if (!this.service) break;

        // Limita a fila para não crescer demais (máximo 20 pendentes)
        if (this.pendingCasts.length >= 20) {
          await Bun.sleep(500);
          continue;
        }

        // Busca estado do player antes do cast
        const playerStateBefore = await this.service.fetchPlayerState();
        const fishCaughtBefore = playerStateBefore?.fishCaughtAllTime || "0";

        // Faz o cast (não aguarda resultado)
        const signature = await this.service.castLine(false);

        if (signature) {
          // Adiciona na fila de pendentes
          this.pendingCasts.push({
            signature,
            fishCaughtBefore,
            timestamp: new Date(),
            retries: 0,
          });

          logManager.addLog(botName, "info", `🎣 Cast enviado! Sig: ${signature.slice(0, 12)}... (${this.pendingCasts.length} pendentes)`);
        }

        // Aguarda o delay configurado entre casts
        await Bun.sleep(delay);
      } catch (error: any) {
        logManager.addLog(botName, "error", `❌ Erro no cast: ${error.message}`);
        console.error(`Erro no cast do bot ${this.id}:`, error);
        await Bun.sleep(delay * 2);
      }
    }
  }

  // Loop 2: Processar fila de casts pendentes (RÁPIDO - processa a fila rapidamente)
  private async processLoop() {
    const botName = `BOT-${this.id} [${this.config.name}]`;

    while (this.isRunning) {
      try {
        if (!this.service || this.pendingCasts.length === 0) {
          // Se não há pendentes, aguarda um pouco antes de verificar novamente
          await Bun.sleep(200);
          continue;
        }

        // Pega o cast mais antigo da fila
        const pending = this.pendingCasts.shift();
        if (!pending) continue;

        // Verifica há quanto tempo o cast foi feito
        const elapsedMs = Date.now() - pending.timestamp.getTime();
        const elapsedSec = Math.floor(elapsedMs / 1000);

        // TIMEOUT: Remove da fila após 20 segundos sem resposta
        if (elapsedMs > 20000) {
          logManager.addLog(botName, "warn", `⏱️ Cast descartado após timeout (${elapsedSec}s) - Sig: ${pending.signature.slice(0, 12)}...`);
          // NÃO recoloca na fila - descarta definitivamente
          continue;
        }

        // Incrementa tentativas
        pending.retries++;

        // Só tenta verificar se já passou pelo menos 2 segundos (tempo mínimo para tx ser processada)
        if (elapsedMs < 2000) {
          // Recoloca na fila e aguarda
          this.pendingCasts.push(pending);
          await Bun.sleep(50);
          continue;
        }

        // Verifica resultado do cast
        const result = await this.service.checkCastResult(
          pending.signature,
          pending.fishCaughtBefore
        );

        if (result !== null) {
          if (result.isCatch) {
            this.stats.catches++;
            const fishAmount = result.fishAmount || 0;
            this.stats.totalFish += fishAmount;

            // Log de catch
            if (fishAmount > 0) {
              logManager.addLog(botName, "success", `🐟 CATCH! +${fishAmount.toLocaleString()} fish (${elapsedSec}s)`);
            } else {
              logManager.addLog(botName, "success", `🐟 CATCH! (${elapsedSec}s)`);
            }
          } else {
            this.stats.misses++;
            logManager.addLog(botName, "warn", `🔴 MISS (${elapsedSec}s)`);
          }

          // Atualiza uptime
          this.updateUptime();

          // Registra ponto no histórico a cada 5 resultados processados
          this.iterationCount++;
          if (this.iterationCount % 5 === 0) {
            // Busca durabilidade atual
            let durabilityPercent: number | undefined;
            try {
              const playerState = await this.service.fetchPlayerState();
              if (playerState) {
                const current = playerState.currentDurability;
                const max = playerState.maxDurability;
                durabilityPercent = max > 0 ? (current / max) * 100 : 0;
              }
            } catch (error) {
              // Se falhar ao buscar durabilidade, adiciona sem ela
            }

            historyManager.addPoint(
              this.id,
              this.stats.catches,
              this.stats.misses,
              this.stats.totalFish,
              durabilityPercent
            );
          }
        } else {
          // Se não conseguiu obter resultado ainda, recoloca na fila
          this.pendingCasts.push(pending);

          // Log apenas a cada 5 tentativas para não poluir
          if (pending.retries % 5 === 0) {
            logManager.addLog(botName, "info", `⏳ Aguardando resultado... (${elapsedSec}s, ${pending.retries} tentativas)`);
          }
        }

        // Delay mínimo para não sobrecarregar (50ms)
        await Bun.sleep(50);
      } catch (error: any) {
        logManager.addLog(botName, "error", `❌ Erro ao processar: ${error.message}`);
        console.error(`Erro ao processar resultado do bot ${this.id}:`, error);
        await Bun.sleep(1000);
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
        // Atualiza contagem de pendentes
        bot.stats.pendingCasts = (bot as any).pendingCasts?.length || 0;
      }
    });

    return Array.from(this.bots.values()).map((bot) => bot.stats);
  }

  getBot(id: string): BotStats | null {
    const bot = this.bots.get(id);
    if (bot && bot.stats.status === "online") {
      (bot as any).updateUptime();
      // Atualiza contagem de pendentes
      bot.stats.pendingCasts = (bot as any).pendingCasts?.length || 0;
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
