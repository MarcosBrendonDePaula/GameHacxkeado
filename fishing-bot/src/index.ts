#!/usr/bin/env bun

/**
 * Multi-Bot Runner
 * Executa múltiplos bots simultaneamente, cada um com sua própria configuração
 */

import { Keypair } from "@solana/web3.js";
import { FishingService } from "./services/fishing";
import { Logger } from "./utils/helpers";
import { BOT_CONFIG } from "./config/constants";
import * as fs from "fs";
import * as path from "path";

const logger = new Logger("🎮 MULTI-BOT");

interface AccountConfig {
  name: string;
  enabled: boolean;
  keypair_path: string;
  proxy?: string;
  delay?: number;
}

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
    throw new Error(`Erro ao carregar keypair de ${filePath}: ${error.message}`);
  }
}

/**
 * Executa um bot individual
 */
async function runBot(config: AccountConfig, index: number) {
  // Cria arquivo de log único para este bot
  const sanitizedName = config.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const logFile = path.join("logs", `bot-${index + 1}-${sanitizedName}.log`);

  const botLogger = new Logger(`🤖 BOT-${index + 1} [${config.name}]`, logFile);

  try {
    botLogger.info("Iniciando...");
    botLogger.info(`📝 Log sendo gravado em: ${logFile}`);

    // Carrega keypair
    const keypair = loadKeypairFromFile(config.keypair_path);
    const wallet = keypair.publicKey.toBase58();
    botLogger.info(`Wallet: ${wallet.slice(0, 8)}...${wallet.slice(-6)}`);

    // Configura proxy se fornecido (cada bot tem seu próprio proxy isolado)
    const proxyUrl = config.proxy;
    if (proxyUrl) {
      botLogger.info(`Proxy: ${proxyUrl}`);
    }

    // Delay personalizado ou padrão
    const delay = config.delay || BOT_CONFIG.autocast_delay;
    botLogger.info(`Delay: ${delay}ms`);

    // Cria serviço de fishing com proxy específico desta conta
    // IMPORTANTE: Cada bot recebe seu próprio proxyAgent isolado
    // NÃO usamos variáveis de ambiente pois elas são globais ao processo!
    const botId = `BOT-${index + 1} [${config.name}]`;
    const fishingService = new FishingService(
      keypair,
      BOT_CONFIG.rpc_endpoint,
      proxyUrl,
      botId,
      logFile
    );

    // Verifica estado do jogador
    const playerState = await fishingService.fetchPlayerState();
    if (!playerState) {
      botLogger.error("Conta de jogador não encontrada!");
      botLogger.error("Inicialize a conta no jogo antes de usar o bot.");
      return;
    }

    botLogger.info(`Rod Level: ${playerState.rodLevel} | Power: ${playerState.power}`);
    botLogger.info(`Durability: ${playerState.currentDurability}/${playerState.maxDurability}`);

    if (playerState.currentDurability === 0) {
      botLogger.warn("⚠️  Durabilidade em 0! Precisa reparar a vara.");
    }

    // Inicia auto-cast
    botLogger.info("🚀 Auto-cast iniciado!");
    await fishingService.startAutoCast(delay);

  } catch (error: any) {
    botLogger.error(`Erro fatal: ${error.message}`);
    botLogger.error("Bot será encerrado.");
  }
}

/**
 * Função principal
 */
async function main() {
  console.log("=".repeat(80));
  console.log("🎣 FOGO FISHING MULTI-BOT - Sistema de Múltiplas Contas");
  console.log("=".repeat(80));

  // Verifica argumentos
  const args = process.argv.slice(2);
  const configFile = args[0] || "accounts.json";

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Uso: bun run src/multi-bot.ts [arquivo-config.json]

Argumentos:
  arquivo-config.json   Arquivo de configuração das contas (padrão: accounts.json)
  --help, -h           Mostra esta mensagem

Exemplo:
  bun run src/multi-bot.ts accounts.json
  bun run src/multi-bot.ts my-accounts.json

Formato do arquivo de configuração:
  [
    {
      "name": "Conta 1",
      "enabled": true,
      "keypair_path": "./wallets/wallet1.json",
      "proxy": "http://2.56.249.17:50100",
      "delay": 500
    },
    {
      "name": "Conta 2",
      "enabled": false,
      "keypair_path": "./wallets/wallet2.json"
    }
  ]

Campos:
  - name: Nome descritivo da conta
  - enabled: true/false - se o bot deve rodar
  - keypair_path: Caminho para o arquivo JSON da keypair
  - proxy: (opcional) URL do proxy para esta conta
  - delay: (opcional) Delay entre casts em ms (padrão: 500)
    `);
    process.exit(0);
  }

  logger.info(`📁 Carregando configuração de: ${configFile}`);

  // Carrega arquivo de configuração
  const configPath = path.resolve(configFile);
  if (!fs.existsSync(configPath)) {
    logger.error(`❌ Arquivo de configuração não encontrado: ${configPath}`);
    logger.error(`Crie um arquivo ${configFile} baseado em accounts.example.json`);
    process.exit(1);
  }

  let accounts: AccountConfig[];
  try {
    const configContent = fs.readFileSync(configPath, "utf-8");
    accounts = JSON.parse(configContent);
  } catch (error: any) {
    logger.error(`❌ Erro ao ler arquivo de configuração: ${error.message}`);
    process.exit(1);
  }

  // Filtra contas habilitadas
  const enabledAccounts = accounts.filter((acc) => acc.enabled);

  if (enabledAccounts.length === 0) {
    logger.error("❌ Nenhuma conta habilitada no arquivo de configuração!");
    logger.error("Defina 'enabled: true' em pelo menos uma conta.");
    process.exit(1);
  }

  logger.info(`✅ ${enabledAccounts.length} conta(s) habilitada(s) de ${accounts.length} total`);
  console.log("=".repeat(80));

  // Lista as contas que serão executadas
  enabledAccounts.forEach((acc, i) => {
    console.log(`${i + 1}. ${acc.name}`);
    console.log(`   Keypair: ${acc.keypair_path}`);
    if (acc.proxy) {
      console.log(`   Proxy: ${acc.proxy}`);
    }
    console.log(`   Delay: ${acc.delay || BOT_CONFIG.autocast_delay}ms`);
    console.log();
  });

  console.log("=".repeat(80));
  logger.info("🚀 Iniciando todos os bots...");
  logger.info("Pressione Ctrl+C para parar todos");
  console.log("=".repeat(80));
  console.log();

  // Executa todos os bots em paralelo
  const botPromises = enabledAccounts.map((account, index) =>
    runBot(account, index)
  );

  // Aguarda todos os bots
  await Promise.allSettled(botPromises);

  logger.info("Todos os bots finalizaram.");
}

// Tratamento de sinais para encerramento gracioso
process.on("SIGINT", () => {
  logger.info("\n\n🛑 Recebido sinal de interrupção (Ctrl+C)");
  logger.info("Encerrando todos os bots...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("\n\n🛑 Recebido sinal de término");
  logger.info("Encerrando todos os bots...");
  process.exit(0);
});

// Inicia o multi-bot
main().catch((error) => {
  logger.error("Erro fatal:", error);
  process.exit(1);
});
