#!/usr/bin/env bun

import { Keypair } from "@solana/web3.js";
import { FishingService } from "./services/fishing";
import { Logger } from "./utils/helpers";
import { BOT_CONFIG } from "./config/constants";
import { setGlobalProxyAgent } from "./utils/proxy";
import * as fs from "fs";
import * as path from "path";

const logger = new Logger("🎮 BOT");

/**
 * Carrega keypair de um arquivo JSON
 */
function loadKeypairFromFile(filePath: string): Keypair {
  try {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Arquivo não encontrado: ${absolutePath}`);
    }

    const secretKeyString = fs.readFileSync(absolutePath, "utf-8");
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
  } catch (error: any) {
    logger.error(`Erro ao carregar keypair de ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Função principal
 */
async function main() {
  logger.info("=".repeat(60));
  logger.info("🎣 FOGO FISHING BOT - Versão 1.0");
  logger.info("=".repeat(60));

  // Verifica argumentos
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Uso: bun run src/index.ts <caminho-para-keypair.json> [opcoes]

Opções:
  --delay <ms>        Delay entre casts em milissegundos (padrão: ${BOT_CONFIG.autocast_delay})
  --rpc <url>         URL do RPC endpoint (padrão: ${BOT_CONFIG.rpc_endpoint})
  --proxy <url>       URL do proxy (ex: http://host:port, socks5://host:port)
  --help, -h          Mostra esta mensagem

Variáveis de Ambiente:
  PROXY_URL           URL do proxy (alternativa ao --proxy)

Exemplo:
  bun run src/index.ts ./wallet.json --delay 1000
  bun run src/index.ts ./wallet.json --proxy http://127.0.0.1:8080
  bun run src/index.ts ./wallet.json --proxy socks5://user:pass@proxy.com:1080
  PROXY_URL=http://127.0.0.1:8080 bun run src/index.ts ./wallet.json
    `);
    process.exit(0);
  }

  const keypairPath = args[0];
  if (!keypairPath) {
    throw new Error("Caminho da keypair não informado");
  }

  // Parse opções
  let delay = BOT_CONFIG.autocast_delay;
  let rpcEndpoint: string = BOT_CONFIG.rpc_endpoint;
  let proxyUrl = BOT_CONFIG.proxy_url;

  for (let i = 1; i < args.length; i++) {
    const currentArg = args[i];
    const nextArg = args[i + 1];
    if (currentArg === "--delay" && nextArg) {
      delay = parseInt(nextArg);
      i++;
    } else if (currentArg === "--rpc" && nextArg) {
      rpcEndpoint = nextArg;
      i++;
    } else if (currentArg === "--proxy" && nextArg) {
      proxyUrl = nextArg;
      i++;
    }
  }

  logger.info(`📁 Carregando keypair de: ${keypairPath}`);
  const walletKeypair = loadKeypairFromFile(keypairPath);

  logger.info(`👛 Wallet: ${walletKeypair.publicKey.toBase58()}`);
  logger.info(`🌐 RPC: ${rpcEndpoint}`);
  logger.info(`⏱️  Auto-cast delay: ${delay}ms`);

  // Configura proxy se fornecido
  if (proxyUrl) {
    logger.info(`🌐 Proxy: ${proxyUrl}`);
    setGlobalProxyAgent(proxyUrl);
  }

  logger.info("=".repeat(60));

  // Cria serviço de fishing
  const fishingService = new FishingService(walletKeypair, rpcEndpoint, proxyUrl);

  // Busca e exibe estado inicial
  logger.info("📊 Buscando estado do jogo...");

  const globalState = await fishingService.fetchGlobalState();
  if (globalState) {
    logger.info(`🌍 Dificuldade: ${globalState.currentDifficulty}`);
    logger.info(`🐟 Total FISH mintado: ${globalState.totalFishMinted}`);
  }

  const playerState = await fishingService.fetchPlayerState();
  if (!playerState) {
    logger.error("❌ Conta de jogador não encontrada!");
    logger.error("Você precisa inicializar sua conta no jogo primeiro.");
    logger.error("Acesse o jogo no navegador e crie sua conta.");
    process.exit(1);
  }

  logger.info(`\n👤 Estado do Jogador:`);
  logger.info(`   🎣 Rod Level: ${playerState.rodLevel}`);
  logger.info(`   ⛵ Boat Tier: ${playerState.boatTier}`);
  logger.info(`   ⚡ Power: ${playerState.power}`);
  logger.info(`   🔧 Durability: ${playerState.currentDurability}/${playerState.maxDurability}`);
  logger.info(`   📊 Casts totais: ${playerState.castCount}`);
  logger.info(`   🐟 Peixes pescados: ${playerState.fishCaughtAllTime}`);

  if (playerState.currentDurability === 0) {
    logger.warn("⚠️  AVISO: Durabilidade está em 0! Você precisa reparar sua vara.");
    logger.warn("O bot vai tentar fazer casts, mas provavelmente vai falhar.");
  }

  logger.info("\n=".repeat(60));
  logger.info("🚀 Iniciando bot...");
  logger.info("Pressione Ctrl+C para parar");
  logger.info("=".repeat(60));

  // Inicia o auto-cast
  await fishingService.startAutoCast(delay);
}

// Inicia o bot
main().catch((error) => {
  logger.error("Erro fatal:", error);
  process.exit(1);
});
