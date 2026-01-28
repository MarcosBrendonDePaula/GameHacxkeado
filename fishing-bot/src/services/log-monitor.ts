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
  fishCaughtBefore: string;
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
  private lastKnownFishCaught: string = "0";

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
  registerCast(signature: string, fishCaughtBefore: string) {
    this.ensureConnection();

    this.pendingCasts.push({
      signature,
      fishCaughtBefore,
      timestamp: Date.now()
    });

    // Atualiza o último valor conhecido se for maior
    if (BigInt(fishCaughtBefore) > BigInt(this.lastKnownFishCaught)) {
      this.lastKnownFishCaught = fishCaughtBefore;
    }
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
    if (this.disposed) return false;

    // Se está conectado ou conectando, está saudável
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return true;
    }

    // Se tem um timer de reconexão agendado, ainda está saudável (vai tentar reconectar)
    if (this.reconnectTimer) {
      return true;
    }

    // Caso contrário, está morto
    return false;
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

    this.logger.debug(`Conectando websocket em ${this.wsEndpoint}...`);
    this.ws = new WebSocket(this.wsEndpoint, options);
    this.isSubscribed = false;

    this.ws.on("open", () => {
      this.reconnectAttempts = 0; // Reseta contador ao conectar com sucesso
      this.logger.debug("Websocket conectado");
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
      this.logger.warn(`Erro no websocket: ${(error as Error).message}`);
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
    if (this.pendingCasts.length === 0) return;

    // Decodifica para extrair fishCaughtAllTime
    try {
      const accountData = result?.value?.data;
      if (!accountData || !Array.isArray(accountData) || accountData.length < 1) {
        return;
      }

      const base64Data = accountData[0];
      const buffer = Buffer.from(base64Data, "base64");

      // Estrutura PlayerState (Anchor/Borsh - sem padding):
      // discriminator: 8 bytes
      // owner: 32 bytes
      // rod_level: 1 byte
      // boat_tier: 1 byte
      // bump: 1 byte
      // cast_count: 8 bytes
      // fish_caught_all_time: 8 bytes
      // Offset = 8 + 32 + 1 + 1 + 1 + 8 = 51
      const FISH_CAUGHT_OFFSET = 51;

      if (buffer.length >= FISH_CAUGHT_OFFSET + 8) {
        const fishCaughtNow = buffer.readBigUInt64LE(FISH_CAUGHT_OFFSET);
        const fishCaughtNowStr = fishCaughtNow.toString();

        // Processa todos os pendentes que têm fish menor que o atual
        const toProcess = this.pendingCasts.filter(p =>
          BigInt(p.fishCaughtBefore) < fishCaughtNow
        );

        if (toProcess.length > 0) {
          // Calcula diferença baseada no último conhecido
          const lastKnown = BigInt(this.lastKnownFishCaught);

          if (fishCaughtNow > lastKnown) {
            const diff = fishCaughtNow - lastKnown;
            const fishAmount = Number(diff) / 1_000_000;

            this.logger.debug(`🐟 CATCH via WS! +${fishAmount.toFixed(3)} fish (${toProcess.length} cast(s))`);

            // Notifica cada cast como CATCH
            for (const cast of toProcess) {
              if (this.onResultCallback) {
                this.onResultCallback({
                  isCatch: true,
                  fishAmount: fishAmount / toProcess.length, // Divide entre os casts
                  confirmed: true
                });
              }
            }
          }

          // Remove os processados
          this.pendingCasts = this.pendingCasts.filter(p => !toProcess.includes(p));
          this.lastKnownFishCaught = fishCaughtNowStr;
        } else {
          // Conta mudou mas fish não aumentou em relação aos pendentes = MISS
          const oldestPending = this.pendingCasts[0];
          if (oldestPending && BigInt(oldestPending.fishCaughtBefore) >= fishCaughtNow) {
            this.logger.debug(`🔴 MISS via WS`);

            if (this.onResultCallback) {
              this.onResultCallback({ isCatch: false, confirmed: true });
            }

            // Remove o mais antigo
            this.pendingCasts.shift();
          }
        }
      }
    } catch (error) {
      this.logger.debug(`Erro ao decodificar: ${error}`);
    }
  }
}
