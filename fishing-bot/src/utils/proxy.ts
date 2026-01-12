import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { Logger } from "./helpers";

const logger = new Logger("🌐 PROXY");

// Proxy agent global (compartilhado entre todos os serviços)
let globalProxyAgent: any = undefined;

/**
 * Cria um agente de proxy baseado na URL fornecida
 */
export function createProxyAgent(proxyUrl: string): any {
  if (!proxyUrl || proxyUrl.trim() === "") {
    return undefined;
  }

  try {
    const url = new URL(proxyUrl);

    // Detecta o tipo de proxy pela URL
    if (url.protocol === "socks:" || url.protocol === "socks5:" || url.protocol === "socks4:") {
      logger.info(`Usando SOCKS proxy: ${url.hostname}:${url.port}`);
      return new SocksProxyAgent(proxyUrl);
    } else if (url.protocol === "http:" || url.protocol === "https:") {
      logger.info(`Usando HTTP(S) proxy: ${url.hostname}:${url.port}`);
      return new HttpsProxyAgent(proxyUrl);
    } else {
      logger.warn(`Protocolo de proxy desconhecido: ${url.protocol}`);
      return undefined;
    }
  } catch (error: any) {
    logger.error(`Erro ao criar proxy agent: ${error.message}`);
    return undefined;
  }
}

/**
 * Define o proxy agent global
 */
export function setGlobalProxyAgent(proxyUrl: string) {
  globalProxyAgent = createProxyAgent(proxyUrl);
}

/**
 * Obtém o proxy agent global
 */
export function getGlobalProxyAgent(): any {
  return globalProxyAgent;
}

/**
 * Cria uma função fetch customizada que usa proxy se configurado
 */
export function createProxyFetch(proxyUrl: string) {
  const agent = createProxyAgent(proxyUrl);

  if (!agent) {
    // Se não há proxy, retorna fetch normal
    return fetch;
  }

  // Retorna função fetch que usa o proxy agent
  return (url: string | URL | Request, options?: RequestInit) => {
    const opts = { ...options };

    // Adiciona o agent nas opções
    // @ts-ignore - agent não está nos tipos padrão mas funciona
    opts.agent = agent;

    return fetch(url, opts);
  };
}
