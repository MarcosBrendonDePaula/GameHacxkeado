#!/usr/bin/env bun

/**
 * Script para testar um único cast e verificar o resultado
 */

import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { FishingService } from "./src/services/fishing";
import { BOT_CONFIG } from "./src/config/constants";
import { setGlobalProxyAgent } from "./src/utils/proxy";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Uso: bun run test-cast-result.ts <caminho-para-keypair.json> [--proxy <url>]");
  process.exit(1);
}

const keypairPath = path.resolve(args[0]);
const secretKeyString = fs.readFileSync(keypairPath, "utf-8");
const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
const keypair = Keypair.fromSecretKey(secretKey);

// Parse proxy se fornecido
let proxyUrl = BOT_CONFIG.proxy_url;
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--proxy" && args[i + 1]) {
    proxyUrl = args[i + 1];
    i++;
  }
}

console.log("🧪 Testando cast único com verificação de resultado...\n");

// Configura proxy se fornecido
if (proxyUrl) {
  console.log(`🌐 Usando proxy: ${proxyUrl}\n`);
  setGlobalProxyAgent(proxyUrl);
}

const fishingService = new FishingService(keypair, BOT_CONFIG.rpc_endpoint, proxyUrl);

// Busca estado antes
console.log("📊 Buscando estado do jogador...");
const playerStateBefore = await fishingService.fetchPlayerState();

if (!playerStateBefore) {
  console.log("❌ Não foi possível buscar o estado do jogador.");
  process.exit(1);
}

const fishCaughtBefore = playerStateBefore.fishCaughtAllTime;
console.log(`Fish caught all time: ${fishCaughtBefore}\n`);

// Faz um único cast
console.log("🎣 Fazendo cast...");
const signature = await fishingService.castLine(false);

if (signature) {
  console.log(`✅ Cast enviado! Signature: ${signature}\n`);

  console.log("🔍 Verificando resultado...");
  const result = await fishingService.checkCastResult(signature, fishCaughtBefore);

  if (result !== null) {
    if (result.isCatch) {
      if (result.fishAmount) {
        console.log(`🐟 CATCH! Você pescou +${result.fishAmount.toLocaleString()} fish!`);
      } else {
        console.log("🐟 CATCH! Você pescou algo!");
      }
    } else {
      console.log("🔴 MISS. Não pescou nada desta vez.");
    }
  } else {
    console.log("⚠️ Não foi possível determinar o resultado.");
  }
} else {
  console.log("❌ Falha ao fazer o cast.");
}
