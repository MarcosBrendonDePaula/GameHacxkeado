import WebSocket, { type ClientOptions } from "ws";
import { randomBytes } from "crypto";
import { BOT_CONFIG, CUSTOM_HEADERS } from "../config/constants";
import { Logger } from "../utils/helpers";
import { createProxyAgent } from "../utils/proxy";

export interface CastLogResult {
  isCatch: boolean;
  fishAmount?: number;
  confirmed?: boolean;
}

export interface CastStats {
  catches: number;
  misses: number;
  totalFish: number;
  pending: number;
}

interface PendingCast {
  signature: string;
  timestamp: number;
}

type StatsCallback = (result: CastLogResult) => void;

const deriveWsEndpoint = (rpcEndpoint: string): string => {
  if (BOT_CONFIG.ws_endpoint && BOT_CONFIG.ws_endpoint.trim().length > 0) {
    return BOT_CONFIG.ws_endpoint.trim();
  }
  try {
    const parsed = new URL(rpcEndpoint);
    const host = parsed.hostname.startsWith("ws.") ? parsed.hostname : `ws.${parsed.hostname}`;
    const apiKey = parsed.searchParams.get("key");
    return apiKey ? `wss://${host}?key=${apiKey}` : `wss://${host}`;
  } catch {
    return rpcEndpoint;
  }
};

export class CastLogMonitor {
  private ws: WebSocket | null = null;
  private readonly wsEndpoint: string;
  private readonly logger: Logger;
  private readonly proxyAgent?: any;
  private readonly playerAccount: string;

  // Lista de casts pendentes
  private pendingCasts: PendingCast[] = [];
  private lastKnownFishCaught: bigint = BigInt(0);
  private lastKnownCastCount: bigint = BigInt(0);
  private stateInitialized = false;

  // Callback para atualizar estatísticas
  private onResultCallback: StatsCallback | null = null;

  private accountSubscriptionId: number | null = null;
  private reconnectTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private nextRequestId = 1;
  private disposed = false;
  private isSubscribed = false;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30 segundos máximo

  constructor(rpcEndpoint: string, proxyUrl?: string, label?: string, playerAccount?: string) {
    this.wsEndpoint = deriveWsEndpoint(rpcEndpoint);
    this.proxyAgent = proxyUrl ? createProxyAgent(proxyUrl) : undefined;
    this.logger = new Logger(label ? `${label} [WS]` : "WS MONITOR");
    this.playerAccount = playerAccount || BOT_CONFIG.ws_watch_account || "";
  }

  /**
   * Define callback para quando um resultado chegar
   */
  onResult(callback: StatsCallback) {
    this.onResultCallback = callback;
  }

  /**
   * Registra um cast pendente (não bloqueia)
   */
  registerCast(signature: string) {
    this.ensureConnection();

    this.pendingCasts.push({
      signature,
      timestamp: Date.now()
    });
  }

  /**
   * Retorna quantos casts estão pendentes
   */
  getPendingCount(): number {
    return this.pendingCasts.length;
  }

  /**
   * Limpa casts pendentes antigos (timeout)
   */
  private cleanupOldPending() {
    const timeout = BOT_CONFIG.ws_timeout_ms || 15000;
    const now = Date.now();

    this.pendingCasts = this.pendingCasts.filter(p => {
      if (now - p.timestamp > timeout) {
        this.logger.debug(`Cast ${p.signature.slice(0, 8)}... expirou`);
        return false;
      }
      return true;
    });
  }

  // Mantém compatibilidade - agora retorna imediatamente
  waitForSignature(signature: string, timeoutMs?: number): Promise<CastLogResult | null> {
    return Promise.resolve(null);
  }

  waitForCast(fishCaughtBefore: string, timeoutMs?: number): Promise<CastLogResult | null> {
    return Promise.resolve(null);
  }

  /**
   * Verifica se o WebSocket está saudável (conectado ou tentando reconectar)
   */
  isHealthy(): boolean {
    if (this.disposed) {
      this.logger.debug(`isHealthy: disposed = true`);
      return false;
    }

    // Se está conectado, está saudável
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return true;
    }

    // Se está conectando E é a primeira tentativa, aguarda
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING && this.reconnectAttempts === 0) {
      this.logger.debug(`isHealthy: Primeira conexão em andamento...`);
      return true;
    }

    // Se tem um timer de reconexão agendado E não passou de muitas tentativas
    if (this.reconnectTimer && this.reconnectAttempts < 10) {
      this.logger.debug(`isHealthy: Aguardando reconexão (tentativa ${this.reconnectAttempts})...`);
      return true;
    }

    // Log do estado atual
    const wsState = this.ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.ws.readyState] : 'null';
    this.logger.debug(`isHealthy: FALSE - ws=${wsState}, reconnectTimer=${!!this.reconnectTimer}, attempts=${this.reconnectAttempts}`);

    // Caso contrário, está morto
    return false;
  }

  /**
   * Retorna informações sobre o estado do WebSocket
   */
  getStatus(): {
    status: "connected" | "connecting" | "disconnected" | "reconnecting";
    reconnectAttempts: number;
    lastError?: string;
  } {
    if (this.disposed) {
      return { status: "disconnected", reconnectAttempts: this.reconnectAttempts };
    }

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        return { status: "connected", reconnectAttempts: 0 };
      }
      if (this.ws.readyState === WebSocket.CONNECTING) {
        return {
          status: this.reconnectAttempts > 0 ? "reconnecting" : "connecting",
          reconnectAttempts: this.reconnectAttempts
        };
      }
    }

    if (this.reconnectTimer) {
      return { status: "reconnecting", reconnectAttempts: this.reconnectAttempts };
    }

    return { status: "disconnected", reconnectAttempts: this.reconnectAttempts };
  }

  close() {
    this.disposed = true;
    this.stopPingLoop();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.ws?.close();
    this.pendingCasts = [];
  }

  private ensureConnection() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.connect();
  }

  private connect() {
    if (this.disposed) return;

    const headers: Record<string, string> = {
      ...CUSTOM_HEADERS,
      Accept: "*/*",
      Origin: "https://app.fogofishing.com",
      Connection: "Upgrade",
      Upgrade: "websocket",
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Extensions": "permessage-deflate",
      "Sec-Fetch-Mode": "websocket",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Site": "cross-site",
      "Sec-WebSocket-Key": randomBytes(16).toString("base64"),
    };

    const options: ClientOptions = { headers };
    if (this.proxyAgent) {
      // @ts-ignore
      options.agent = this.proxyAgent;
    }

    const attemptInfo = this.reconnectAttempts > 0 ? ` (tentativa #${this.reconnectAttempts})` : "";
    this.logger.info(`🔌 Conectando websocket${attemptInfo}...`);
    this.ws = new WebSocket(this.wsEndpoint, options);
    this.isSubscribed = false;

    this.ws.on("open", () => {
      // Ao reconectar, descarta pendentes antigos (resultados já se perderam)
      if (this.reconnectAttempts > 0 && this.pendingCasts.length > 0) {
        this.logger.info(`🧹 Reconexão: descartando ${this.pendingCasts.length} cast(s) pendentes`);
        this.pendingCasts = [];
      }
      this.reconnectAttempts = 0;
      this.stateInitialized = false; // Re-inicializa baseline do estado on-chain
      this.logger.success("✅ Websocket conectado com sucesso!");
      this.startPingLoop();
      this.subscribeToAccount();
    });

    this.ws.on("message", (data: any) => this.handleMessage(data));

    this.ws.on("close", (code, reason) => {
      this.reconnectAttempts++;
      this.logger.warn(
        `Websocket fechado (${code})${reason && reason.length ? ` razão: ${reason.toString()}` : ""}. Tentativa de reconexão #${this.reconnectAttempts}...`
      );
      this.stopPingLoop();
      this.isSubscribed = false;
      this.accountSubscriptionId = null;
      this.scheduleReconnect();
    });

    this.ws.on("error", (error) => {
      this.logger.error(`❌ Erro no websocket: ${(error as Error).message}`);
      // Log mais detalhado
      if ((error as any).code) {
        this.logger.error(`   Código: ${(error as any).code}`);
      }
      if ((error as any).syscall) {
        this.logger.error(`   Syscall: ${(error as any).syscall}`);
      }
    });
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer) return;

    // Backoff exponencial: aumenta delay a cada falha, mas com limite
    const baseDelay = BOT_CONFIG.ws_reconnect_ms || 1000;
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(1.5, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    const delay = Math.floor(exponentialDelay);

    this.logger.debug(`Reconectando em ${(delay / 1000).toFixed(1)}s...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delay);
  }

  private subscribeToAccount() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.playerAccount) return;

    const payload = {
      jsonrpc: "2.0",
      id: this.nextRequestId++,
      method: "accountSubscribe",
      params: [
        this.playerAccount,
        { encoding: "base64", commitment: "confirmed" }
      ],
    };

    const data = JSON.stringify(payload);
    this.logger.debug(`[WS] → accountSubscribe: ${this.playerAccount.slice(0, 12)}...`);
    this.ws.send(data);
  }

  private startPingLoop() {
    this.stopPingLoop();
    const interval = BOT_CONFIG.ws_ping_interval_ms || 10000;
    this.pingTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      // Ping JSON-RPC sem id, igual ao jogo faz
      this.ws.send('{"jsonrpc":"2.0","method":"ping"}');

      // Limpa pendentes antigos
      this.cleanupOldPending();
    }, interval);
  }

  private stopPingLoop() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  private handleMessage(data: any) {
    let parsed: any;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return;
    }

    // Resposta do accountSubscribe
    if (parsed.id && typeof parsed.result === "number" && !this.isSubscribed) {
      this.accountSubscriptionId = parsed.result;
      this.isSubscribed = true;
      this.logger.debug(`Account subscription criada: ${this.accountSubscriptionId}`);
      return;
    }

    // Erro
    if (parsed.error) {
      this.logger.debug(`[WS] Erro: ${JSON.stringify(parsed.error)}`);
      return;
    }

    // Notificação de mudança na conta
    if (parsed.method === "accountNotification" && parsed.params?.subscription === this.accountSubscriptionId) {
      this.handleAccountChange(parsed.params?.result);
    }
  }

  private handleAccountChange(result: any) {
    // Decodifica PlayerState para extrair cast_count e fish_caught_all_time
    try {
      const accountData = result?.value?.data;
      if (!accountData || !Array.isArray(accountData) || accountData.length < 1) {
        return;
      }

      const base64Data = accountData[0];
      const buffer = Buffer.from(base64Data, "base64");

      // Estrutura PlayerState (Anchor/Borsh):
      // discriminator: 8 bytes
      // owner: 32 bytes
      // rod_level: 1 byte
      // boat_tier: 1 byte
      // bump: 1 byte
      // cast_count: 8 bytes (u64 LE)  → offset 43
      // fish_caught_all_time: 8 bytes (u64 LE)  → offset 51
      const CAST_COUNT_OFFSET = 43;
      const FISH_CAUGHT_OFFSET = 51;

      if (buffer.length < FISH_CAUGHT_OFFSET + 8) return;

      const castCountNow = buffer.readBigUInt64LE(CAST_COUNT_OFFSET);
      const fishCaughtNow = buffer.readBigUInt64LE(FISH_CAUGHT_OFFSET);

      // Inicializa na primeira notificação (baseline)
      if (!this.stateInitialized) {
        this.lastKnownCastCount = castCountNow;
        this.lastKnownFishCaught = fishCaughtNow;
        this.stateInitialized = true;
        this.logger.debug(`Estado inicial via WS: castCount=${castCountNow}, fish=${Number(fishCaughtNow) / 1_000_000}`);
        return;
      }

      // Calcula deltas
      const castsDelta = Number(castCountNow - this.lastKnownCastCount);
      const fishDelta = fishCaughtNow - this.lastKnownFishCaught;

      // Se não houve novos casts, ignora (pode ser mudança de durability, etc.)
      if (castsDelta <= 0) {
        this.lastKnownFishCaught = fishCaughtNow;
        return;
      }

      // Quantos casts podemos processar da fila
      const castsToProcess = Math.min(castsDelta, this.pendingCasts.length);
      const fishAmount = Number(fishDelta) / 1_000_000;

      if (fishDelta > BigInt(0)) {
        this.logger.debug(`🐟 CATCH via WS! +${fishAmount.toFixed(3)} fish (${castsDelta} cast(s) processados)`);
      } else {
        this.logger.debug(`🔴 MISS via WS (${castsDelta} cast(s) processados)`);
      }

      // Processa os casts: 1 CATCH com o total + restante como MISS
      let catchReported = false;
      for (let i = 0; i < castsToProcess; i++) {
        if (this.onResultCallback) {
          if (fishDelta > BigInt(0) && !catchReported) {
            this.onResultCallback({ isCatch: true, fishAmount, confirmed: true });
            catchReported = true;
          } else {
            this.onResultCallback({ isCatch: false, confirmed: true });
          }
        }
      }

      // Remove casts processados (mais antigos primeiro)
      this.pendingCasts.splice(0, castsToProcess);

      // Atualiza estado
      this.lastKnownCastCount = castCountNow;
      this.lastKnownFishCaught = fishCaughtNow;

    } catch (error) {
      this.logger.debug(`Erro ao decodificar: ${error}`);
    }
  }
}
