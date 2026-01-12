import { PublicKey, Ed25519Program, TransactionInstruction } from "@solana/web3.js";
import { PROGRAM_ID } from "../config/constants";
import { Logger } from "./helpers";
import { getGlobalProxyAgent } from "./proxy";

const logger = new Logger("🔐 CAPABILITY");

// URL do serviço de capabilities
const CAPABILITY_URL = "https://cast.fogofishing.com/capability";

// Valores dummy caso o serviço não esteja disponível
const DUMMY_PUBKEY = new PublicKey("ERxRhiM28Nu73JCT8m7HTCTT3xpgenMcWu387zJWuXku");
const DUMMY_MESSAGE = new Uint8Array(89);
const DUMMY_SIGNATURE = new Uint8Array([
  21, 242, 124, 59, 32, 142, 80, 16, 227, 38, 36, 109, 182, 204, 209, 64, 145, 110, 251, 81, 204, 62, 59, 225, 37,
  51, 239, 59, 144, 58, 122, 145, 69, 190, 85, 51, 46, 10, 125, 192, 242, 180, 227, 176, 95, 119, 139, 72, 151,
  11, 223, 39, 101, 88, 7, 146, 115, 84, 120, 133, 55, 165, 182, 5,
]);

const CAPABILITY_TTL_SECONDS = 300; // 5 minutos
const CAPABILITY_REFRESH_FRACTION = 0.8; // Renova quando tiver 20% do tempo restante

interface CapabilityResponse {
  capability: {
    wallet: string;
    mode: number;
    expires_at: number;
    program_id: string;
  };
  message_b64: string;
  signature_b64: string;
  issuer_pubkey: string;
}

interface CachedCapability {
  response: CapabilityResponse;
  fetchedAt: number;
  expiresAt: number;
}

// Cache de capabilities
const capabilityCache = new Map<string, CachedCapability>();
const pendingFetches = new Map<string, Promise<CapabilityResponse | null>>();

/**
 * Busca uma capability do servidor
 */
async function fetchCapability(wallet: string): Promise<CapabilityResponse | null> {
  try {
    logger.debug(`Buscando capability para ${wallet.slice(0, 8)}...`);

    const proxyAgent = getGlobalProxyAgent();
    const fetchOptions: any = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: wallet,
        requested_modes: 3, // CAP_MODE_CATCH | CAP_MODE_SPEND
        program_id: PROGRAM_ID.toBase58(),
      }),
    };

    // Adiciona proxy agent se configurado
    if (proxyAgent) {
      fetchOptions.agent = proxyAgent;
    }

    const response = await fetch(CAPABILITY_URL, fetchOptions);

    if (!response.ok) {
      const text = await response.text();
      logger.warn(`Capability fetch falhou: ${response.status} - ${text}`);
      return null;
    }

    const data = await response.json();
    const expiresIn = data.capability.expires_at - Math.floor(Date.now() / 1000);
    logger.debug(`✅ Capability obtida, expira em ${expiresIn}s`);

    return data;
  } catch (error: any) {
    logger.error("Erro ao buscar capability:", error.message);
    return null;
  }
}

/**
 * Obtém uma capability do cache ou busca uma nova
 */
async function getCapability(wallet: string): Promise<CapabilityResponse | null> {
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  // Verifica cache
  const cached = capabilityCache.get(wallet);
  if (cached) {
    const refreshThreshold = cached.fetchedAt + CAPABILITY_TTL_SECONDS * CAPABILITY_REFRESH_FRACTION * 1000;

    // Se ainda é válido e não precisa renovar
    if (nowSec < cached.expiresAt - 5) {
      // Se passou do threshold de renovação, faz refresh em background
      if (now > refreshThreshold && !pendingFetches.has(wallet)) {
        logger.debug(`🔄 Background refresh para ${wallet.slice(0, 8)}...`);
        const promise = fetchCapability(wallet).then((resp) => {
          pendingFetches.delete(wallet);
          if (resp) {
            capabilityCache.set(wallet, {
              response: resp,
              fetchedAt: Date.now(),
              expiresAt: resp.capability.expires_at,
            });
          }
          return resp;
        });
        pendingFetches.set(wallet, promise);
      }
      return cached.response;
    }
  }

  // Verifica se já tem um fetch pendente
  const pending = pendingFetches.get(wallet);
  if (pending) {
    return pending;
  }

  // Faz novo fetch
  const promise = fetchCapability(wallet).then((resp) => {
    pendingFetches.delete(wallet);
    if (resp) {
      capabilityCache.set(wallet, {
        response: resp,
        fetchedAt: Date.now(),
        expiresAt: resp.capability.expires_at,
      });
    }
    return resp;
  });

  pendingFetches.set(wallet, promise);
  return promise;
}

/**
 * Cria a instrução de capability para incluir na transação
 */
export async function createCapabilityInstruction(
  walletPublicKey: PublicKey
): Promise<TransactionInstruction> {
  const walletB58 = walletPublicKey.toBase58();
  const capability = await getCapability(walletB58);

  if (capability) {
    const issuerPubkey = new PublicKey(capability.issuer_pubkey);
    const message = Buffer.from(capability.message_b64, "base64");
    const signature = Buffer.from(capability.signature_b64, "base64");

    logger.debug("✅ Usando capability válida");

    return Ed25519Program.createInstructionWithPublicKey({
      publicKey: issuerPubkey.toBytes(),
      message: new Uint8Array(message),
      signature: new Uint8Array(signature),
    });
  }

  // Fallback para capability dummy
  logger.warn("⚠️  Usando capability dummy (serviço indisponível)");

  return Ed25519Program.createInstructionWithPublicKey({
    publicKey: DUMMY_PUBKEY.toBytes(),
    message: DUMMY_MESSAGE,
    signature: DUMMY_SIGNATURE,
  });
}
