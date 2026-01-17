export interface CastResult {
  id: string;
  timestamp: Date;
  botId: string;
  botName: string;
  type: "catch" | "miss";
  fishAmount?: number;
  signature?: string;
}

class ResultsManager {
  private results: CastResult[] = [];
  private maxResults = 200;
  private nextId = 1;

  addResult(botId: string, botName: string, type: "catch" | "miss", fishAmount?: number, signature?: string) {
    const result: CastResult = {
      id: String(this.nextId++),
      timestamp: new Date(),
      botId,
      botName,
      type,
      fishAmount,
      signature,
    };

    this.results.unshift(result);

    // Mantém apenas os últimos N resultados
    if (this.results.length > this.maxResults) {
      this.results = this.results.slice(0, this.maxResults);
    }

    return result;
  }

  getResults(options: { botId?: string; limit?: number; offset?: number; since?: string } = {}): { results: CastResult[]; total: number } {
    const { botId, limit = 50, offset = 0, since } = options;

    let filtered = this.results;

    // Filtro por bot
    if (botId) {
      filtered = filtered.filter(r => r.botId === botId);
    }

    // Filtro por timestamp (para polling eficiente)
    if (since) {
      const sinceDate = new Date(since);
      filtered = filtered.filter(r => r.timestamp > sinceDate);
    }

    const total = filtered.length;
    const results = filtered.slice(offset, offset + limit);

    return { results, total };
  }

  getStats() {
    const last5min = new Date(Date.now() - 5 * 60 * 1000);
    const recent = this.results.filter(r => r.timestamp > last5min);

    const catches = recent.filter(r => r.type === "catch").length;
    const misses = recent.filter(r => r.type === "miss").length;
    const totalFish = recent
      .filter(r => r.type === "catch")
      .reduce((sum, r) => sum + (r.fishAmount || 0), 0);

    return {
      last5min: {
        catches,
        misses,
        totalFish,
        rate: catches + misses > 0 ? ((catches / (catches + misses)) * 100).toFixed(1) : "0.0"
      },
      totalResults: this.results.length
    };
  }

  clear() {
    this.results = [];
    this.nextId = 1;
  }
}

export const resultsManager = new ResultsManager();
