export interface LogEntry {
  timestamp: Date;
  bot: string;
  level: "success" | "warn" | "error" | "info";
  message: string;
}

interface GetLogsOptions {
  botFilter?: string; // Filtrar por bot específico
  limit?: number;     // Quantos logs retornar
  offset?: number;    // De onde começar (para paginação)
  level?: LogEntry["level"]; // Filtrar por nível
}

class LogManager {
  private logs: LogEntry[] = [];
  private maxLogs = 500; // Mantém mais logs agora

  addLog(bot: string, level: LogEntry["level"], message: string) {
    const log: LogEntry = {
      timestamp: new Date(),
      bot,
      level,
      message,
    };

    this.logs.unshift(log); // Adiciona no início

    // Mantém apenas os últimos maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
  }

  getLogs(options: GetLogsOptions = {}): LogEntry[] {
    const {
      botFilter,
      limit = 50,
      offset = 0,
      level,
    } = options;

    let filteredLogs = this.logs;

    // Filtro por bot
    if (botFilter && botFilter !== "all") {
      filteredLogs = filteredLogs.filter(log => log.bot === botFilter);
    }

    // Filtro por nível
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    // Paginação: retorna apenas um slice dos logs
    return filteredLogs.slice(offset, offset + limit);
  }

  getTotalCount(botFilter?: string, level?: LogEntry["level"]): number {
    let filtered = this.logs;

    if (botFilter && botFilter !== "all") {
      filtered = filtered.filter(log => log.bot === botFilter);
    }

    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }

    return filtered.length;
  }

  getAvailableBots(): string[] {
    const bots = new Set<string>();
    this.logs.forEach(log => bots.add(log.bot));
    return Array.from(bots).sort();
  }

  clear() {
    this.logs = [];
  }
}

export const logManager = new LogManager();
