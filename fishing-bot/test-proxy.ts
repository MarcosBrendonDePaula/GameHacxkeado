#!/usr/bin/env bun

/**
 * Script para testar se o proxy está funcionando
 */

import { createProxyAgent, setGlobalProxyAgent } from "./src/utils/proxy";
import { CUSTOM_HEADERS } from "./src/config/constants";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Uso: bun run test-proxy.ts <proxy-url>");
  console.log("Exemplo: bun run test-proxy.ts http://2.56.249.17:50100");
  process.exit(1);
}

const proxyUrl = args[0];

console.log("🧪 Testando conexão via proxy...\n");
console.log(`Proxy: ${proxyUrl}\n`);

// Configura o proxy global
setGlobalProxyAgent(proxyUrl);
const proxyAgent = createProxyAgent(proxyUrl);

// Teste 1: Verificar IP público
console.log("📍 Teste 1: Verificando IP público...");
try {
  const response = await fetch("https://api.ipify.org?format=json", {
    // @ts-ignore
    agent: proxyAgent,
    headers: CUSTOM_HEADERS,
  });

  const data = await response.json();
  console.log(`✅ IP detectado: ${data.ip}`);
  console.log(`   Esperado: 2.56.249.17 (se proxy estiver funcionando)\n`);
} catch (error: any) {
  console.log(`❌ Erro: ${error.message}\n`);
}

// Teste 2: Testar RPC do Fogo Fishing
console.log("📍 Teste 2: Testando RPC do Fogo Fishing...");
try {
  const rpcUrl = "https://eu.fogo.fluxrpc.com/?key=74a5f926-d7b0-4c72-9a5c-0eaec1a57781";

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      ...CUSTOM_HEADERS,
      "Content-Type": "application/json",
    },
    // @ts-ignore
    agent: proxyAgent,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getHealth",
    }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log(`✅ RPC respondeu: ${JSON.stringify(data)}\n`);
  } else {
    console.log(`⚠️  RPC retornou status ${response.status}\n`);
  }
} catch (error: any) {
  console.log(`❌ Erro: ${error.message}\n`);
}

// Teste 3: Testar Capability service
console.log("📍 Teste 3: Testando Capability service...");
try {
  const capUrl = "https://cast.fogofishing.com/capability";

  const response = await fetch(capUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // @ts-ignore
    agent: proxyAgent,
    body: JSON.stringify({
      wallet: "11111111111111111111111111111111",
      requested_modes: 3,
      program_id: "SEAyjT1FUx3JyXJnWt5NtjELDwuU9XsoZeZVPVvweU4",
    }),
  });

  console.log(`   Status: ${response.status}`);
  if (response.ok) {
    console.log(`✅ Capability service respondeu\n`);
  } else {
    const text = await response.text();
    console.log(`⚠️  Resposta: ${text.substring(0, 100)}...\n`);
  }
} catch (error: any) {
  console.log(`❌ Erro: ${error.message}\n`);
}

// Teste 4: Testar Paymaster
console.log("📍 Teste 4: Testando Paymaster...");
try {
  const paymasterUrl = "https://fogo-mainnet.dourolabs-paymaster.xyz/api/sponsor_pubkey?domain=https://fogofishing.com&index=autoassign";

  const response = await fetch(paymasterUrl, {
    headers: CUSTOM_HEADERS,
    // @ts-ignore
    agent: proxyAgent,
  });

  if (response.ok) {
    const sponsor = await response.text();
    console.log(`✅ Paymaster respondeu: ${sponsor.substring(0, 20)}...\n`);
  } else {
    console.log(`⚠️  Paymaster retornou status ${response.status}\n`);
  }
} catch (error: any) {
  console.log(`❌ Erro: ${error.message}\n`);
}

console.log("=".repeat(60));
console.log("✅ Testes concluídos!");
console.log("\nSe o IP detectado for 2.56.249.17, o proxy está funcionando corretamente.");
console.log("Se for outro IP, o proxy NÃO está sendo usado.");
