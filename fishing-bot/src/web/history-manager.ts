// Gerenciador de histórico temporal dos bots

export interface HistoryPoint {
  timestamp: Date;
  catches: number;
  misses: number;
  totalFish: number;
}

class HistoryManager {
  private history: Map<string, HistoryPoint[]> = new Map();
  private maxPoints = 100; // Mantém últimos 100 pontos

  addPoint(botId: string, catches: number, misses: number, totalFish: number) {
    if (!this.history.has(botId)) {
      this.history.set(botId, []);
    }

    const points = this.history.get(botId)!;
    points.push({
      timestamp: new Date(),
      catches,
      misses,
      totalFish,
    });

    // Limita o número de pontos
    if (points.length > this.maxPoints) {
      points.shift();
    }
  }

  getHistory(botId: string): HistoryPoint[] {
    return this.history.get(botId) || [];
  }

  clearHistory(botId: string) {
    this.history.delete(botId);
  }

  getAllBotIds(): string[] {
    return Array.from(this.history.keys());
  }
}

export const historyManager = new HistoryManager();
