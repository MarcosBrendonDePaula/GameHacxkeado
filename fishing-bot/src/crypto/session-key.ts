/**
 * Criptografia E2E para Session Keys
 *
 * Fluxo:
 * 1. Cliente assina mensagem fixa com a wallet
 * 2. Deriva chave AES-256 do SHA-256 da assinatura
 * 3. Criptografa session key com AES-GCM
 * 4. Servidor armazena apenas dados criptografados
 * 5. Para descriptografar, cliente envia a mesma assinatura na request
 *
 * Resultado: Nem o desenvolvedor consegue ler as session keys!
 */

import { ENCRYPTION_MESSAGE } from "../auth";

/**
 * Mensagem que o cliente deve assinar para derivar a chave de criptografia
 */
export { ENCRYPTION_MESSAGE };

/**
 * Deriva uma chave AES-256 a partir da assinatura da wallet
 * A assinatura é usada como entropia para gerar a chave
 */
export async function deriveKeyFromSignature(signatureBase64: string): Promise<CryptoKey> {
  const signatureBytes = Buffer.from(signatureBase64, "base64");

  // Hash SHA-256 da assinatura para obter 32 bytes (256 bits)
  const hash = Bun.CryptoHasher.hash("sha256", signatureBytes);

  // Importa como chave AES-GCM
  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Resultado da criptografia
 */
export interface EncryptedData {
  encrypted: Buffer;  // Dados criptografados
  iv: Buffer;         // IV usado (12 bytes)
}

/**
 * Criptografa a session key usando AES-256-GCM
 *
 * @param sessionKeyBytes - Session key em bytes (geralmente 64 bytes para Ed25519)
 * @param encryptionSignature - Assinatura da mensagem ENCRYPTION_MESSAGE em Base64
 */
export async function encryptSessionKey(
  sessionKeyBytes: Uint8Array,
  encryptionSignature: string
): Promise<EncryptedData> {
  // Deriva chave da assinatura
  const key = await deriveKeyFromSignature(encryptionSignature);

  // Gera IV aleatório (12 bytes é o tamanho recomendado para GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Criptografa
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    sessionKeyBytes
  );

  return {
    encrypted: Buffer.from(encrypted),
    iv: Buffer.from(iv),
  };
}

/**
 * Descriptografa a session key usando AES-256-GCM
 *
 * @param encryptedData - Dados criptografados
 * @param iv - IV usado na criptografia
 * @param encryptionSignature - Mesma assinatura usada para criptografar
 */
export async function decryptSessionKey(
  encryptedData: Buffer | Uint8Array,
  iv: Buffer | Uint8Array,
  encryptionSignature: string
): Promise<Uint8Array> {
  // Deriva chave da assinatura
  const key = await deriveKeyFromSignature(encryptionSignature);

  // Descriptografa
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedData
  );

  return new Uint8Array(decrypted);
}

/**
 * Valida se a assinatura pode descriptografar os dados
 * Útil para verificar se o usuário está usando a assinatura correta
 */
export async function validateEncryptionSignature(
  encryptedData: Buffer | Uint8Array,
  iv: Buffer | Uint8Array,
  encryptionSignature: string
): Promise<boolean> {
  try {
    await decryptSessionKey(encryptedData, iv, encryptionSignature);
    return true;
  } catch {
    return false;
  }
}

/**
 * Converte session key de Base64 para Uint8Array
 */
export function sessionKeyFromBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

/**
 * Converte session key de Uint8Array para Base64
 */
export function sessionKeyToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
