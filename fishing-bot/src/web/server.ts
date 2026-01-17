import { Elysia } from "elysia";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import path from "path";
import { BotManager } from "./bot-manager";
import { resultsManager } from "./results-manager";

// Cria o gerenciador de bots
const botManager = new BotManager("accounts.json");
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

// Cria Vite dev server
const vite = await createViteServer({
  root: path.join(import.meta.dir, "client"),
  server: { middlewareMode: true },
  appType: "spa",
});

// Cria servidor HTTP que combina API + Vite
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

  // Caso contrário, usa Vite middleware
  vite.middlewares(req, res);
});

server.listen(3000, () => {
  console.log(`🚀 Dashboard rodando em http://localhost:3000`);
  console.log(`📡 API disponível em http://localhost:3000/api`);
  console.log(`🎨 Frontend (Vite HMR) integrado no mesmo servidor`);
});
