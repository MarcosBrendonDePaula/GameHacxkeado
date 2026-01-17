import { Elysia } from "elysia";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { BotManager } from "./bot-manager";
import { resultsManager } from "./results-manager";

// Detecta se está rodando como executável compilado
// - import.meta.path contém ~BUN quando é executável compilado
// - Bun.argv[0] termina em .exe MAS não é "bun.exe" (que é o runtime)
// - Variável de ambiente forçada
const exeName = path.basename(Bun.argv[0]).toLowerCase();
const isExecutable =
  import.meta.path.includes("~BUN") ||
  (exeName.endsWith(".exe") && !exeName.includes("bun")) ||
  process.env.FISHING_BOT_PROD === "1";

const exeDir = path.dirname(Bun.argv[0]);

// Caminhos dependem do modo
const distClientPath = isExecutable
  ? path.join(exeDir, "client")
  : path.join(import.meta.dir, "../../dist/client");

const accountsPath = isExecutable
  ? path.join(exeDir, "accounts.json")
  : "accounts.json";

console.log(`🔧 Modo: ${isExecutable ? "Produção (Executável)" : "Desenvolvimento (Vite)"}`);
console.log(`📂 Exe dir: ${exeDir}`);
console.log(`📂 Client path: ${distClientPath}`);
console.log(`📂 Accounts path: ${accountsPath}`);

const botManager = new BotManager(accountsPath);
await botManager.loadBots();

// Cria API Elysia
const api = new Elysia({ prefix: "/api" })
  .get("/stats", () => botManager.getStats())
  .get("/bots", () => ({ bots: botManager.getAllBots() }))
  .get("/bots/:id", ({ params }) => {
    const bot = botManager.getBot(params.id);
    return bot || { error: "Bot não encontrado" };
  })
  .get("/bots/:id/detailed", async ({ params }) => {
    const detailed = await botManager.getBotDetailed(params.id);
    return detailed || { error: "Bot não encontrado" };
  })
  .get("/bots/:id/history", ({ params }) => {
    const history = botManager.getBotHistory(params.id);
    return { history };
  })
  .post("/bots/:id/start", async ({ params }) => {
    const success = await botManager.startBot(params.id);
    if (!success) return { success: false, error: "Bot não encontrado" };

    const bot = botManager.getBot(params.id);
    console.log(`🚀 Starting bot ${params.id}`);
    return { success: true, message: `Bot ${bot?.name} iniciado`, bot };
  })
  .post("/bots/:id/stop", async ({ params }) => {
    const success = await botManager.stopBot(params.id);
    if (!success) return { success: false, error: "Bot não encontrado" };

    const bot = botManager.getBot(params.id);
    console.log(`⏸️ Stopping bot ${params.id}`);
    return { success: true, message: `Bot ${bot?.name} parado`, bot };
  })
  .post("/bots/start-all", async () => {
    const count = await botManager.startAllBots();
    console.log(`🚀 Starting all bots (${count} bots)`);
    return { success: true, message: `${count} bots iniciados`, count };
  })
  .post("/bots/stop-all", async () => {
    const count = await botManager.stopAllBots();
    console.log(`⏸️ Stopping all bots (${count} bots)`);
    return { success: true, message: `${count} bots parados`, count };
  })
  .get("/logs", ({ query }) => {
    const botFilter = query.bot as string | undefined;
    const limit = query.limit ? parseInt(query.limit as string) : 50;
    const offset = query.offset ? parseInt(query.offset as string) : 0;
    const level = query.level as any;

    const logs = botManager.getLogs({ botFilter, limit, offset, level });
    const total = botManager.getTotalLogsCount(botFilter, level);

    return {
      logs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  })
  .get("/logs/bots", () => ({
    bots: botManager.getAvailableBots()
  }))
  // Endpoints de resultados (feed de CATCH/MISS)
  .get("/results", ({ query }) => {
    const botId = query.bot as string | undefined;
    const limit = query.limit ? parseInt(query.limit as string) : 50;
    const offset = query.offset ? parseInt(query.offset as string) : 0;
    const since = query.since as string | undefined;

    const { results, total } = resultsManager.getResults({ botId, limit, offset, since });
    return {
      results,
      total,
      stats: resultsManager.getStats()
    };
  })
  .get("/results/stats", () => resultsManager.getStats())
  .get("/bot-configs", () => {
    console.log("📋 GET /api/bot-configs");
    const configs = botManager.getBotConfigs();
    console.log("📋 Retornando configs:", configs);
    return { bots: configs };
  })
  .put("/bot-configs", async ({ body }) => {
    console.log("💾 PUT /api/bot-configs");
    console.log("💾 Body tipo:", typeof body);
    console.log("💾 Body conteúdo:", JSON.stringify(body));

    try {
      if (!body) {
        console.error("❌ Body é null ou undefined!");
        return { success: false, error: "Body vazio" };
      }

      const { bots } = body as any;
      console.log("💾 Salvando configs:", bots);
      await botManager.saveBotConfigs(bots);
      return { success: true, message: "Configurações salvas com sucesso" };
    } catch (error: any) {
      console.error("❌ Erro ao salvar:", error);
      return { success: false, error: error.message };
    }
  });

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
  // Remove query string
  const cleanPath = urlPath.split("?")[0];

  // Se for raiz ou não tiver extensão, serve index.html (SPA)
  let filePath = cleanPath === "/" || !path.extname(cleanPath)
    ? path.join(distClientPath, "index.html")
    : path.join(distClientPath, cleanPath);

  // Verifica se o arquivo existe
  if (!fs.existsSync(filePath)) {
    // Fallback para index.html (SPA routing)
    filePath = path.join(distClientPath, "index.html");
  }

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (error) {
    res.writeHead(404);
    res.end("Not Found");
  }
}

// Função para iniciar o servidor
async function startServer() {
  let vite: any = null;

  // Se não for executável, usa Vite dev server
  if (!isExecutable) {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({
      root: path.join(import.meta.dir, "client"),
      server: { middlewareMode: true },
      appType: "spa",
    });
  }

  // Cria servidor HTTP que combina API + Frontend
  const server = createServer(async (req, res) => {
    const url = req.url || "/";

    // Se for rota da API, usa Elysia
    if (url.startsWith("/api")) {
      // Lê o body da requisição se existir
      let body = null;
      if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const bodyString = Buffer.concat(chunks).toString();
        console.log("📦 Body recebido:", bodyString);

        // Parse o JSON se tiver conteúdo
        if (bodyString) {
          try {
            body = JSON.stringify(JSON.parse(bodyString));
          } catch (e) {
            console.error("❌ Erro ao parsear body:", e);
            body = bodyString;
          }
        }
      }

      const request = new Request(`http://localhost${url}`, {
        method: req.method,
        headers: req.headers as any,
        body: body,
      });

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
    if (isExecutable) {
      console.log(`📦 Frontend servindo arquivos estáticos de: ${distClientPath}`);
    } else {
      console.log(`🎨 Frontend (Vite HMR) integrado no mesmo servidor`);
    }
  });
}

startServer();
