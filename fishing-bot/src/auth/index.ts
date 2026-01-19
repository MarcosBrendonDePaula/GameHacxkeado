import { db, accounts } from "../db";
import { eq } from "drizzle-orm";
import * as ed from "@noble/ed25519";
import { createHash } from "crypto";

// Configura o ed25519 para usar sha512
// @ts-ignore - necessário para versões mais novas do @noble/ed25519
ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const hash = createHash("sha512");
  for (const msg of m) {
    hash.update(msg);
  }
  return new Uint8Array(hash.digest());
};

// Armazena nonces usados (em memória, com TTL)
// Formato: nonce -> timestamp de quando foi usado
const usedNonces = new Map<string, number>();

// Limpa nonces antigos a cada 5 minutos
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [nonce, timestamp] of usedNonces) {
    if (now - timestamp > NONCE_TTL_MS) {
      usedNonces.delete(nonce);
    }
  }
}, 60 * 1000); // Limpa a cada minuto

// Decodifica Base58 (Solana/Bitcoin style)
function decodeBase58(str: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const ALPHABET_MAP: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) {
    ALPHABET_MAP[ALPHABET[i]] = i;
  }

  const bytes: number[] = [0];
  for (const char of str) {
    const value = ALPHABET_MAP[char];
    if (value === undefined) {
      throw new Error(`Invalid Base58 character: ${char}`);
    }

    let carry: number = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += (bytes[j] ?? 0) * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Conta leading zeros
  let leadingZeros = 0;
  for (const char of str) {
    if (char === "1") {
      leadingZeros++;
    } else {
      break;
    }
  }

  // Adiciona zeros à esquerda
  const result = new Uint8Array(leadingZeros + bytes.length);
  result.fill(0, 0, leadingZeros);
  for (let i = 0; i < bytes.length; i++) {
    result[leadingZeros + i] = bytes[bytes.length - 1 - i]!;
  }

  return result;
}

// Codifica para Base58
export function encodeBase58(bytes: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += (digits[j] ?? 0) << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  // Conta leading zeros
  let leadingZeros = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      leadingZeros++;
    } else {
      break;
    }
  }

  // Constrói resultado
  let result = "1".repeat(leadingZeros);
  for (let i = digits.length - 1; i >= 0; i--) {
    result += ALPHABET[digits[i]!];
  }

  return result;
}

// Verifica assinatura Ed25519
export async function verifySignature(
  message: string | Uint8Array,
  signatureBase64: string,
  publicKeyBase58: string
): Promise<boolean> {
  try {
    // Decodifica a public key de Base58
    const publicKeyBytes = decodeBase58(publicKeyBase58);
    console.log(`   [SIG] PubKey bytes: ${publicKeyBytes.length} (esperado: 32)`);

    // Decodifica a assinatura de Base64
    const signatureBytes = Buffer.from(signatureBase64, "base64");
    console.log(`   [SIG] Signature bytes: ${signatureBytes.length} (esperado: 64)`);

    // Converte a mensagem para bytes se necessário
    const messageBytes = typeof message === "string"
      ? new TextEncoder().encode(message)
      : message;
    console.log(`   [SIG] Message bytes: ${messageBytes.length}`);

    // Verifica a assinatura
    const result = await ed.verifyAsync(signatureBytes, messageBytes, publicKeyBytes);
    console.log(`   [SIG] Resultado: ${result}`);
    return result;
  } catch (error) {
    console.error("   [SIG] Erro ao verificar assinatura:", error);
    return false;
  }
}

// Hash SHA256
export function sha256(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = Bun.CryptoHasher.hash("sha256", bytes);
  return Buffer.from(hash).toString("hex");
}

/**
 * Cria a mensagem a ser assinada para uma request
 * Formato: METHOD:PATH:NONCE:BODY_HASH
 */
export function createSignableMessage(
  method: string,
  path: string,
  nonce: string,
  body?: string
): string {
  const bodyHash = body ? sha256(body) : "";
  console.log(`   [MSG] method=${method} path=${path} nonce=${nonce}`);
  console.log(`   [MSG] body=${body ? body.slice(0, 100) + "..." : "(vazio)"}`);
  console.log(`   [MSG] bodyHash=${bodyHash.slice(0, 16)}...`);
  const message = `${method}:${path}:${nonce}:${bodyHash}`;
  console.log(`   [MSG] mensagem final=${message.slice(0, 80)}...`);
  return message;
}

/**
 * Resultado da verificação de request
 */
export interface VerifyRequestResult {
  valid: boolean;
  walletPubkey?: string;
  error?: string;
}

/**
 * Headers esperados em cada request autenticada
 */
export interface AuthHeaders {
  "x-wallet-pubkey": string;   // Public key da wallet (owner) em Base58
  "x-session-pubkey": string;  // Public key da session (signer) em Base58
  "x-signature": string;       // Assinatura em Base64
  "x-nonce": string;           // Nonce único (timestamp + random)
}

/**
 * Verifica uma request assinada
 *
 * @param method - HTTP method (GET, POST, etc)
 * @param path - Path da request (ex: /api/bot)
 * @param headers - Headers com wallet, session, signature e nonce
 * @param body - Body da request (se houver)
 */
export async function verifySignedRequest(
  method: string,
  path: string,
  headers: Partial<AuthHeaders>,
  body?: string
): Promise<VerifyRequestResult> {
  const walletPubkey = headers["x-wallet-pubkey"];
  const sessionPubkey = headers["x-session-pubkey"];
  const signature = headers["x-signature"];
  const nonce = headers["x-nonce"];

  // Verifica se todos os headers estão presentes
  if (!walletPubkey) {
    return { valid: false, error: "Header x-wallet-pubkey ausente" };
  }
  if (!sessionPubkey) {
    return { valid: false, error: "Header x-session-pubkey ausente" };
  }
  if (!signature) {
    return { valid: false, error: "Header x-signature ausente" };
  }
  if (!nonce) {
    return { valid: false, error: "Header x-nonce ausente" };
  }

  // Verifica se o nonce já foi usado (previne replay attacks)
  if (usedNonces.has(nonce)) {
    return { valid: false, error: "Nonce já utilizado" };
  }

  // Verifica se o nonce não é muito antigo (baseado em timestamp)
  // Formato do nonce: timestamp-random
  const nonceParts = nonce.split("-");
  if (nonceParts.length >= 1) {
    const nonceTimestamp = parseInt(nonceParts[0], 10);
    const now = Date.now();

    // Nonce não pode ser mais antigo que 5 minutos
    if (now - nonceTimestamp > NONCE_TTL_MS) {
      return { valid: false, error: "Nonce expirado" };
    }

    // Nonce não pode ser no futuro (margem de 30 segundos)
    if (nonceTimestamp > now + 30000) {
      return { valid: false, error: "Nonce no futuro" };
    }
  }

  // Cria a mensagem que deveria ter sido assinada
  const message = createSignableMessage(method, path, nonce, body);
  console.log(`   [VERIFY] Mensagem: ${message.slice(0, 80)}...`);

  // Verifica a assinatura usando a SESSION pubkey (não a wallet)
  // A session key foi autorizada pela wallet para agir em seu nome
  const isValid = await verifySignature(message, signature, sessionPubkey);
  console.log(`   [VERIFY] Assinatura valida: ${isValid}`);

  if (!isValid) {
    return { valid: false, error: "Assinatura invalida" };
  }

  // Marca o nonce como usado
  usedNonces.set(nonce, Date.now());

  // Retorna a wallet pubkey (owner) para identificar a conta
  return { valid: true, walletPubkey };
}

/**
 * Garante que a conta existe no banco de dados
 */
export async function ensureAccountExists(walletPubkey: string): Promise<void> {
  const existing = await db
    .select()
    .from(accounts)
    .where(eq(accounts.walletPubkey, walletPubkey))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(accounts).values({
      walletPubkey,
      name: `Wallet ${walletPubkey.slice(0, 8)}...`,
    });
  } else {
    // Atualiza último acesso
    await db
      .update(accounts)
      .set({ lastLoginAt: new Date() })
      .where(eq(accounts.walletPubkey, walletPubkey));
  }
}

/**
 * Mensagem para criptografia E2E das session keys
 * O cliente assina essa mensagem e usa a assinatura para derivar a chave de criptografia
 */
export const ENCRYPTION_MESSAGE = (walletPubkey: string) =>
  `Fogo Fishing Encryption Key\nWallet: ${walletPubkey}\nV1`;
