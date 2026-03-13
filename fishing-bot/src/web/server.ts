import { Elysia } from "elysia";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import "../db/migrate";
import { botManager } from "./bot-manager-db";
import { verifySignedRequest, ensureAccountExists, type AuthHeaders } from "../auth";
import { db, accounts } from "../db";
import { eq } from "drizzle-orm";
import { getPlayerReader } from "../services/player-reader";

// Detecta se está rodando como executável compilado ou em Docker
const entryArg = Bun.argv[0] ?? "";
const exeName = path.basename(entryArg).toLowerCase();
const isExecutable =
  import.meta.path.includes("~BUN") ||
  (exeName.endsWith(".exe") && !exeName.includes("bun")) ||
  process.env.FISHING_BOT_PROD === "1";

// APP_DIR permite override para Docker, senão usa diretório do exe
const appDir = process.env.APP_DIR || path.dirname(entryArg || process.cwd());

// Caminhos dependem do modo
const distClientPath = isExecutable
  ? path.join(appDir, "dist", "client")
  : path.join(import.meta.dir, "../../dist/client");

console.log(`🔧 Modo: ${isExecutable ? "Produção (Executável)" : "Desenvolvimento (Vite)"}`);
console.log(`📂 App dir: ${appDir}`);
console.log(`📂 Client path: ${distClientPath}`);

// ============================================
// API Pública (sem autenticação)
// ============================================
const publicApi = new Elysia({ prefix: "/api" })
  // Stats globais
  .get("/stats/global", async () => {
    return botManager.getGlobalStats();
  })

  // Proxy RPC para contornar CORS
  .post("/rpc", async ({ body }) => {
    try {
      const response = await fetch(
        "https://eu.fogo.fluxrpc.com/?key=74a5f926-d7b0-4c72-9a5c-0eaec1a57781",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://app.fogofishing.com",
            Referer: "https://app.fogofishing.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          body: JSON.stringify(body),
        }
      );
      return response.json();
    } catch (error: any) {
      console.error("❌ Erro no proxy RPC:", error);
      return { error: error.message };
    }
  })

  // Proxy Paymaster
  .get("/sponsor_pubkey", async ({ request }) => {
    const url = new URL(request.url);
    const targetUrl = `https://fogo-mainnet.dourolabs-paymaster.xyz/api/sponsor_pubkey${url.search}`;
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          Origin: "https://app.fogofishing.com",
          Referer: "https://app.fogofishing.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      return new Response(await response.text(), {
        status: response.status,
        headers: { "Content-Type": "text/plain" },
      });
    } catch (error: any) {
      return new Response(error.message, { status: 500 });
    }
  })

  .post("/sponsor_and_send", async ({ request }) => {
    const url = new URL(request.url);
    const targetUrl = `https://fogo-mainnet.dourolabs-paymaster.xyz/api/sponsor_and_send${url.search}`;
    try {
      const body = await request.text();
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://app.fogofishing.com",
          Referer: "https://app.fogofishing.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body,
      });
      return response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  })

  .get("/fee", async ({ request }) => {
    const url = new URL(request.url);
    const targetUrl = `https://fogo-mainnet.dourolabs-paymaster.xyz/api/fee${url.search}`;
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          Origin: "https://app.fogofishing.com",
          Referer: "https://app.fogofishing.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      return new Response(await response.text(), {
        status: response.status,
        headers: { "Content-Type": "text/plain" },
      });
    } catch (error: any) {
      return new Response(error.message, { status: 500 });
    }
  })

  // Monitoring dashboard (público, sem auth)
  .get("/monitoring", async () => {
    return botManager.getMonitoringData();
  })

  // Busca Config e GlobalState do programa on-chain (público)
  .get("/game-config", async () => {
    try {
      const reader = getPlayerReader();
      const [config, globalState] = await Promise.all([
        reader.fetchConfig(),
        reader.fetchGlobalState(),
      ]);

      return { config, globalState };
    } catch (error: any) {
      console.error("Erro ao buscar game config:", error);
      return { error: error.message };
    }
  })

  // Busca balances da wallet (FOGO, FISH, USDC) - público
  .get("/wallet/:wallet/balances", async ({ params }) => {
    try {
      const playerReader = getPlayerReader();
      const balances = await playerReader.fetchWalletBalances(params.wallet);
      if (!balances) {
        return { error: "Não foi possível buscar balances" };
      }
      return balances;
    } catch (error: any) {
      console.error("Erro ao buscar balances:", error);
      return { error: error.message };
    }
  })

  // Busca configuração de baits on-chain (público)
  .get("/bait/config", async () => {
    try {
      const reader = getPlayerReader();
      const config = await reader.fetchRiverFishConfig();
      if (!config) {
        return { error: "Não foi possível buscar configuração de baits" };
      }
      return config;
    } catch (error: any) {
      console.error("Erro ao buscar bait config:", error);
      return { error: error.message };
    }
  })

  // Busca inventário de baits do player (público)
  .get("/bait/inventory/:wallet", async ({ params }) => {
    try {
      const reader = getPlayerReader();
      const state = await reader.fetchRiverFishState(params.wallet);
      if (!state) {
        return { exists: false, inventory: null };
      }
      return { exists: true, inventory: state };
    } catch (error: any) {
      console.error("Erro ao buscar bait inventory:", error);
      return { error: error.message };
    }
  })

  // Busca dados do player diretamente da blockchain (público)
  .get("/player/:wallet", async ({ params }) => {
    try {
      const playerReader = getPlayerReader();
      const playerState = await playerReader.fetchPlayerState(params.wallet);

      if (!playerState) {
        return { exists: false, error: "Player não encontrado na blockchain" };
      }

      return {
        exists: true,
        player: {
          rodLevel: playerState.rodLevel,
          boatTier: playerState.boatTier,
          power: playerState.power,
          currentDurability: playerState.currentDurability,
          maxDurability: playerState.maxDurability,
          durabilityPercent: Math.round((playerState.currentDurability / playerState.maxDurability) * 100),
          castCount: playerState.castCount,
          fishCaughtAllTime: playerState.fishCaughtAllTime,
          unprocessedFish: playerState.unprocessedFish,
          supercastRemainingCasts: playerState.supercastRemainingCasts,
          upgradeInProgress: playerState.upgradeInProgress,
          upgradeTargetLevel: playerState.upgradeTargetLevel,
          upgradeCastsAtStart: playerState.upgradeCastsAtStart,
        },
      };
    } catch (error: any) {
      console.error("Erro ao buscar player:", error);
      return { exists: false, error: error.message };
    }
  });

// ============================================
// API Autenticada (requer assinatura da wallet)
// ============================================
const protectedApi = new Elysia({ prefix: "/api" })
  // Derive: anexa dados de auth ao request
  .derive(async ({ request, path }) => {
    // Remove o prefixo /api do path para corresponder ao que o frontend assina
    const signedPath = path.replace(/^\/api/, "");
    console.log(`\n📥 [AUTH] ${request.method} ${path} (signed as ${signedPath})`);

    // Extrai headers de autenticação
    const headers: Partial<AuthHeaders> = {
      "x-wallet-pubkey": request.headers.get("x-wallet-pubkey") || undefined,
      "x-session-pubkey": request.headers.get("x-session-pubkey") || undefined,
      "x-signature": request.headers.get("x-signature") || undefined,
      "x-nonce": request.headers.get("x-nonce") || undefined,
    };

    console.log(`   Wallet: ${headers["x-wallet-pubkey"]?.slice(0, 8) || "N/A"}...`);
    console.log(`   Session: ${headers["x-session-pubkey"]?.slice(0, 8) || "N/A"}...`);
    console.log(`   Nonce: ${headers["x-nonce"] || "N/A"}`);
    console.log(`   Signature: ${headers["x-signature"] ? "presente" : "ausente"}`);

    // Lê o body se existir (para incluir no hash da assinatura)
    // Usa __originalBody que foi armazenado antes de passar para o Elysia
    let body: string | undefined;
    if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
      body = (request as any).__originalBody || undefined;
      console.log(`   Body: ${body ? body.slice(0, 80) + "..." : "vazio"}`);
    }

    // Verifica a assinatura (usando signedPath sem o prefixo /api)
    const result = await verifySignedRequest(request.method, signedPath, headers, body);

    if (!result.valid) {
      console.log(`   ❌ Auth falhou: ${result.error}`);
      // Anexa ao request para o guard verificar
      (request as any).__authError = result.error;
      return { walletPubkey: null as string | null };
    }

    // Garante que a conta existe no banco
    await ensureAccountExists(result.walletPubkey!);

    console.log(`   ✅ Auth OK: ${result.walletPubkey?.slice(0, 8)}...`);
    return { walletPubkey: result.walletPubkey as string };
  })
  // Guard: bloqueia se não autenticado
  .onBeforeHandle(({ walletPubkey, request, set }) => {
    if (!walletPubkey) {
      set.status = 401;
      const error = (request as any).__authError || "Assinatura invalida ou ausente";
      console.log(`   🚫 Bloqueado: ${error}`);
      return {
        error: "Nao autorizado",
        message: error,
      };
    }
  })

  // Dados da conta
  .get("/me", async ({ walletPubkey }) => {
    const account = await db
      .select()
      .from(accounts)
      .where(eq(accounts.walletPubkey, walletPubkey!))
      .limit(1);

    if (account.length === 0) {
      return { error: "Conta nao encontrada" };
    }

    const bot = await botManager.getBot(walletPubkey!);
    const isRunning = botManager.isRunning(walletPubkey!);

    return {
      account: account[0],
      bot: bot
        ? {
            ...bot,
            // Não expor session key na API
            sessionSecretKey: undefined,
            isRunning,
          }
        : null,
    };
  })

  // Obtém info do bot
  .get("/bot", async ({ walletPubkey }) => {
    const bot = await botManager.getBot(walletPubkey!);
    if (!bot) {
      return { exists: false };
    }

    const isRunning = botManager.isRunning(walletPubkey!);
    // Stats em tempo real quando rodando
    const stats = isRunning ? botManager.getBotStats(walletPubkey!) : null;
    const automationState = isRunning ? botManager.getBotAutomationState(walletPubkey!) : null;

    return {
      exists: true,
      bot: {
        sessionPubkey: bot.sessionPubkey,
        delayMin: bot.delayMin,
        delayMax: bot.delayMax,
        proxy: bot.proxy,
        autoRepair: bot.autoRepair,
        autoRepairMin: bot.autoRepairMin,
        autoRepairMax: bot.autoRepairMax,
        autoWaitDurability: bot.autoWaitDurability,
        autoWaitDurabilityMin: bot.autoWaitDurabilityMin,
        autoWaitDurabilityMax: bot.autoWaitDurabilityMax,
        autoWaitMinutesMin: bot.autoWaitMinutesMin,
        autoWaitMinutesMax: bot.autoWaitMinutesMax,
        autoUpgrade: bot.autoUpgrade,
        autoRestartMinutes: bot.autoRestartMinutes,
        autoBuyBait: bot.autoBuyBait,
        autoBuyBaitIds: bot.autoBuyBaitIds,
        autoUseBaitId: bot.autoUseBaitId,
        autoBuyBaitThreshold: bot.autoBuyBaitThreshold,
        autoUseBaitOrder: bot.autoUseBaitOrder,
        autoBuyBaitQty: bot.autoBuyBaitQty,
        enabled: bot.enabled,
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt,
      },
      isRunning,
      stats,
      automationState,
    };
  })

  // Cria ou atualiza bot
  // Body: { sessionSecretKey, sessionPublicKey, delayMin?, delayMax?, proxy? }
  .post("/bot", async ({ walletPubkey, body }) => {
    const { sessionSecretKey, sessionPublicKey, delayMin, delayMax, proxy } =
      body as any;

    if (!sessionSecretKey || !sessionPublicKey) {
      return {
        success: false,
        error: "Campos obrigatórios: sessionSecretKey, sessionPublicKey",
      };
    }

    const result = await botManager.upsertBot({
      walletPubkey: walletPubkey!,
      sessionSecretKey,
      sessionPublicKey,
      delayMin,
      delayMax,
      proxy,
    });

    return result;
  })

  // Atualiza configurações do bot
  .patch("/bot", async ({ walletPubkey, body }) => {
    const { delayMin, delayMax, proxy, autoRepair, autoRepairMin, autoRepairMax, autoRepairWaitMinMinutes, autoRepairWaitMaxMinutes, autoWaitDurability, autoWaitDurabilityMin, autoWaitDurabilityMax, autoWaitMinutesMin, autoWaitMinutesMax, autoUpgrade, autoRestartMinutes,
      autoBuyBait, autoBuyBaitIds, autoUseBaitId, autoBuyBaitThreshold, autoBuyBaitThresholds, autoUseBaitOrder, autoBuyBaitQty } = body as any;

    const result = await botManager.updateBotConfig(walletPubkey!, {
      delayMin,
      delayMax,
      proxy,
      autoRepair,
      autoRepairMin,
      autoRepairMax,
      autoRepairWaitMinMinutes,
      autoRepairWaitMaxMinutes,
      autoWaitDurability,
      autoWaitDurabilityMin,
      autoWaitDurabilityMax,
      autoWaitMinutesMin,
      autoWaitMinutesMax,
      autoUpgrade,
      autoRestartMinutes,
      autoBuyBait,
      autoBuyBaitIds,
      autoUseBaitId,
      autoBuyBaitThreshold,
      autoBuyBaitThresholds,
      autoUseBaitOrder,
      autoBuyBaitQty,
    });

    return result;
  })

  // Remove bot
  .delete("/bot", async ({ walletPubkey }) => {
    return botManager.removeBot(walletPubkey!);
  })

  // Inicia bot
  .post("/bot/start", async ({ walletPubkey }) => {
    return botManager.startBot(walletPubkey!);
  })

  // Para bot
  .post("/bot/stop", async ({ walletPubkey }) => {
    return botManager.stopBot(walletPubkey!);
  })

  // Inicia upgrade da vara
  .post("/bot/upgrade/start", async ({ walletPubkey, body }) => {
    const { targetLevel } = body as any;
    if (!targetLevel || targetLevel < 2 || targetLevel > 60) {
      return { success: false, error: "targetLevel inválido (2-60)" };
    }
    return botManager.startUpgrade(walletPubkey!, targetLevel);
  })

  // Finaliza upgrade da vara
  .post("/bot/upgrade/finish", async ({ walletPubkey }) => {
    return botManager.finishUpgrade(walletPubkey!);
  })

  // Compra bait manualmente
  .post("/bot/bait/buy", async ({ walletPubkey, body }) => {
    const { baitType, quantity } = body as any;
    if (!baitType || baitType < 1 || baitType > 10) {
      return { success: false, error: "baitType inválido (1-10)" };
    }
    const qty = quantity || 1;
    if (qty < 1 || qty > 100) {
      return { success: false, error: "quantity inválido (1-100)" };
    }
    return botManager.buyBait(walletPubkey!, baitType, qty);
  })

  // Equipa bait manualmente
  .post("/bot/bait/equip", async ({ walletPubkey, body }) => {
    const { baitType } = body as any;
    if (baitType === undefined || baitType < 0 || baitType > 10) {
      return { success: false, error: "baitType inválido (0-10, 0=nenhuma)" };
    }
    return botManager.equipBait(walletPubkey!, baitType);
  })

  // Resultados do bot
  .get("/results", async ({ walletPubkey, query }) => {
    const limit = query.limit ? parseInt(query.limit as string) : 50;
    const offset = query.offset ? parseInt(query.offset as string) : 0;

    return botManager.getResults(walletPubkey!, { limit, offset });
  })

  // Histórico do bot
  .get("/history", async ({ walletPubkey, query }) => {
    const limit = query.limit ? parseInt(query.limit as string) : 100;

    const history = await botManager.getHistory(walletPubkey!, { limit });
    return { history };
  })

  // Analytics do bot
  .get("/analytics", async ({ walletPubkey }) => {
    return botManager.getAnalytics(walletPubkey!);
  })

  // Logs do bot
  .get("/logs", async ({ walletPubkey, query }) => {
    const limit = query.limit ? parseInt(query.limit as string) : 50;
    const offset = query.offset ? parseInt(query.offset as string) : 0;
    const level = query.level as string | undefined;
    const category = query.category as string | undefined;

    return botManager.getLogs(walletPubkey!, { limit, offset, level, category });
  });

// Combina APIs
const api = new Elysia()
  .use(publicApi)
  .use(protectedApi);

// MIME types para arquivos estáticos
const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// Função para servir arquivos estáticos
function serveStatic(req: any, res: any, urlPath: string) {
  const cleanPath = urlPath.split("?")[0] ?? "/";

  let filePath =
    cleanPath === "/" || !path.extname(cleanPath)
      ? path.join(distClientPath, "index.html")
      : path.join(distClientPath, cleanPath);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(distClientPath, "index.html");
  }

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}

// Função para iniciar o servidor
async function startServer() {
  let vite: any = null;

  if (!isExecutable) {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({
      root: path.join(import.meta.dir, "client"),
      server: { middlewareMode: true },
      appType: "spa",
    });
  }

  const server = createServer(async (req, res) => {
    const url = req.url || "/";

    // Se for rota da API, usa Elysia
    if (url.startsWith("/api")) {
      // Lê o body da requisição se existir
      let body: string | null = null;
      if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const bodyString = Buffer.concat(chunks).toString();
        console.log(`[SERVER] Body recebido: ${bodyString ? bodyString.slice(0, 100) : "(vazio)"}`);

        if (bodyString) {
          try {
            body = JSON.stringify(JSON.parse(bodyString));
          } catch {
            body = bodyString;
          }
        }
      }

      // Cria o Request com o body
      const request = new Request(`http://localhost${url}`, {
        method: req.method,
        headers: req.headers as any,
        body: body,
      });

      // Armazena o body original no request para o middleware acessar
      (request as any).__originalBody = body;

      const response = await api.handle(request);
      const responseBody = await response.text();

      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(responseBody);
      return;
    }

    // Frontend: Vite (dev) ou arquivos estáticos (prod)
    if (isExecutable) {
      serveStatic(req, res, url);
    } else {
      vite.middlewares(req, res);
    }
  });

  server.listen(3000, () => {
    console.log(`🚀 Dashboard rodando em http://localhost:3000`);
    console.log(`📡 API disponível em http://localhost:3000/api`);
    console.log(`🔐 Autenticação: Assinatura de wallet por request`);
    if (isExecutable) {
      console.log(`📦 Frontend servindo arquivos estáticos de: ${distClientPath}`);
    } else {
      console.log(`🎨 Frontend (Vite HMR) integrado no mesmo servidor`);
    }

    const cleanupDays = Number(process.env.DB_CLEANUP_DAYS || 3);
    const cleanupIntervalMinutes = Number(process.env.DB_CLEANUP_INTERVAL_MINUTES || 30);
    const cleanupLimits = {
      maxLogsPerWallet: Number(process.env.DB_MAX_LOGS_PER_WALLET || 6000),
      maxResultsPerWallet: Number(process.env.DB_MAX_RESULTS_PER_WALLET || 6000),
      maxHistoryPerWallet: Number(process.env.DB_MAX_HISTORY_PER_WALLET || 6000),
    };

    // Limpa por idade e também limita volume por wallet para impedir crescimento contínuo.
    const cleanupOnStartup = ["1", "true", "yes", "on"].includes((process.env.DB_CLEANUP_ON_STARTUP || "0").toLowerCase());
    const cleanupIntervalMs = cleanupIntervalMinutes * 60 * 1000;
    if (cleanupOnStartup) botManager.cleanupOldData(cleanupDays, cleanupLimits).catch((err) => {
      console.error("❌ Erro no cleanup inicial do DB:", err);
    });
    setInterval(() => {
      botManager.cleanupOldData(cleanupDays, cleanupLimits).catch((err) => {
        console.error("❌ Erro no cleanup agendado do DB:", err);
      });
    }, cleanupIntervalMs);
    console.log(
      `🧹 DB cleanup ativo: >${cleanupDays} dias a cada ${cleanupIntervalMinutes}min ` +
      `(logs=${cleanupLimits.maxLogsPerWallet}, results=${cleanupLimits.maxResultsPerWallet}, history=${cleanupLimits.maxHistoryPerWallet})`
    );

    // Inicia coletor de métricas para monitoring dashboard
    botManager.startMetricsCollector();
    console.log(`📊 Metrics collector ativo (a cada 10s, retém 24h)`);

    // Auto-inicia bots que estavam ligados antes do restart
    botManager.autoStartBots().catch((err) => {
      console.error(`❌ Erro ao auto-iniciar bots:`, err);
    });
  });
}

startServer();
