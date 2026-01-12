import { Transaction, PublicKey } from "@solana/web3.js";
import { PAYMASTER_URL, PAYMASTER_DOMAIN, CUSTOM_HEADERS } from "../config/constants";
import { Logger } from "./helpers";
import { getGlobalProxyAgent } from "./proxy";

const defaultLogger = new Logger("💰 PAYMASTER");

interface PaymasterResponse {
  signature?: string;
  type?: string;
  error?: string;
  message?: string;
}

// Cache do sponsor
let cachedSponsor: PublicKey | null = null;

/**
 * Busca o sponsor pubkey do paymaster
 */
export async function getSponsor(logger: Logger = defaultLogger): Promise<PublicKey> {
  if (cachedSponsor) {
    return cachedSponsor;
  }

  try {
    // Extrai a base URL do paymaster
    const paymasterBaseUrl = PAYMASTER_URL.split("/api/")[0];
    const url = `${paymasterBaseUrl}/api/sponsor_pubkey?domain=${encodeURIComponent(PAYMASTER_DOMAIN)}&index=autoassign`;

    logger.debug(`Buscando sponsor de ${url}...`);

    const proxyAgent = getGlobalProxyAgent();
    const fetchOptions: any = {
      headers: CUSTOM_HEADERS,
    };

    // Adiciona proxy agent se configurado
    if (proxyAgent) {
      fetchOptions.agent = proxyAgent;
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`Failed to get sponsor: ${response.status} ${await response.text()}`);
    }

    const sponsorText = await response.text();
    const sponsor = new PublicKey(sponsorText.trim().replace(/"/g, ""));

    logger.success(`✅ Sponsor obtido: ${sponsor.toBase58()}`);
    cachedSponsor = sponsor;

    return sponsor;
  } catch (error: any) {
    logger.error("Erro ao buscar sponsor:", error.message);
    throw error;
  }
}

/**
 * Envia uma transação através do paymaster (que paga as taxas)
 */
export async function sendTransactionViaPaymaster(
  transaction: Transaction,
  feePayer: PublicKey,
  logger: Logger = defaultLogger
): Promise<string> {
  try {
    // Serializa a transação em base64
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64Transaction = serialized.toString("base64");

    logger.debug("Enviando transação via paymaster...");
    logger.debug(`Tamanho da tx: ${base64Transaction.length} chars`);

    // Monta a URL com o domain parameter
    const url = `${PAYMASTER_URL}?domain=${encodeURIComponent(PAYMASTER_DOMAIN)}`;

    const proxyAgent = getGlobalProxyAgent();
    const fetchOptions: any = {
      method: "POST",
      headers: {
        ...CUSTOM_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: base64Transaction,
      }),
    };

    // Adiciona proxy agent se configurado
    if (proxyAgent) {
      fetchOptions.agent = proxyAgent;
    }

    // Envia para o paymaster
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Paymaster error ${response.status}: ${errorText}`);
      throw new Error(`Paymaster failed: ${response.status} - ${errorText}`);
    }

    const result: PaymasterResponse = await response.json();

    if (result.error) {
      logger.error(`Paymaster error: ${result.error}`);
      throw new Error(`Paymaster error: ${result.error}`);
    }

    if (!result.signature) {
      logger.error("Paymaster não retornou signature");
      throw new Error("No signature returned from paymaster");
    }

    logger.success(`✅ Transação enviada via paymaster! Sig: ${result.signature.slice(0, 12)}...`);
    return result.signature;

  } catch (error: any) {
    logger.error("Erro ao enviar via paymaster:", error.message);
    throw error;
  }
}
