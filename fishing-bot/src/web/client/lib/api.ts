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
    binary += String.fromCharCode(bytes[i]);
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
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
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
    const pathWithoutQuery = path.split("?")[0];

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
  }>("/bot");
}

/**
 * Cria ou atualiza o bot
 */
export async function upsertBot(params: {
  sessionSecretKey: string;
  sessionPublicKey: string;
  encryptionSignature: string;
  delay?: number;
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
export async function updateBotConfig(params: { delay?: number; proxy?: string; autoRestartMinutes?: number }) {
  return apiRequest<{ success: boolean; error?: string }>("/bot", {
    method: "PATCH",
    body: params,
  });
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
export async function startBot(encryptionSignature: string) {
  return apiRequest<{ success: boolean; error?: string }>("/bot/start", {
    method: "POST",
    body: { encryptionSignature },
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
    };
    error?: string;
  }>(`/player/${walletPubkey}`, { requiresAuth: false });
}

// ============================================
// Mensagem de criptografia E2E
// ============================================

/**
 * Mensagem que deve ser assinada para criptografar/descriptografar session keys
 */
export const ENCRYPTION_MESSAGE = (walletPubkey: string) =>
  `Fogo Fishing Encryption Key\nWallet: ${walletPubkey}\nV1`;

/**
 * Obtém a assinatura de criptografia da sessão
 */
export async function getEncryptionSignature(): Promise<string> {
  if (!currentSession) {
    throw new Error("Sessão não conectada");
  }

  const message = ENCRYPTION_MESSAGE(currentSession.walletPubkey.toBase58());
  const messageBytes = new TextEncoder().encode(message);
  const signature = await currentSession.signMessage(messageBytes);

  return uint8ArrayToBase64(signature);
}
