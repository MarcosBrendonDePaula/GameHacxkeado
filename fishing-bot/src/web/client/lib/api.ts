/**
 * Utilitário de API com autenticação por assinatura de wallet
 *
 * Cada request é assinada pela wallet conectada.
 * Headers enviados:
 * - x-wallet-pubkey: Public key da wallet em Base58
 * - x-signature: Assinatura da mensagem em Base64
 * - x-nonce: Timestamp + random para prevenir replay
 */

/**
 * Converte Uint8Array para Base64 (funciona no browser)
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

/**
 * Converte Base64 para Uint8Array (funciona no browser)
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * SHA-256 síncrono usando TextEncoder (fallback simples)
 */
function sha256Sync(data: string): string {
  // Implementação simples de sha256 para uso síncrono no frontend
  // Baseado em: https://geraintluff.github.io/sha256/
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";

  const words: number[] = [];
  const asciiBitLength = data.length * 8;

  let hash = (sha256Sync as any).h = (sha256Sync as any).h || [];
  let k = (sha256Sync as any).k = (sha256Sync as any).k || [];
  let primeCounter = k.length;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  data += "\x80";
  while ((data.length % 64) - 56) data += "\x00";
  for (let i = 0; i < data.length; i++) {
    const j = data.charCodeAt(i);
    if (j >> 8) return ""; // ASCII check
    words[i >> 2] = (words[i >> 2] ?? 0) | (j << (((3 - i) % 4) * 8));
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;

      const s0 =
        rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 =
        rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const temp1 =
        (hash[7] ?? 0) +
        (rightRotate(hash[4] ?? 0, 6) ^
          rightRotate(hash[4] ?? 0, 11) ^
          rightRotate(hash[4] ?? 0, 25)) +
        (((hash[4] ?? 0) & (hash[5] ?? 0)) ^ (~(hash[4] ?? 0) & (hash[6] ?? 0))) +
        (k[i] ?? 0) +
        (w[i] =
          i < 16
            ? (w[i] ?? 0)
            : ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) | 0);
      const temp2 =
        (rightRotate(hash[0] ?? 0, 2) ^
          rightRotate(hash[0] ?? 0, 13) ^
          rightRotate(hash[0] ?? 0, 22)) +
        (((hash[0] ?? 0) & (hash[1] ?? 0)) ^
          ((hash[0] ?? 0) & (hash[2] ?? 0)) ^
          ((hash[1] ?? 0) & (hash[2] ?? 0)));

      hash = [(temp1 + temp2) | 0].concat(hash) as any;
      hash[4] = ((hash[4] ?? 0) + temp1) | 0;
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = ((hash[i] ?? 0) + (oldHash[i] ?? 0)) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = ((hash[i] ?? 0) >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

// Tipo para o adaptador de sessão
interface SessionAdapter {
  walletPubkey: { toBase58(): string };  // Wallet original (owner)
  sessionPubkey: { toBase58(): string }; // Session key (signer)
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

let currentSession: SessionAdapter | null = null;

/**
 * Define a sessão atual para ser usada nas requests
 */
export function setWallet(session: SessionAdapter | null) {
  currentSession = session;
}

/**
 * Gera um nonce único baseado em timestamp + random
 */
function generateNonce(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Cria a mensagem a ser assinada
 * Formato: METHOD:PATH:NONCE:BODY_HASH
 */
function createSignableMessage(
  method: string,
  path: string,
  nonce: string,
  body?: string
): string {
  const bodyHash = body ? sha256Sync(body) : "";
  return `${method}:${path}:${nonce}:${bodyHash}`;
}

/**
 * Opções para a request
 */
interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  requiresAuth?: boolean;
}

/**
 * Faz uma request autenticada para a API
 */
export async function apiRequest<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, requiresAuth = true } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const bodyString = body ? JSON.stringify(body) : undefined;

  // Se requer autenticação, assina a request
  if (requiresAuth) {
    if (!currentSession) {
      throw new Error("Sessão não conectada");
    }

    // Remove query string do path para assinatura (backend verifica apenas o path)
    const pathWithoutQuery = path.split("?")[0] ?? path;

    const nonce = generateNonce();
    const message = createSignableMessage(method, pathWithoutQuery, nonce, bodyString);
    const messageBytes = new TextEncoder().encode(message);

    // Assina a mensagem com a session key
    const signature = await currentSession.signMessage(messageBytes);
    const signatureBase64 = uint8ArrayToBase64(signature);

    headers["x-wallet-pubkey"] = currentSession.walletPubkey.toBase58();
    headers["x-session-pubkey"] = currentSession.sessionPubkey.toBase58();
    headers["x-signature"] = signatureBase64;
    headers["x-nonce"] = nonce;
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: bodyString,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================
// Funções de API tipadas
// ============================================

/**
 * Stats globais (não requer auth)
 */
export async function getGlobalStats() {
  return apiRequest("/stats/global", { requiresAuth: false });
}

/**
 * Obtém dados da conta e bot do usuário
 */
export async function getMe() {
  return apiRequest<{
    account: { walletPubkey: string; name: string; createdAt: Date };
    bot: any | null;
  }>("/me");
}

/**
 * Obtém info do bot
 */
export async function getBot() {
  return apiRequest<{
    exists: boolean;
    bot?: any;
    isRunning?: boolean;
    stats?: any;
    automationState?: {
      currentRepairThreshold: number;
      currentWaitThreshold: number;
      durabilityPauseUntil: number | null;
      durabilityPauseRemainingMs: number;
      isDurabilityPauseActive: boolean;
    } | null;
  }>("/bot");
}

/**
 * Cria ou atualiza o bot
 */
export async function upsertBot(params: {
  sessionSecretKey: string;
  sessionPublicKey: string;
  delayMin?: number;
  delayMax?: number;
  proxy?: string;
}) {
  return apiRequest<{ success: boolean; error?: string }>("/bot", {
    method: "POST",
    body: params,
  });
}

/**
 * Atualiza configurações do bot
 */
export async function updateBotConfig(params: {
  delayMin?: number;
  delayMax?: number;
  proxy?: string;
  autoRepair?: boolean;
  autoRepairMin?: number;
  autoRepairMax?: number;
  autoRepairWaitMinMinutes?: number;
  autoRepairWaitMaxMinutes?: number;
  autoWaitDurability?: boolean;
  autoWaitDurabilityMin?: number;
  autoWaitDurabilityMax?: number;
  autoWaitMinutesMin?: number;
  autoWaitMinutesMax?: number;
  autoUpgrade?: boolean;
  autoRestartMinutes?: number;
  autoBuyBait?: boolean;
  autoBuyBaitIds?: string;
  autoUseBaitId?: number;
  autoBuyBaitThreshold?: number;
  autoBuyBaitThresholds?: string;
  autoUseBaitOrder?: string;
  autoBuyBaitQty?: string;
}) {
  const result = await apiRequest<{ success: boolean; error?: string }>("/bot", {
    method: "PATCH",
    body: params,
  });

  if (!result.success) {
    throw new Error(result.error || "Erro ao atualizar configuracao do bot");
  }

  return result;
}

/**
 * Remove o bot
 */
export async function deleteBot() {
  return apiRequest<{ success: boolean; error?: string }>("/bot", {
    method: "DELETE",
  });
}

/**
 * Inicia o bot
 */
export async function startBot() {
  return apiRequest<{ success: boolean; error?: string }>("/bot/start", {
    method: "POST",
  });
}

/**
 * Para o bot
 */
export async function stopBot() {
  return apiRequest<{ success: boolean; error?: string }>("/bot/stop", {
    method: "POST",
  });
}

/**
 * Resorteia threshold de espera por durabilidade
 */
export async function reshuffleWaitThreshold() {
  return apiRequest<{ success: boolean; newThreshold?: number; error?: string }>("/bot/reshuffle-wait", {
    method: "POST",
  });
}

/**
 * Obtém resultados do bot
 */
export async function getResults(params?: { limit?: number; offset?: number }) {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const queryString = query.toString();
  return apiRequest(`/results${queryString ? `?${queryString}` : ""}`);
}

/**
 * Obtém histórico do bot
 */
export async function getHistory(params?: { limit?: number }) {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));

  const queryString = query.toString();
  return apiRequest(`/history${queryString ? `?${queryString}` : ""}`);
}

/**
 * Obtém analytics estatísticos do bot.
 */
export async function getAnalytics() {
  return apiRequest<{
    sampledCatches: number;
    sampledMisses: number;
    sampledTotalFish: number;
    windows: Array<{
      key: '5m' | '15m' | '1h' | '24h';
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
    fishTypes: Array<{
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
      status: 'normal' | 'attention' | 'late' | 'insufficient_data';
    }>;
  }>("/analytics");
}

/**
 * Obtém logs do bot
 */
export async function getLogs(params?: {
  limit?: number;
  offset?: number;
  level?: string;
}) {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.level) query.set("level", params.level);

  const queryString = query.toString();
  return apiRequest(`/logs${queryString ? `?${queryString}` : ""}`);
}

/**
 * Obtém Config e GlobalState do programa on-chain (não requer auth)
 */
export async function getGameConfig() {
  return apiRequest<{
    config: {
      authority: string;
      issuerPubkey: string;
      requireCapabilityForCatch: boolean;
      requireCapabilityForSpend: boolean;
      requireFeeForInit: boolean;
      softGateMode: boolean;
      basicCooldownMs: number;
    } | null;
    globalState: {
      authority: string;
      fishMint: string;
      fogoMint: string;
      fogoTreasury: string;
      fishBurnVault: string;
      currentDifficulty: string;
      totalNetworkPower: string;
      lastDifficultyAdjustment: string;
      baseEmissionRate: string;
      emissionDecayRate: string;
      dailyTargetEmission: string;
      totalFogoCollected: string;
      totalFishMinted: string;
      totalUnprocessedFish: string;
      accumulatedProcessingFees: string;
      feesPerUnprocessedFish: string;
      halvingCount: number;
      yieldGateActive: number;
      gamePaused: number;
    } | null;
  }>("/game-config", { requiresAuth: false });
}

/**
 * Inicia upgrade da vara
 */
export async function startUpgrade(targetLevel: number) {
  return apiRequest<{ success: boolean; error?: string }>("/bot/upgrade/start", {
    method: "POST",
    body: { targetLevel },
  });
}

/**
 * Finaliza upgrade da vara
 */
export async function finishUpgrade() {
  return apiRequest<{ success: boolean; error?: string }>("/bot/upgrade/finish", {
    method: "POST",
  });
}

/**
 * Obtém balances da wallet (FOGO, FISH, USDC) - público
 */
export async function getWalletBalances(walletPubkey: string) {
  return apiRequest<{
    fogo: number;
    fish: number;
    usdc: number;
    error?: string;
  }>(`/wallet/${walletPubkey}/balances`, { requiresAuth: false });
}

/**
 * Obtém configuração de baits on-chain (não requer auth)
 */
export async function getBaitConfig() {
  return apiRequest<{
    baits: Array<{
      unlockLevel: number;
      castsPerUnit: number;
      fishCostAtRefDifficulty: string;
      usdcFee: string;
    }>;
    difficultyRef: string;
    isActive: boolean;
    error?: string;
  }>("/bait/config", { requiresAuth: false });
}

/**
 * Obtém inventário de baits do player (não requer auth)
 */
export async function getBaitInventory(walletPubkey: string) {
  return apiRequest<{
    exists: boolean;
    inventory: {
      owner: string;
      activeBait: number;
      remainingCasts: number[];
    } | null;
    error?: string;
  }>(`/bait/inventory/${walletPubkey}`, { requiresAuth: false });
}

/**
 * Compra bait manualmente
 */
export async function buyBait(baitType: number, quantity: number = 1) {
  return apiRequest<{ success: boolean; error?: string }>("/bot/bait/buy", {
    method: "POST",
    body: { baitType, quantity },
  });
}

/**
 * Equipa bait manualmente (0 = remover bait)
 */
export async function equipBait(baitType: number) {
  return apiRequest<{ success: boolean; error?: string }>("/bot/bait/equip", {
    method: "POST",
    body: { baitType },
  });
}

/**
 * Dados do monitoring dashboard (público, sem auth)
 */
export async function getMonitoring() {
  return apiRequest<{
    activeBots: number;
    pausedBots: number;
    offlineBots: number;
    totalCatches: number;
    totalMisses: number;
    totalFish: number;
    castsPerSecond: number;
    cpuPercent: number;
    memoryMB: number;
    uptimeSeconds: number;
    bots: Array<{
      wallet: string;
      status: "online" | "paused" | "offline";
      catches: number;
      misses: number;
      fish: number;
      uptime: string;
      durability: number;
      rodLevel: number;
      pendingCasts: number;
    }>;
    hourlyHistory: Array<{
      hour: string;
      activeBots: number;
      castsPerMinute: number;
      totalFish: number;
    }>;
    recentMetrics: Array<{
      timestamp: number;
      activeBots: number;
      castsPerSecond: number;
      cpuPercent: number;
      memoryMB: number;
    }>;
  }>("/monitoring", { requiresAuth: false });
}

/**
 * Obtém dados do player diretamente da blockchain (não requer auth)
 */
export async function getPlayerState(walletPubkey: string) {
  return apiRequest<{
    exists: boolean;
    player?: {
      rodLevel: number;
      boatTier: number;
      power: string;
      currentDurability: number;
      maxDurability: number;
      durabilityPercent: number;
      castCount: string;
      fishCaughtAllTime: string;
      unprocessedFish: string;
      supercastRemainingCasts: number;
      upgradeInProgress: boolean;
      upgradeTargetLevel: number;
      upgradeCastsAtStart: string;
    };
    error?: string;
  }>(`/player/${walletPubkey}`, { requiresAuth: false });
}

