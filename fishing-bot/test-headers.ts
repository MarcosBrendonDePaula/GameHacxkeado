#!/usr/bin/env bun

/**
 * Script de teste para verificar se os headers customizados estão funcionando
 */

import { CUSTOM_HEADERS, BOT_CONFIG } from "./src/config/constants";

async function testHeaders() {
  console.log("🧪 Testando headers customizados...\n");

  console.log("📋 Headers que serão enviados:");
  console.log(JSON.stringify(CUSTOM_HEADERS, null, 2));
  console.log("\n" + "=".repeat(60) + "\n");

  console.log("🌐 RPC Endpoint:", BOT_CONFIG.rpc_endpoint);
  console.log("\n" + "=".repeat(60) + "\n");

  // Cria função fetch customizada
  const customFetch = (url: string, options: any) => {
    const headers = {
      ...CUSTOM_HEADERS,
      "content-type": "application/json",
      ...(options?.headers || {}),
    };

    console.log("📤 Fazendo requisição com headers customizados...");
    return fetch(url, {
      ...options,
      headers,
    });
  };

  // Testa uma requisição simples
  try {
    const testRequest = {
      method: "getHealth",
      jsonrpc: "2.0",
      id: "test-" + Date.now(),
    };

    console.log("📨 Payload de teste:", JSON.stringify(testRequest, null, 2));
    console.log("\n" + "=".repeat(60) + "\n");

    const response = await customFetch(BOT_CONFIG.rpc_endpoint, {
      method: "POST",
      body: JSON.stringify(testRequest),
    });

    console.log("✅ Status da resposta:", response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log("📥 Resposta:", JSON.stringify(data, null, 2));
      console.log("\n✅ Headers estão funcionando corretamente!");
    } else {
      const text = await response.text();
      console.log("❌ Erro na resposta:", text);
    }
  } catch (error: any) {
    console.error("❌ Erro ao testar headers:", error.message);
    console.error(error);
  }
}

// Executa o teste
testHeaders();
