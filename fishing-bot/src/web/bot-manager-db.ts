import { Keypair, PublicKey } from "@solana/web3.js";
import { eq, desc, and, sql } from "drizzle-orm";
import { FishingService } from "../services/fishing";
import { CastLogMonitor } from "../services/log-monitor";
import { getPlayerStatePDA } from "../utils/pda";
import { BOT_CONFIG } from "../config/constants";
import { BAIT_NAMES } from "../types";
import { db, bots, castResults, botHistory, logs, accounts, baitPresets, runDatabaseMaintenance, runSql } from "../db";
import type { Bot, NewBot, NewCastResult, NewBotHistory, NewLog, BaitPreset } from "../db";
import * as path from "path";

// Requisitos de casts por nível para upgrade (L2-L60)
const UPGRADE_CAST_REQUIREMENTS = [
  0, 0, 3750, 3869, 3998, 4139, 4291, 4457, 4636, 4831, 5042, 5271, 5520, 5789, 6082, 6400, 6746, 7122, 7531,
  7976, 8461, 8991, 9569, 10200, 10891, 11647, 12476, 13384, 14382, 15480, 16687, 18017, 19484, 21104, 22895,
  24876, 27073, 29509, 32215, 35225, 38576, 42312, 46482, 51144, 56360, 62205, 68762, 76129, 84416, 93749, 104275,
  116162, 129602, 144820, 162073, 181659, 203924, 229267, 258152, 291119, 328795
];

// Custo em USDC (FOGO_MINT) por nível de upgrade (L2-L60) - em micro-units (dividir por 1e6)
const UPGRADE_USDC_COST = [
  0, 0, 13083, 54216, 108126, 170760, 240352, 315848, 396526, 481859, 571436, 664931, 762075, 862640, 966434,
  1073290, 1183059, 1295613, 1410835, 1528622, 1648877, 1771517, 1896461, 2023637, 2152979, 2284425, 2417917,
  2553402, 2690829, 2830151, 2971325, 3114308, 3259061, 3405547, 3553731, 3703579, 3855059, 4008141, 4162796,
  4318997, 4476717, 4635930, 4796613, 4958743, 5122297, 5287253, 5453591, 5621292, 5790335, 5960703, 6132377,
  6305341, 6479578, 6655071, 6831806, 7009766, 7188937, 7369306, 7550858, 7733580, 7917459
];

// Custo em FISH por bait ID (1-10) em unidades reais
// fishCost: "75K"=75000, "150K"=150000, "315K"=315000, etc
const BAIT_FISH_COST: Record<number, number> = {
  1: 75_000, 2: 150_000, 3: 150_000, 4: 315_000, 5: 480_000,
  6: 665_000, 7: 1_500_000, 8: 2_000_000, 9: 5_000_000, 10: 10_000_000,
};

// Custo em USDC por bait ID (1-10)
const BAIT_USDC_COST: Record<number, number> = {
  1: 0.13, 2: 0.13, 3: 0.13, 4: 0.25, 5: 0.25,
  6: 0.38, 7: 0.38, 8: 0.50, 9: 0.63, 10: 0.75,
};

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

interface FishTypeAnalytics {
  amount: number;
  amountLabel: string;
  count: number;
  totalFish: number;
  probability: number;
  lastSeenAt: Date | null;
  averageGapMs: number | null;
  maxGapMs: number | null;
  timeSinceLastMs: number | null;
  overdueRatio: number | null;
  status: "normal" | "attention" | "late" | "insufficient_data";
}

interface BotAnalytics {
  sampledCatches: number;
  sampledMisses: number;
  sampledTotalFish: number;
  windows: Array<{
    key: "5m" | "15m" | "1h" | "24h";
    label: string;
    catches: number;
    misses: number;
    totalFish: number;
    successRate: number;
    fishPerHour: number;
    avgFishPerCatch: number;
    observedMinutes: number;
  }>;
  todayCatches: number;
  todayMisses: number;
  todayTotalFish: number;
  yesterdayCatches: number;
  yesterdayMisses: number;
  yesterdayTotalFish: number;
  comparison: {
    fishDelta: number;
    fishDeltaPercent: number | null;
    catchesDelta: number;
    successRateDelta: number;
  };
  projectedTotalFishToday: number;
  projectedCatchesToday: number;
  elapsedDayPercent: number;
  streaks: {
    currentCatch: number;
    currentMiss: number;
    maxCatch: number;
    maxMiss: number;
  };
  hourlySeries: Array<{
    hour: number;
    label: string;
    fish: number;
    catches: number;
    cumulativeFish: number;
  }>;
  fishTypes: FishTypeAnalytics[];
}

/**
 * Instância de um bot em execução
 * Mantida apenas em memória enquanto o bot está rodando
 */
class BotInstance {
  public stats: BotStats;
  public service?: FishingService;
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
  private currentWaitThreshold: number = 20; // Threshold atual da automação de espera
  private autoUpgradeStartNextRetry = 0; // Cooldown para auto-start upgrade (timestamp)
  private autoBaitNextRetry = 0; // Cooldown para auto-bait (timestamp)
  private autoBaitDisabled = false; // Desabilitado por erro fatal (precisa recriar sessão)
  private autoBaitConsecutiveErrors = 0; // Contador de erros consecutivos
  private durabilityPauseUntil = 0;
  private lastPauseCastTime = 0;

  constructor(
    public walletPubkey: string,
    public keypair: Keypair,
    public delayMin: number,
    public delayMax: number,
    public proxy?: string,
    public autoRepair: boolean = false,
    public autoRepairMin: number = 15,
    public autoRepairMax: number = 25,
    public autoRepairWaitMinMinutes: number = 0,
    public autoRepairWaitMaxMinutes: number = 0,
    public autoWaitDurability: boolean = false,
    public autoWaitDurabilityMin: number = 15,
    public autoWaitDurabilityMax: number = 25,
    public autoWaitMinutesMin: number = 0,
    public autoWaitMinutesMax: number = 0,
    restoredCurrentWaitThreshold: number = 0,
    restoredDurabilityPauseUntil: number = 0,
    public autoUpgrade: boolean = false,
    public autoRestartMinutes: number = 240,
    public autoBuyBait: boolean = false,
    public autoBuyBaitIds: string = "",
    public autoUseBaitId: number = 0,
    public autoBuyBaitThreshold: number = 100,
    public autoBuyBaitThresholds: string = "",
    public autoUseBaitOrder: string = "",
    public autoBuyBaitQty: string = "",
    public autoBuyBaitStock: string = ""
  ) {
    // Sorteia threshold inicial dentro da range
    this.currentRepairThreshold = this.randomThreshold();
    this.currentWaitThreshold = restoredCurrentWaitThreshold > 0 ? restoredCurrentWaitThreshold : this.randomWaitThreshold();
    this.durabilityPauseUntil = restoredDurabilityPauseUntil > Date.now() ? restoredDurabilityPauseUntil : 0;

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

  private randomRepairWaitMinutes(): number {
    const min = Math.min(this.autoRepairWaitMinMinutes, this.autoRepairWaitMaxMinutes);
    const max = Math.max(this.autoRepairWaitMinMinutes, this.autoRepairWaitMaxMinutes);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomWaitThreshold(): number {
    const min = Math.min(this.autoWaitDurabilityMin, this.autoWaitDurabilityMax);
    const max = Math.max(this.autoWaitDurabilityMin, this.autoWaitDurabilityMax);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomDurabilityWaitMinutes(): number {
    const min = Math.min(this.autoWaitMinutesMin, this.autoWaitMinutesMax);
    const max = Math.max(this.autoWaitMinutesMin, this.autoWaitMinutesMax);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getAutomationState() {
    const durabilityPauseRemainingMs = Math.max(0, this.durabilityPauseUntil - Date.now());

    return {
      currentRepairThreshold: this.currentRepairThreshold,
      currentWaitThreshold: this.currentWaitThreshold,
      durabilityPauseUntil: this.durabilityPauseUntil || null,
      durabilityPauseRemainingMs,
      isDurabilityPauseActive: durabilityPauseRemainingMs > 0,
      autoBuyDisabled: this.autoBaitDisabled,
    };
  }

  private async persistDurabilityPauseState() {
    await db
      .update(bots)
      .set({
        currentWaitThreshold: this.currentWaitThreshold,
        durabilityPauseUntil: this.durabilityPauseUntil > 0 ? new Date(this.durabilityPauseUntil) : null,
        updatedAt: new Date(),
      })
      .where(eq(bots.walletPubkey, this.walletPubkey));
  }

  async clearDurabilityPauseState(resetThreshold: boolean = true) {
    this.durabilityPauseUntil = 0;
    this.currentWaitThreshold = resetThreshold ? this.randomWaitThreshold() : 0;
    await this.persistDurabilityPauseState();
  }

  async reshuffleWaitThreshold() {
    this.currentWaitThreshold = this.randomWaitThreshold();
    await this.persistDurabilityPauseState();
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

          if (
            !this.autoRepair &&
            this.autoWaitDurability &&
            durabilityPercent <= this.currentWaitThreshold &&
            this.durabilityPauseUntil === 0
          ) {
            const waitMinutes = Math.max(1, this.randomDurabilityWaitMinutes());
            this.durabilityPauseUntil = Date.now() + waitMinutes * 60 * 1000;
            const oldThreshold = this.currentWaitThreshold;
            this.currentWaitThreshold = this.randomWaitThreshold();
            await this.persistDurabilityPauseState();
            this.addLog(
              "warn",
              `⏳ Durabilidade ${durabilityPercent}% atingiu threshold ${oldThreshold}%. Pausando casts por ${waitMinutes} min sem reparar. Próxima faixa em ~${this.currentWaitThreshold}%`,
              "repair"
            );
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
            if (nextLevel <= 60 && Date.now() >= this.autoUpgradeStartNextRetry) {
              // Verifica saldo USDC antes de tentar
              const upgradeCost = (UPGRADE_USDC_COST[nextLevel] || 0) / 1_000_000; // micro-units para units
              let canUpgrade = true;
              if (upgradeCost > 0 && this.service) {
                try {
                  const balances = await this.service.fetchBalances();
                  if (balances) {
                    if (balances.usdc < upgradeCost) {
                      this.addLog("warn", `🔨 Auto-upgrade: USDC insuficiente (${balances.usdc.toFixed(2)} < ${upgradeCost.toFixed(2)} necessarios para Lv.${nextLevel})`);
                      canUpgrade = false;
                      this.autoUpgradeStartNextRetry = Date.now() + 60_000; // retry em 60s
                    }
                  }
                } catch {}
              }
              if (canUpgrade) {
                this.addLog("info", `🔨 Auto-upgrade: iniciando upgrade para level ${nextLevel} (custo: ${upgradeCost.toFixed(2)} USDC)...`);
                try {
                  const result = await this.startUpgrade(nextLevel);
                  if (result.success) {
                    this.addLog("success", `🔨 Auto-upgrade para level ${nextLevel} iniciado!`);
                    this.autoUpgradeStartNextRetry = 0;
                  } else {
                    this.addLog("error", `🔨 Falha no auto-upgrade: ${result.error}`);
                    this.autoUpgradeStartNextRetry = Date.now() + 30_000; // cooldown 30s
                  }
                } catch (error: any) {
                  this.addLog("error", `🔨 Erro no auto-upgrade: ${error.message}`);
                  this.autoUpgradeStartNextRetry = Date.now() + 30_000; // cooldown 30s
                }
              }
            }
          }

          // Auto-bait: verifica inventario de iscas e auto-compra/equipa
          const hasAutoEquip = this.autoUseBaitOrder ? this.autoUseBaitOrder.length > 0 : this.autoUseBaitId > 0;
          if ((this.autoBuyBait || hasAutoEquip) && this.service) {
            try {
              const baitState = await this.service.fetchRiverFishState();
              if (baitState) {
                // Auto-equip por prioridade: tenta cada bait na ordem até encontrar uma com estoque
                if (hasAutoEquip) {
                  const orderList = this.autoUseBaitOrder
                    ? this.autoUseBaitOrder.split(",").map(Number).filter(n => n >= 1 && n <= 10)
                    : this.autoUseBaitId > 0 ? [this.autoUseBaitId] : [];

                  // Só troca se a isca atual não está na lista ou não tem mais casts
                  const currentBait = baitState.activeBait;
                  const currentCasts = currentBait > 0 ? (baitState.remainingCasts[currentBait - 1] || 0) : 0;
                  const currentInList = orderList.includes(currentBait);

                  if (!currentInList || currentCasts === 0) {
                    // Busca a primeira isca da lista com estoque
                    for (const baitId of orderList) {
                      const castsForBait = baitState.remainingCasts[baitId - 1] || 0;
                      if (castsForBait > 0 && baitId !== currentBait) {
                        this.addLog("info", `🪱 Auto-equip: ativando ${BAIT_NAMES[baitId] || `tipo ${baitId}`} (${castsForBait} casts)...`);
                        const sig = await this.service.setActiveRiverBait(baitId);
                        if (sig) {
                          this.addLog("success", `🪱 ${BAIT_NAMES[baitId] || `Isca ${baitId}`} equipada!`);
                        }
                        break;
                      }
                    }
                  }
                }

                // Auto-buy: compra iscas quando casts restantes < threshold individual ou < estoque alvo
                if (this.autoBuyBait && this.autoBuyBaitIds && !this.autoBaitDisabled && Date.now() >= this.autoBaitNextRetry) {
                  const baitIds = this.autoBuyBaitIds.split(",").map(Number).filter(n => n >= 1 && n <= 10);
                  // Parse per-bait quantities (format: "1:5,3:10")
                  const qtyMap: Record<number, number> = {};
                  if (this.autoBuyBaitQty) {
                    this.autoBuyBaitQty.split(",").forEach(entry => {
                      const [id, qty] = entry.split(":").map(Number);
                      if (id !== undefined && qty !== undefined && id >= 1 && id <= 10 && qty > 0) {
                        qtyMap[id] = Math.min(qty, 100);
                      }
                    });
                  }
                  // Parse per-bait thresholds (format: "1:100,3:50")
                  const thresholdMap: Record<number, number> = {};
                  if (this.autoBuyBaitThresholds) {
                    this.autoBuyBaitThresholds.split(",").forEach(entry => {
                      const [id, t] = entry.split(":").map(Number);
                      if (id !== undefined && t !== undefined && id >= 1 && id <= 10 && t > 0) {
                        thresholdMap[id] = t;
                      }
                    });
                  }
                  // Parse per-bait stock targets (format: "1:500,3:1000")
                  const stockMap: Record<number, number> = {};
                  if (this.autoBuyBaitStock) {
                    this.autoBuyBaitStock.split(",").forEach(entry => {
                      const [id, stock] = entry.split(":").map(Number);
                      if (id !== undefined && stock !== undefined && id >= 1 && id <= 10 && stock > 0) {
                        stockMap[id] = stock;
                      }
                    });
                  }
                  // Busca custos dinâmicos on-chain (escalados por dificuldade)
                  const dynamicCosts = await this.service!.fetchBaitDynamicCosts();
                  for (const baitId of baitIds) {
                    const remaining = baitState.remainingCasts[baitId - 1] || 0;
                    const baitThreshold = thresholdMap[baitId] ?? this.autoBuyBaitThreshold;
                    const stockTarget = stockMap[baitId] || 0;

                    // Decide se precisa comprar: threshold normal OU modo estoque
                    const needsBuyThreshold = remaining < baitThreshold;
                    const needsBuyStock = stockTarget > 0 && remaining < stockTarget;

                    if (needsBuyThreshold || needsBuyStock) {
                      const buyQty = qtyMap[baitId] || 1;
                      const unitFishCost = dynamicCosts?.[baitId]?.fishCost ?? BAIT_FISH_COST[baitId] ?? 0;
                      const unitUsdcCost = dynamicCosts?.[baitId]?.usdcFee ?? BAIT_USDC_COST[baitId] ?? 0;
                      const totalFishCost = unitFishCost * buyQty;
                      const totalUsdcCost = unitUsdcCost * buyQty;
                      // Verifica saldo antes de comprar
                      const balances = await this.service!.fetchBalances();
                      if (balances) {
                        if (balances.fish < totalFishCost) {
                          this.addLog("warn", `🪱 Auto-buy: FISH insuficiente (${balances.fish.toLocaleString()} < ${Math.round(totalFishCost).toLocaleString()} para ${buyQty}x ${BAIT_NAMES[baitId]})`);
                          this.autoBaitNextRetry = Date.now() + 60_000;
                          break;
                        }
                        if (balances.usdc < totalUsdcCost) {
                          this.addLog("warn", `🪱 Auto-buy: USDC insuficiente (${balances.usdc.toFixed(2)} < ${totalUsdcCost.toFixed(2)} para ${buyQty}x ${BAIT_NAMES[baitId]})`);
                          this.autoBaitNextRetry = Date.now() + 60_000;
                          break;
                        }
                      }
                      const reason = needsBuyStock && !needsBuyThreshold
                        ? `estoque ${remaining}/${stockTarget}`
                        : `${remaining} casts < ${baitThreshold}`;
                      this.addLog("info", `🪱 Auto-buy: ${buyQty}x ${BAIT_NAMES[baitId] || `tipo ${baitId}`} (${reason}) custo: ${Math.round(totalFishCost).toLocaleString()} FISH + ${totalUsdcCost.toFixed(2)} USDC...`);
                      try {
                        const sig = await this.service!.buyRiverBait(baitId, buyQty);
                        if (sig) {
                          this.addLog("success", `🪱 ${buyQty}x ${BAIT_NAMES[baitId] || `Isca ${baitId}`} comprada!`);
                          this.autoBaitNextRetry = 0;
                          this.autoBaitConsecutiveErrors = 0;
                        }
                      } catch (buyErr: any) {
                        this.autoBaitConsecutiveErrors++;
                        const errMsg = buyErr.message || "";
                        const isFatalError = errMsg.includes("Custom:4000000000") || errMsg.includes("InstructionError");
                        if (isFatalError || this.autoBaitConsecutiveErrors >= 3) {
                          this.autoBaitDisabled = true;
                          this.addLog("error", `🪱 Auto-compra DESABILITADA após ${this.autoBaitConsecutiveErrors} erro(s). Recrie a sessão do bot para corrigir.`);
                        } else {
                          this.addLog("error", `🪱 Falha na compra de ${BAIT_NAMES[baitId]}: ${errMsg} (tentativa ${this.autoBaitConsecutiveErrors}/3)`);
                          this.autoBaitNextRetry = Date.now() + 30_000;
                        }
                      }
                      break; // Compra uma por ciclo para nao sobrecarregar
                    }
                  }
                }
              }
            } catch (error: any) {
              this.addLog("warn", `🪱 Erro no auto-bait: ${error.message}`);
              this.autoBaitNextRetry = Date.now() + 30_000; // cooldown 30s
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

        const isPaused = this.durabilityPauseUntil > Date.now();
        await Bun.sleep(isPaused ? 60_000 : updateInterval);
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

    // Fecha o logMonitor mas aguarda um tick para que o castLoop
    // perceba isRunning=false antes de perder a referencia
    if (this.logMonitor) {
      this.logMonitor.close();
      await Bun.sleep(50);
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

        if (this.durabilityPauseUntil > Date.now()) {
          const PAUSE_CAST_INTERVAL = 60_000; // 1 cast a cada 60s para atualizar blockchain
          const timeSinceLastPauseCast = Date.now() - this.lastPauseCastTime;

          if (timeSinceLastPauseCast >= PAUSE_CAST_INTERVAL && this.service) {
            try {
              const sig = await this.service.castLine(false);
              if (sig && this.logMonitor) {
                this.logMonitor.registerCast(sig);
                this.pendingCount++;
                this.lastPauseCastTime = Date.now();
                this.addLog("info", `🔄 Cast de manutenção (pausa ativa) Sig: ${sig.slice(0, 12)}...`, "cast");
              }
            } catch {}
          }

          const remaining = this.durabilityPauseUntil - Date.now();
          await Bun.sleep(Math.min(remaining, 30_000));
          continue;
        }

        if (this.durabilityPauseUntil !== 0) {
          this.lastPauseCastTime = 0;
          await this.clearDurabilityPauseState();
          this.addLog("info", `⏳ Pausa por durabilidade concluída, retomando casts`, "repair");
          // Re-verifica condições: stateUpdateLoop pode ter setado nova pausa durante o await
          continue;
        }

        const signature = await this.service.castLine(false);

        // Após o await, verifica se o bot foi parado durante o cast
        if (!this.isRunning || !this.logMonitor) {
          this.addLog("info", `🛑 Bot parado durante cast, descartando resultado`, "cast");
          break;
        }

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

  addLog(level: "info" | "success" | "warn" | "error", message: string, category: "general" | "websocket" | "cast" | "repair" = "general") {
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

  async buyBait(baitType: number, quantity: number = 1): Promise<{ success: boolean; error?: string }> {
    if (!this.service) {
      return { success: false, error: "Bot não está rodando" };
    }
    try {
      const signature = await this.service.buyRiverBait(baitType, quantity);
      if (signature) {
        this.addLog("success", `🪱 Isca ${BAIT_NAMES[baitType] || `tipo ${baitType}`} comprada!`, "general");
        return { success: true };
      }
      return { success: false, error: "Falha ao enviar transação de compra" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async equipBait(baitType: number): Promise<{ success: boolean; error?: string }> {
    if (!this.service) {
      return { success: false, error: "Bot não está rodando" };
    }
    try {
      const signature = await this.service.setActiveRiverBait(baitType);
      if (signature) {
        this.addLog("success", `🪱 Isca ${baitType === 0 ? 'desativada' : `${BAIT_NAMES[baitType] || `tipo ${baitType}`} equipada`}!`, "general");
        return { success: true };
      }
      return { success: false, error: "Falha ao enviar transação de equipar" };
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

  // Metricas de monitoramento (ultimas 24h, coleta a cada 10s)
  private metricsHistory: Array<{
    timestamp: number;
    activeBots: number;
    pausedBots: number;
    totalCasts: number;
    totalFish: number;
    cpuPercent: number;
    memoryMB: number;
  }> = [];
  private lastCastSnapshot = 0;
  private lastCpuUsage = process.cpuUsage();
  private lastMetricsTime = Date.now();
  private metricsCollectorStarted = false;

  constructor() {}

  startMetricsCollector() {
    if (this.metricsCollectorStarted) return;
    this.metricsCollectorStarted = true;
    this.lastCpuUsage = process.cpuUsage();
    this.lastMetricsTime = Date.now();

    setInterval(() => {
      try {
        this.collectMetrics();
      } catch (e) {
        // silently ignore metrics errors
      }
    }, 10_000);
  }

  private collectMetrics() {
    const now = Date.now();
    const deltaMs = now - this.lastMetricsTime;
    if (deltaMs < 1000) return;

    let activeBots = 0;
    let pausedBots = 0;
    let totalCasts = 0;
    let totalFish = 0;

    for (const instance of this.runningBots.values()) {
      const isPaused = instance.getAutomationState().isDurabilityPauseActive;
      if (isPaused) {
        pausedBots++;
      } else {
        activeBots++;
      }
      totalCasts += instance.stats.catches + instance.stats.misses;
      totalFish += instance.stats.totalFish;
    }

    // CPU %
    const currentCpu = process.cpuUsage(this.lastCpuUsage);
    const cpuTotalMicros = currentCpu.user + currentCpu.system;
    const cpuPercent = Math.min(100, (cpuTotalMicros / (deltaMs * 1000)) * 100);
    this.lastCpuUsage = process.cpuUsage();
    this.lastMetricsTime = now;

    // RAM
    const memoryMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

    this.metricsHistory.push({
      timestamp: now,
      activeBots,
      pausedBots,
      totalCasts,
      totalFish,
      cpuPercent: Math.round(cpuPercent * 10) / 10,
      memoryMB,
    });

    // Trunca > 24h (8640 entradas a cada 10s)
    const maxAge = 24 * 60 * 60 * 1000;
    while (this.metricsHistory.length > 0 && this.metricsHistory[0]!.timestamp < now - maxAge) {
      this.metricsHistory.shift();
    }

    this.lastCastSnapshot = totalCasts;
  }

  async getMonitoringData() {
    const now = Date.now();

    // Snapshot atual dos bots
    let activeBots = 0;
    let pausedBots = 0;
    let totalCatches = 0;
    let totalMisses = 0;
    let totalFish = 0;
    let botIndex = 0;
    const botList: Array<{
      id: number;
      status: "online" | "paused" | "offline";
      catches: number;
      misses: number;
      fish: number;
      uptime: string;
      durability: number;
      rodLevel: number;
      pendingCasts: number;
    }> = [];

    for (const instance of this.runningBots.values()) {
      const isPaused = instance.getAutomationState().isDurabilityPauseActive;
      if (isPaused) pausedBots++;
      else activeBots++;

      totalCatches += instance.stats.catches;
      totalMisses += instance.stats.misses;
      totalFish += instance.stats.totalFish;

      botIndex++;
      botList.push({
        id: botIndex,
        status: isPaused ? "paused" : "online",
        catches: instance.stats.catches,
        misses: instance.stats.misses,
        fish: Math.round(instance.stats.totalFish * 100) / 100,
        uptime: instance.stats.uptime || "0m",
        durability: instance.stats.durability?.percent ?? 0,
        rodLevel: instance.stats.rodLevel ?? 0,
        pendingCasts: instance.getPendingCount(),
      });
    }

    // Total bots no banco
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bots);
    const totalBotsDb = countResult[0]?.count || 0;

    // Casts/s dos ultimos 20s
    const recentWindow = this.metricsHistory.filter(m => m.timestamp > now - 20_000);
    let castsPerSecond = 0;
    if (recentWindow.length >= 2) {
      const oldest = recentWindow[0]!;
      const newest = recentWindow[recentWindow.length - 1]!;
      const castDelta = newest.totalCasts - oldest.totalCasts;
      const timeDelta = (newest.timestamp - oldest.timestamp) / 1000;
      if (timeDelta > 0) castsPerSecond = Math.round((castDelta / timeDelta) * 100) / 100;
    }

    // CPU/RAM atual
    const lastMetric = this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1]! : null;
    const cpuPercent = lastMetric?.cpuPercent ?? 0;
    const memoryMB = lastMetric?.memoryMB ?? Math.round(process.memoryUsage().rss / 1024 / 1024);

    // Historico por hora (ultimas 24h)
    const hourlyHistory: Array<{
      hour: string;
      activeBots: number;
      castsPerMinute: number;
      totalFish: number;
    }> = [];

    const hoursBack = 24;
    for (let h = hoursBack - 1; h >= 0; h--) {
      const hourStart = new Date(now);
      hourStart.setMinutes(0, 0, 0);
      hourStart.setHours(hourStart.getHours() - h);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const hourMetrics = this.metricsHistory.filter(
        m => m.timestamp >= hourStart.getTime() && m.timestamp < hourEnd.getTime()
      );

      if (hourMetrics.length >= 2) {
        const avgBots = hourMetrics.reduce((s, m) => s + m.activeBots, 0) / hourMetrics.length;
        const castsDelta = hourMetrics[hourMetrics.length - 1]!.totalCasts - hourMetrics[0]!.totalCasts;
        const timeDelta = (hourMetrics[hourMetrics.length - 1]!.timestamp - hourMetrics[0]!.timestamp) / 60_000;
        const fishDelta = hourMetrics[hourMetrics.length - 1]!.totalFish - hourMetrics[0]!.totalFish;

        hourlyHistory.push({
          hour: `${String(hourStart.getHours()).padStart(2, "0")}:00`,
          activeBots: Math.round(avgBots * 10) / 10,
          castsPerMinute: timeDelta > 0 ? Math.round((castsDelta / timeDelta) * 10) / 10 : 0,
          totalFish: Math.round(fishDelta * 100) / 100,
        });
      } else {
        hourlyHistory.push({
          hour: `${String(hourStart.getHours()).padStart(2, "0")}:00`,
          activeBots: 0,
          castsPerMinute: 0,
          totalFish: 0,
        });
      }
    }

    // Metricas recentes (ultimos 30min) para grafico CPU/RAM
    const thirtyMinAgo = now - 30 * 60 * 1000;
    const recentMetrics = this.metricsHistory
      .filter(m => m.timestamp > thirtyMinAgo)
      .map(m => {
        // Recalcular casts/s local
        const idx = this.metricsHistory.indexOf(m);
        let cps = 0;
        if (idx > 0) {
          const prev = this.metricsHistory[idx - 1]!;
          const dt = (m.timestamp - prev.timestamp) / 1000;
          if (dt > 0) cps = Math.round(((m.totalCasts - prev.totalCasts) / dt) * 100) / 100;
        }
        return {
          timestamp: m.timestamp,
          activeBots: m.activeBots,
          castsPerSecond: cps,
          cpuPercent: m.cpuPercent,
          memoryMB: m.memoryMB,
        };
      });

    return {
      activeBots,
      pausedBots,
      offlineBots: Math.max(0, totalBotsDb - activeBots - pausedBots),
      totalCatches,
      totalMisses,
      totalFish: Math.round(totalFish * 100) / 100,
      castsPerSecond,
      cpuPercent,
      memoryMB,
      uptimeSeconds: Math.round(process.uptime()),
      bots: botList,
      hourlyHistory,
      recentMetrics,
    };
  }

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
        delayMin: params.delayMin ?? 2300,
        delayMax: params.delayMax ?? 2600,
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
        bot.delayMin ?? 2300,
        bot.delayMax ?? 2600,
        bot.proxy || undefined,
        bot.autoRepair ?? false,
        bot.autoRepairMin ?? 15,
        bot.autoRepairMax ?? 25,
        bot.autoRepairWaitMinMinutes ?? 0,
        bot.autoRepairWaitMaxMinutes ?? 0,
        bot.autoWaitDurability ?? false,
        bot.autoWaitDurabilityMin ?? 15,
        bot.autoWaitDurabilityMax ?? 25,
        bot.autoWaitMinutesMin ?? 0,
        bot.autoWaitMinutesMax ?? 0,
        bot.currentWaitThreshold ?? 0,
        bot.durabilityPauseUntil ? new Date(bot.durabilityPauseUntil as any).getTime() : 0,
        bot.autoUpgrade ?? false,
        bot.autoRestartMinutes ?? 240,
        bot.autoBuyBait ?? false,
        bot.autoBuyBaitIds ?? "",
        bot.autoUseBaitId ?? 0,
        bot.autoBuyBaitThreshold ?? 100,
        bot.autoBuyBaitThresholds ?? "",
        bot.autoUseBaitOrder ?? "",
        bot.autoBuyBaitQty ?? "",
        bot.autoBuyBaitStock ?? ""
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

  getBotAutomationState(walletPubkey: string) {
    const instance = this.runningBots.get(walletPubkey);
    return instance ? instance.getAutomationState() : null;
  }

  async reshuffleWaitThreshold(walletPubkey: string) {
    const instance = this.runningBots.get(walletPubkey);
    if (instance) {
      await instance.reshuffleWaitThreshold();
      return { success: true, newThreshold: instance.getAutomationState().currentWaitThreshold };
    }

    // Bot parado: calcula direto do banco
    const bot = await this.getBot(walletPubkey);
    if (!bot) return { success: false, error: "Bot não encontrado" };

    const min = Math.min(bot.autoWaitDurabilityMin ?? 15, bot.autoWaitDurabilityMax ?? 25);
    const max = Math.max(bot.autoWaitDurabilityMin ?? 15, bot.autoWaitDurabilityMax ?? 25);
    const newThreshold = Math.floor(Math.random() * (max - min + 1)) + min;

    await db
      .update(bots)
      .set({ currentWaitThreshold: newThreshold, updatedAt: new Date() })
      .where(eq(bots.walletPubkey, walletPubkey));

    return { success: true, newThreshold };
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

  async getAnalytics(walletPubkey: string): Promise<BotAnalytics> {
    const sample = await db
      .select({
        type: castResults.type,
        fishAmount: castResults.fishAmount,
        timestamp: castResults.timestamp,
      })
      .from(castResults)
      .where(eq(castResults.walletPubkey, walletPubkey))
      .orderBy(desc(castResults.timestamp))
      .limit(6000);

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);
    const endOfYesterday = new Date(startOfDay.getTime() - 1);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const chronological = [...sample].reverse();
    const catches = chronological.filter((row) => row.type === "catch");
    const misses = chronological.length - catches.length;
    const sampledTotalFish = catches.reduce((sum, row) => sum + (row.fishAmount || 0), 0);

    const todayRows = chronological.filter((row) => {
      const ts = new Date(row.timestamp);
      return ts >= startOfDay && ts <= endOfDay;
    });
    const yesterdayRows = chronological.filter((row) => {
      const ts = new Date(row.timestamp);
      return ts >= startOfYesterday && ts <= endOfYesterday;
    });
    const todayCatchesRows = todayRows.filter((row) => row.type === "catch");
    const yesterdayCatchesRows = yesterdayRows.filter((row) => row.type === "catch");
    const todayMisses = todayRows.length - todayCatchesRows.length;
    const yesterdayMisses = yesterdayRows.length - yesterdayCatchesRows.length;
    const todayTotalFish = todayCatchesRows.reduce((sum, row) => sum + (row.fishAmount || 0), 0);
    const yesterdayTotalFish = yesterdayCatchesRows.reduce((sum, row) => sum + (row.fishAmount || 0), 0);

    const computeSuccessRate = (catchCount: number, missCount: number) =>
      catchCount + missCount > 0 ? (catchCount / (catchCount + missCount)) * 100 : 0;

    const elapsedDayMs = Math.max(1, now.getTime() - startOfDay.getTime());
    const fullDayMs = endOfDay.getTime() - startOfDay.getTime() + 1;
    const remainingDayMs = Math.max(0, endOfDay.getTime() - now.getTime());
    const elapsedDayPercent = Math.min(100, (elapsedDayMs / fullDayMs) * 100);

    const windows = [
      { key: "5m" as const, label: "5 min", durationMs: 5 * 60 * 1000 },
      { key: "15m" as const, label: "15 min", durationMs: 15 * 60 * 1000 },
      { key: "1h" as const, label: "1 hora", durationMs: 60 * 60 * 1000 },
      { key: "24h" as const, label: "24 horas", durationMs: 24 * 60 * 60 * 1000 },
    ].map((windowDef) => {
      const cutoff = now.getTime() - windowDef.durationMs;
      const rows = chronological.filter((row) => new Date(row.timestamp as any).getTime() >= cutoff);
      const windowCatches = rows.filter((row) => row.type === "catch");
      const windowMisses = rows.length - windowCatches.length;
      const totalFish = windowCatches.reduce((sum, row) => sum + (row.fishAmount || 0), 0);
      const catchCount = windowCatches.length;
      const firstTimestamp = rows.length > 0 ? new Date(rows[0]!.timestamp as any).getTime() : null;
      const observedDurationMs = firstTimestamp !== null
        ? Math.max(60_000, now.getTime() - firstTimestamp)
        : windowDef.durationMs;
      return {
        key: windowDef.key,
        label: windowDef.label,
        catches: catchCount,
        misses: windowMisses,
        totalFish,
        successRate: computeSuccessRate(catchCount, windowMisses),
        fishPerHour: totalFish * (60 * 60 * 1000 / observedDurationMs),
        avgFishPerCatch: catchCount > 0 ? totalFish / catchCount : 0,
        observedMinutes: Math.max(1, Math.round(observedDurationMs / 60_000)),
      };
    });

    const todayFirstTimestamp = todayRows.length > 0
      ? new Date(todayRows[0]!.timestamp as any).getTime()
      : null;
    const todayObservedMs = todayFirstTimestamp !== null
      ? Math.max(60_000, now.getTime() - todayFirstTimestamp)
      : elapsedDayMs;
    const todayObservedFishPerHour = todayTotalFish > 0
      ? todayTotalFish * (60 * 60 * 1000 / todayObservedMs)
      : 0;
    const todayObservedCatchesPerHour = todayCatchesRows.length > 0
      ? todayCatchesRows.length * (60 * 60 * 1000 / todayObservedMs)
      : 0;

    const blendCandidates: Array<{ rate: number; weight: number }> = [];
    const window15m = windows.find((windowStat) => windowStat.key === "15m");
    const window1h = windows.find((windowStat) => windowStat.key === "1h");
    const window24h = windows.find((windowStat) => windowStat.key === "24h");

    if (window15m && window15m.catches >= 2) {
      blendCandidates.push({ rate: window15m.fishPerHour, weight: 0.35 });
    }
    if (window1h && window1h.catches >= 3) {
      blendCandidates.push({ rate: window1h.fishPerHour, weight: 0.4 });
    }
    if (todayCatchesRows.length >= 5) {
      blendCandidates.push({ rate: todayObservedFishPerHour, weight: 0.25 });
    }
    if (window24h && window24h.catches >= 10) {
      blendCandidates.push({ rate: window24h.fishPerHour, weight: 0.1 });
    }

    const projectedFishPerHour = blendCandidates.length > 0
      ? blendCandidates.reduce((sum, item) => sum + item.rate * item.weight, 0) /
        blendCandidates.reduce((sum, item) => sum + item.weight, 0)
      : todayTotalFish > 0
        ? todayObservedFishPerHour
        : 0;

    const catchRateCandidates: Array<{ rate: number; weight: number }> = [];
    if (window15m && window15m.catches + window15m.misses >= 5) {
      catchRateCandidates.push({ rate: window15m.catches * (60 * 60 * 1000 / (window15m.observedMinutes * 60_000)), weight: 0.35 });
    }
    if (window1h && window1h.catches + window1h.misses >= 10) {
      catchRateCandidates.push({ rate: window1h.catches * (60 * 60 * 1000 / (window1h.observedMinutes * 60_000)), weight: 0.4 });
    }
    if (todayCatchesRows.length >= 5) {
      catchRateCandidates.push({ rate: todayObservedCatchesPerHour, weight: 0.25 });
    }

    const projectedCatchesPerHour = catchRateCandidates.length > 0
      ? catchRateCandidates.reduce((sum, item) => sum + item.rate * item.weight, 0) /
        catchRateCandidates.reduce((sum, item) => sum + item.weight, 0)
      : todayObservedCatchesPerHour;

    const projectedTotalFishToday = todayTotalFish + projectedFishPerHour * (remainingDayMs / (60 * 60 * 1000));
    const projectedCatchesToday = Math.round(todayCatchesRows.length + projectedCatchesPerHour * (remainingDayMs / (60 * 60 * 1000)));

    let currentCatch = 0;
    let currentMiss = 0;
    let maxCatch = 0;
    let maxMiss = 0;
    let runningCatch = 0;
    let runningMiss = 0;
    for (const row of chronological) {
      if (row.type === "catch") {
        runningCatch += 1;
        runningMiss = 0;
      } else {
        runningMiss += 1;
        runningCatch = 0;
      }
      maxCatch = Math.max(maxCatch, runningCatch);
      maxMiss = Math.max(maxMiss, runningMiss);
    }
    for (let i = chronological.length - 1; i >= 0; i--) {
      const row = chronological[i];
      if (!row) continue;
      if (row.type === "catch") {
        if (currentMiss > 0) break;
        currentCatch += 1;
      } else {
        if (currentCatch > 0) break;
        currentMiss += 1;
      }
    }

    const hourlySeries = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour.toString().padStart(2, "0")}:00`,
      fish: 0,
      catches: 0,
      cumulativeFish: 0,
    }));

    for (const row of todayCatchesRows) {
      const ts = new Date(row.timestamp);
      const bucket = hourlySeries[ts.getHours()];
      if (!bucket) continue;
      bucket.fish += row.fishAmount || 0;
      bucket.catches += 1;
    }

    let cumulativeFish = 0;
    for (const bucket of hourlySeries) {
      cumulativeFish += bucket.fish;
      bucket.cumulativeFish = cumulativeFish;
    }

    const grouped = new Map<string, { amount: number; timestamps: number[]; totalFish: number; count: number }>();
    for (const row of catches) {
      const amount = Number((row.fishAmount || 0).toFixed(3));
      const key = amount.toFixed(3);
      if (!grouped.has(key)) {
        grouped.set(key, { amount, timestamps: [], totalFish: 0, count: 0 });
      }
      const group = grouped.get(key)!;
      group.count += 1;
      group.totalFish += row.fishAmount || 0;
      group.timestamps.push(new Date(row.timestamp as any).getTime());
    }

    const fishTypes: FishTypeAnalytics[] = Array.from(grouped.values())
      .map((group) => {
        const timestamps = [...group.timestamps].sort((a, b) => a - b);
        const gaps: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
          gaps.push((timestamps[i] ?? 0) - (timestamps[i - 1] ?? 0));
        }

        const averageGapMs = gaps.length > 0
          ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length
          : null;
        const maxGapMs = gaps.length > 0 ? Math.max(...gaps) : null;
        const lastTimestamp = timestamps.length > 0 ? timestamps[timestamps.length - 1]! : null;
        const lastSeenAt = lastTimestamp !== null ? new Date(lastTimestamp) : null;
        const timeSinceLastMs = lastSeenAt ? now.getTime() - lastSeenAt.getTime() : null;
        const overdueRatio = averageGapMs && timeSinceLastMs !== null ? timeSinceLastMs / averageGapMs : null;

        let status: FishTypeAnalytics["status"] = "insufficient_data";
        if (group.count >= 2 && overdueRatio !== null) {
          if (overdueRatio >= 1.5) status = "late";
          else if (overdueRatio >= 1) status = "attention";
          else status = "normal";
        }

        return {
          amount: group.amount,
          amountLabel: group.amount.toFixed(3),
          count: group.count,
          totalFish: group.totalFish,
          probability: catches.length > 0 ? (group.count / catches.length) * 100 : 0,
          lastSeenAt,
          averageGapMs,
          maxGapMs,
          timeSinceLastMs,
          overdueRatio,
          status,
        };
      })
      .sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return b.count - a.count;
      })
      .slice(0, 8);

    return {
      sampledCatches: catches.length,
      sampledMisses: misses,
      sampledTotalFish,
      windows,
      todayCatches: todayCatchesRows.length,
      todayMisses,
      todayTotalFish,
      yesterdayCatches: yesterdayCatchesRows.length,
      yesterdayMisses,
      yesterdayTotalFish,
      comparison: {
        fishDelta: todayTotalFish - yesterdayTotalFish,
        fishDeltaPercent: yesterdayTotalFish > 0 ? ((todayTotalFish - yesterdayTotalFish) / yesterdayTotalFish) * 100 : null,
        catchesDelta: todayCatchesRows.length - yesterdayCatchesRows.length,
        successRateDelta:
          computeSuccessRate(todayCatchesRows.length, todayMisses) -
          computeSuccessRate(yesterdayCatchesRows.length, yesterdayMisses),
      },
      projectedTotalFishToday,
      projectedCatchesToday,
      elapsedDayPercent,
      streaks: {
        currentCatch,
        currentMiss,
        maxCatch,
        maxMiss,
      },
      hourlySeries,
      fishTypes,
    };
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

  private async enforcePerWalletRetention(
    tableName: "logs" | "cast_results" | "bot_history",
    limitPerWallet: number
  ): Promise<number> {
    if (limitPerWallet <= 0) {
      return 0;
    }

    const result = runSql(`
      DELETE FROM ${tableName}
      WHERE id IN (
        SELECT id FROM (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY wallet_pubkey
              ORDER BY timestamp DESC, id DESC
            ) AS row_num
          FROM ${tableName}
        )
        WHERE row_num > ${limitPerWallet}
      )
    `);

    return result.changes;
  }

  /**
   * Limpeza periódica de dados antigos.
   * Remove dados velhos, limita volume por wallet e compacta o SQLite/WAL.
   */
  async cleanupOldData(
    maxAgeDays: number = 3,
    limits: {
      maxLogsPerWallet?: number;
      maxResultsPerWallet?: number;
      maxHistoryPerWallet?: number;
    } = {}
  ): Promise<{ logsDeleted: number; resultsDeleted: number; historyDeleted: number }> {
    dbBatcher.flush();

    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const maxLogsPerWallet = limits.maxLogsPerWallet ?? 6000;
    const maxResultsPerWallet = limits.maxResultsPerWallet ?? 6000;
    const maxHistoryPerWallet = limits.maxHistoryPerWallet ?? 6000;

    const logsResult = runSql(`DELETE FROM logs WHERE timestamp < ${cutoff.getTime()}`);
    const resultsResult = runSql(`DELETE FROM cast_results WHERE timestamp < ${cutoff.getTime()}`);
    const historyResult = runSql(`DELETE FROM bot_history WHERE timestamp < ${cutoff.getTime()}`);

    const extraLogsDeleted = await this.enforcePerWalletRetention("logs", maxLogsPerWallet);
    const extraResultsDeleted = await this.enforcePerWalletRetention("cast_results", maxResultsPerWallet);
    const extraHistoryDeleted = await this.enforcePerWalletRetention("bot_history", maxHistoryPerWallet);

    const logsDeleted = logsResult.changes + extraLogsDeleted;
    const resultsDeleted = resultsResult.changes + extraResultsDeleted;
    const historyDeleted = historyResult.changes + extraHistoryDeleted;

    if (logsDeleted > 0 || resultsDeleted > 0 || historyDeleted > 0) {
      runDatabaseMaintenance();
      console.log(
        `🧹 Cleanup: ${logsDeleted} logs, ${resultsDeleted} results, ${historyDeleted} history ` +
        `(>${maxAgeDays} dias | caps: logs=${maxLogsPerWallet}, results=${maxResultsPerWallet}, history=${maxHistoryPerWallet})`
      );
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
    config: {
      delayMin?: number; delayMax?: number; proxy?: string;
      autoRepair?: boolean; autoRepairMin?: number; autoRepairMax?: number;
      autoRepairWaitMinMinutes?: number; autoRepairWaitMaxMinutes?: number;
      autoWaitDurability?: boolean; autoWaitDurabilityMin?: number; autoWaitDurabilityMax?: number;
      autoWaitMinutesMin?: number; autoWaitMinutesMax?: number;
      autoUpgrade?: boolean; autoRestartMinutes?: number;
      autoBuyBait?: boolean; autoBuyBaitIds?: string; autoUseBaitId?: number; autoBuyBaitThreshold?: number;
      autoBuyBaitThresholds?: string; autoUseBaitOrder?: string; autoBuyBaitQty?: string; autoBuyBaitStock?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (config.delayMin !== undefined) updateData.delayMin = config.delayMin;
      if (config.delayMax !== undefined) updateData.delayMax = config.delayMax;
      if (config.proxy !== undefined) updateData.proxy = config.proxy;
      if (config.autoRepair !== undefined) updateData.autoRepair = config.autoRepair;
      if (config.autoRepairMin !== undefined) updateData.autoRepairMin = config.autoRepairMin;
      if (config.autoRepairMax !== undefined) updateData.autoRepairMax = config.autoRepairMax;
      if (config.autoRepairWaitMinMinutes !== undefined) updateData.autoRepairWaitMinMinutes = config.autoRepairWaitMinMinutes;
      if (config.autoRepairWaitMaxMinutes !== undefined) updateData.autoRepairWaitMaxMinutes = config.autoRepairWaitMaxMinutes;
      if (config.autoWaitDurability !== undefined) updateData.autoWaitDurability = config.autoWaitDurability;
      if (config.autoWaitDurabilityMin !== undefined) updateData.autoWaitDurabilityMin = config.autoWaitDurabilityMin;
      if (config.autoWaitDurabilityMax !== undefined) updateData.autoWaitDurabilityMax = config.autoWaitDurabilityMax;
      if (config.autoWaitMinutesMin !== undefined) updateData.autoWaitMinutesMin = config.autoWaitMinutesMin;
      if (config.autoWaitMinutesMax !== undefined) updateData.autoWaitMinutesMax = config.autoWaitMinutesMax;
      if (config.autoWaitDurability === false) {
        updateData.currentWaitThreshold = 0;
        updateData.durabilityPauseUntil = null;
      }
      if (config.autoUpgrade !== undefined) updateData.autoUpgrade = config.autoUpgrade;
      if (config.autoRestartMinutes !== undefined) updateData.autoRestartMinutes = config.autoRestartMinutes;
      if (config.autoBuyBait !== undefined) updateData.autoBuyBait = config.autoBuyBait;
      if (config.autoBuyBaitIds !== undefined) updateData.autoBuyBaitIds = config.autoBuyBaitIds;
      if (config.autoUseBaitId !== undefined) updateData.autoUseBaitId = config.autoUseBaitId;
      if (config.autoBuyBaitThreshold !== undefined) updateData.autoBuyBaitThreshold = config.autoBuyBaitThreshold;
      if (config.autoBuyBaitThresholds !== undefined) updateData.autoBuyBaitThresholds = config.autoBuyBaitThresholds;
      if (config.autoUseBaitOrder !== undefined) updateData.autoUseBaitOrder = config.autoUseBaitOrder;
      if (config.autoBuyBaitQty !== undefined) updateData.autoBuyBaitQty = config.autoBuyBaitQty;
      if (config.autoBuyBaitStock !== undefined) updateData.autoBuyBaitStock = config.autoBuyBaitStock;

      await db
        .update(bots)
        .set(updateData)
        .where(eq(bots.walletPubkey, walletPubkey));

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
        if (config.autoRepair !== undefined) instance.autoRepair = config.autoRepair;
        if (config.autoRepairMin !== undefined) instance.autoRepairMin = config.autoRepairMin;
        if (config.autoRepairMax !== undefined) instance.autoRepairMax = config.autoRepairMax;
        if (config.autoRepairWaitMinMinutes !== undefined) instance.autoRepairWaitMinMinutes = config.autoRepairWaitMinMinutes;
        if (config.autoRepairWaitMaxMinutes !== undefined) instance.autoRepairWaitMaxMinutes = config.autoRepairWaitMaxMinutes;
        if (config.autoWaitDurability !== undefined) instance.autoWaitDurability = config.autoWaitDurability;
        if (config.autoWaitDurabilityMin !== undefined) instance.autoWaitDurabilityMin = config.autoWaitDurabilityMin;
        if (config.autoWaitDurabilityMax !== undefined) instance.autoWaitDurabilityMax = config.autoWaitDurabilityMax;
        if (config.autoWaitMinutesMin !== undefined) instance.autoWaitMinutesMin = config.autoWaitMinutesMin;
        if (config.autoWaitMinutesMax !== undefined) instance.autoWaitMinutesMax = config.autoWaitMinutesMax;
        if (config.autoWaitDurability === false) await instance.clearDurabilityPauseState(false);
        if (config.autoUpgrade !== undefined) instance.autoUpgrade = config.autoUpgrade;
        if (config.autoRestartMinutes !== undefined) instance.autoRestartMinutes = config.autoRestartMinutes;
        if (config.autoBuyBait !== undefined) instance.autoBuyBait = config.autoBuyBait;
        if (config.autoBuyBaitIds !== undefined) instance.autoBuyBaitIds = config.autoBuyBaitIds;
        if (config.autoUseBaitId !== undefined) instance.autoUseBaitId = config.autoUseBaitId;
        if (config.autoBuyBaitThreshold !== undefined) instance.autoBuyBaitThreshold = config.autoBuyBaitThreshold;
        if (config.autoBuyBaitThresholds !== undefined) instance.autoBuyBaitThresholds = config.autoBuyBaitThresholds;
        if (config.autoUseBaitOrder !== undefined) instance.autoUseBaitOrder = config.autoUseBaitOrder;
        if (config.autoBuyBaitQty !== undefined) instance.autoBuyBaitQty = config.autoBuyBaitQty;
        if (config.autoBuyBaitStock !== undefined) instance.autoBuyBaitStock = config.autoBuyBaitStock;
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async buyBait(walletPubkey: string, baitType: number, quantity: number = 1): Promise<{ success: boolean; error?: string }> {
    const instance = this.runningBots.get(walletPubkey);
    if (!instance) {
      return { success: false, error: "Bot não está rodando" };
    }
    return instance.buyBait(baitType, quantity);
  }

  async equipBait(walletPubkey: string, baitType: number): Promise<{ success: boolean; error?: string }> {
    const instance = this.runningBots.get(walletPubkey);
    if (!instance) {
      return { success: false, error: "Bot não está rodando" };
    }
    return instance.equipBait(baitType);
  }

  // ===================== BAIT PRESETS =====================

  private generateShareCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sem I/O/0/1 (ambíguos)
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async listPresets(walletPubkey: string): Promise<BaitPreset[]> {
    return db
      .select()
      .from(baitPresets)
      .where(eq(baitPresets.walletPubkey, walletPubkey))
      .orderBy(desc(baitPresets.updatedAt));
  }

  async createPreset(walletPubkey: string, data: {
    name: string;
    autoBuyBaitIds: string;
    autoBuyBaitThresholds: string;
    autoBuyBaitQty: string;
    autoUseBaitOrder: string;
  }): Promise<{ success: boolean; preset?: BaitPreset; error?: string }> {
    try {
      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(baitPresets)
        .where(eq(baitPresets.walletPubkey, walletPubkey));

      if ((existing[0]?.count ?? 0) >= 20) {
        return { success: false, error: "Limite de 20 presets atingido" };
      }

      const [preset] = await db
        .insert(baitPresets)
        .values({
          walletPubkey,
          name: data.name.slice(0, 50),
          autoBuyBaitIds: data.autoBuyBaitIds,
          autoBuyBaitThresholds: data.autoBuyBaitThresholds,
          autoBuyBaitQty: data.autoBuyBaitQty,
          autoUseBaitOrder: data.autoUseBaitOrder,
        })
        .returning();

      return { success: true, preset };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async updatePreset(walletPubkey: string, presetId: number, data: {
    name?: string;
    autoBuyBaitIds?: string;
    autoBuyBaitThresholds?: string;
    autoBuyBaitQty?: string;
    autoUseBaitOrder?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (data.name !== undefined) updateData.name = data.name.slice(0, 50);
      if (data.autoBuyBaitIds !== undefined) updateData.autoBuyBaitIds = data.autoBuyBaitIds;
      if (data.autoBuyBaitThresholds !== undefined) updateData.autoBuyBaitThresholds = data.autoBuyBaitThresholds;
      if (data.autoBuyBaitQty !== undefined) updateData.autoBuyBaitQty = data.autoBuyBaitQty;
      if (data.autoUseBaitOrder !== undefined) updateData.autoUseBaitOrder = data.autoUseBaitOrder;

      await db
        .update(baitPresets)
        .set(updateData)
        .where(and(
          eq(baitPresets.id, presetId),
          eq(baitPresets.walletPubkey, walletPubkey)
        ));

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async deletePreset(walletPubkey: string, presetId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await db
        .delete(baitPresets)
        .where(and(
          eq(baitPresets.id, presetId),
          eq(baitPresets.walletPubkey, walletPubkey)
        ));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async generatePresetShareCode(walletPubkey: string, presetId: number): Promise<{ success: boolean; shareCode?: string; error?: string }> {
    try {
      const [preset] = await db
        .select()
        .from(baitPresets)
        .where(and(
          eq(baitPresets.id, presetId),
          eq(baitPresets.walletPubkey, walletPubkey)
        ));

      if (!preset) {
        return { success: false, error: "Preset não encontrado" };
      }

      if (preset.shareCode) {
        return { success: true, shareCode: preset.shareCode };
      }

      let code: string = "";
      let attempts = 0;
      do {
        code = this.generateShareCode();
        attempts++;
        const [exists] = await db
          .select({ id: baitPresets.id })
          .from(baitPresets)
          .where(eq(baitPresets.shareCode, code))
          .limit(1);
        if (!exists) break;
      } while (attempts < 10);

      if (attempts >= 10) {
        return { success: false, error: "Não foi possível gerar código único" };
      }

      await db
        .update(baitPresets)
        .set({ shareCode: code, updatedAt: new Date() })
        .where(eq(baitPresets.id, presetId));

      return { success: true, shareCode: code };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async importPresetByShareCode(walletPubkey: string, shareCode: string): Promise<{ success: boolean; preset?: BaitPreset; error?: string }> {
    try {
      const [source] = await db
        .select()
        .from(baitPresets)
        .where(eq(baitPresets.shareCode, shareCode.toUpperCase()))
        .limit(1);

      if (!source) {
        return { success: false, error: "Código não encontrado" };
      }

      return this.createPreset(walletPubkey, {
        name: `${source.name} (importado)`,
        autoBuyBaitIds: source.autoBuyBaitIds,
        autoBuyBaitThresholds: source.autoBuyBaitThresholds,
        autoBuyBaitQty: source.autoBuyBaitQty,
        autoUseBaitOrder: source.autoUseBaitOrder,
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async applyPreset(walletPubkey: string, presetId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const [preset] = await db
        .select()
        .from(baitPresets)
        .where(and(
          eq(baitPresets.id, presetId),
          eq(baitPresets.walletPubkey, walletPubkey)
        ));

      if (!preset) {
        return { success: false, error: "Preset não encontrado" };
      }

      return this.updateBotConfig(walletPubkey, {
        autoBuyBaitIds: preset.autoBuyBaitIds,
        autoBuyBaitThresholds: preset.autoBuyBaitThresholds,
        autoBuyBaitQty: preset.autoBuyBaitQty,
        autoUseBaitOrder: preset.autoUseBaitOrder,
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Map de execuções de carrinho ativas
  private runningCarts: Map<string, boolean> = new Map(); // key: "wallet:presetId"

  private parseQtyMap(str: string): Record<number, number> {
    const map: Record<number, number> = {};
    if (str) {
      str.split(",").forEach(entry => {
        const [id, qty] = entry.split(":").map(Number);
        if (id !== undefined && qty !== undefined && id >= 1 && id <= 10 && qty > 0) map[id] = qty;
      });
    }
    return map;
  }

  private serializeQtyMap(map: Record<number, number>): string {
    return Object.entries(map)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => `${id}:${qty}`)
      .join(",");
  }

  async executeCart(walletPubkey: string, presetId: number): Promise<{ success: boolean; error?: string }> {
    const cartKey = `${walletPubkey}:${presetId}`;

    if (this.runningCarts.get(cartKey)) {
      return { success: false, error: "Este carrinho já está em execução" };
    }

    const instance = this.runningBots.get(walletPubkey);
    if (!instance || !instance.service) {
      return { success: false, error: "Bot não está rodando" };
    }

    const [preset] = await db
      .select()
      .from(baitPresets)
      .where(and(eq(baitPresets.id, presetId), eq(baitPresets.walletPubkey, walletPubkey)));

    if (!preset) {
      return { success: false, error: "Carrinho não encontrado" };
    }

    const targetQty = this.parseQtyMap(preset.autoBuyBaitQty);
    if (Object.keys(targetQty).length === 0) {
      return { success: false, error: "Carrinho vazio - defina quantidades primeiro" };
    }

    // Marca como running
    this.runningCarts.set(cartKey, true);
    await db.update(baitPresets).set({
      status: "running", statusMessage: null, purchasedQty: preset.purchasedQty || "", updatedAt: new Date(),
    }).where(eq(baitPresets.id, presetId));

    // Executa em background
    this.executeCartLoop(walletPubkey, presetId, cartKey, instance).catch(err => {
      console.error(`Erro fatal no carrinho ${cartKey}:`, err);
    });

    return { success: true };
  }

  private async executeCartLoop(
    walletPubkey: string,
    presetId: number,
    cartKey: string,
    instance: BotInstance,
  ) {
    try {
      while (this.runningCarts.get(cartKey)) {
        // Recarrega preset do banco para pegar estado atualizado
        const [preset] = await db.select().from(baitPresets)
          .where(and(eq(baitPresets.id, presetId), eq(baitPresets.walletPubkey, walletPubkey)));

        if (!preset || preset.status !== "running") break;

        const targetQty = this.parseQtyMap(preset.autoBuyBaitQty);
        const purchasedQty = this.parseQtyMap(preset.purchasedQty);

        // Encontra proximo item a comprar
        let nextBaitId: number | null = null;
        let nextRemaining = 0;
        for (const [idStr, target] of Object.entries(targetQty)) {
          const id = Number(idStr);
          const purchased = purchasedQty[id] || 0;
          if (purchased < target) {
            nextBaitId = id;
            nextRemaining = target - purchased;
            break;
          }
        }

        // Se nao tem mais nada para comprar, carrinho concluido
        if (nextBaitId === null) {
          await db.update(baitPresets).set({
            status: "done", statusMessage: "Todas as compras concluidas!", updatedAt: new Date(),
          }).where(eq(baitPresets.id, presetId));
          break;
        }

        // Verifica se o bot ainda esta rodando
        if (!instance.service) {
          await db.update(baitPresets).set({
            status: "error", statusMessage: "Bot parou de rodar", updatedAt: new Date(),
          }).where(eq(baitPresets.id, presetId));
          break;
        }

        // Busca custos dinamicos e saldo
        try {
          const dynamicCosts = await instance.service.fetchBaitDynamicCosts();
          const balances = await instance.service.fetchBalances();

          const unitFishCost = dynamicCosts?.[nextBaitId]?.fishCost ?? BAIT_FISH_COST[nextBaitId] ?? 0;
          const unitUsdcCost = dynamicCosts?.[nextBaitId]?.usdcFee ?? BAIT_USDC_COST[nextBaitId] ?? 0;

          // Verifica saldo para 1 unidade
          if (balances) {
            if (balances.fish < unitFishCost) {
              await db.update(baitPresets).set({
                status: "error",
                statusMessage: `FISH insuficiente para ${BAIT_NAMES[nextBaitId]} (${Math.round(balances.fish).toLocaleString()} < ${Math.round(unitFishCost).toLocaleString()})`,
                updatedAt: new Date(),
              }).where(eq(baitPresets.id, presetId));
              break;
            }
            if (balances.usdc < unitUsdcCost) {
              await db.update(baitPresets).set({
                status: "error",
                statusMessage: `USDC insuficiente para ${BAIT_NAMES[nextBaitId]} (${balances.usdc.toFixed(2)} < ${unitUsdcCost.toFixed(2)})`,
                updatedAt: new Date(),
              }).where(eq(baitPresets.id, presetId));
              break;
            }
          }

          // Compra 1 unidade
          const baitName = BAIT_NAMES[nextBaitId] || `tipo ${nextBaitId}`;
          const purchased = purchasedQty[nextBaitId] || 0;
          const target = targetQty[nextBaitId] || 0;

          await db.update(baitPresets).set({
            statusMessage: `Comprando ${baitName}... (${purchased + 1}/${target})`,
            updatedAt: new Date(),
          }).where(eq(baitPresets.id, presetId));

          const sig = await instance.service.buyRiverBait(nextBaitId, 1);

          if (sig) {
            // Atualiza progresso
            purchasedQty[nextBaitId] = purchased + 1;
            await db.update(baitPresets).set({
              purchasedQty: this.serializeQtyMap(purchasedQty),
              statusMessage: `${baitName} ${purchased + 1}/${target} comprado!`,
              updatedAt: new Date(),
            }).where(eq(baitPresets.id, presetId));

            instance.addLog("success", `🛒 Carrinho: ${baitName} ${purchased + 1}/${target} comprado!`, "general");
          } else {
            await db.update(baitPresets).set({
              status: "error",
              statusMessage: `Falha na transacao de compra de ${baitName}`,
              updatedAt: new Date(),
            }).where(eq(baitPresets.id, presetId));
            break;
          }
        } catch (buyErr: any) {
          await db.update(baitPresets).set({
            status: "error",
            statusMessage: `Erro: ${buyErr.message}`,
            updatedAt: new Date(),
          }).where(eq(baitPresets.id, presetId));
          break;
        }

        // Sleep entre compras (2-4 seg para nao sobrecarregar)
        await Bun.sleep(2000 + Math.random() * 2000);
      }
    } finally {
      this.runningCarts.delete(cartKey);
    }
  }

  async stopCart(walletPubkey: string, presetId: number): Promise<{ success: boolean; error?: string }> {
    const cartKey = `${walletPubkey}:${presetId}`;
    this.runningCarts.delete(cartKey);

    await db.update(baitPresets).set({
      status: "idle", statusMessage: "Parado pelo usuario", updatedAt: new Date(),
    }).where(and(eq(baitPresets.id, presetId), eq(baitPresets.walletPubkey, walletPubkey)));

    return { success: true };
  }

  async resetCart(walletPubkey: string, presetId: number): Promise<{ success: boolean; error?: string }> {
    const cartKey = `${walletPubkey}:${presetId}`;
    if (this.runningCarts.get(cartKey)) {
      return { success: false, error: "Pare o carrinho antes de resetar" };
    }

    await db.update(baitPresets).set({
      purchasedQty: "", status: "idle", statusMessage: null, updatedAt: new Date(),
    }).where(and(eq(baitPresets.id, presetId), eq(baitPresets.walletPubkey, walletPubkey)));

    return { success: true };
  }

  async saveCurrentConfigAsPreset(walletPubkey: string, name: string): Promise<{ success: boolean; preset?: BaitPreset; error?: string }> {
    try {
      const bot = await this.getBot(walletPubkey);
      if (!bot) {
        return { success: false, error: "Bot não encontrado" };
      }

      return this.createPreset(walletPubkey, {
        name,
        autoBuyBaitIds: bot.autoBuyBaitIds || "",
        autoBuyBaitThresholds: bot.autoBuyBaitThresholds || "",
        autoBuyBaitQty: bot.autoBuyBaitQty || "",
        autoUseBaitOrder: bot.autoUseBaitOrder || "",
      });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

// Exporta instância singleton
export const botManager = new BotManager();
