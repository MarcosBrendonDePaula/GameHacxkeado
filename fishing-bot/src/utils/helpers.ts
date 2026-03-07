/**
 * Aguarda um tempo específico
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calcula a durabilidade esperada considerando regeneração passiva
 */
export function calculateExpectedDurability(
  currentDurability: number,
  maxDurability: number,
  lastDurabilityTs: number
): number {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - lastDurabilityTs;

  // Assume 1 durability por minuto de regeneração (você pode ajustar isso)
  const REGEN_PER_MINUTE = 1;
  const minutesElapsed = Math.floor(elapsed / 60);
  const regenAmount = minutesElapsed * REGEN_PER_MINUTE;

  return Math.min(currentDurability + regenAmount, maxDurability);
}

/**
 * Formata número grande de forma compacta (1000 -> 1k)
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}

/**
 * Gera bytes aleatórios para nonce
 */
export function generateRandomNonce(): Uint8Array {
  const nonce = new Uint8Array(8);
  crypto.getRandomValues(nonce);
  return nonce;
}

/**
 * Logger com timestamp e suporte a arquivo (async com buffer)
 */
export class Logger {
  private prefix: string;
  private logFile?: string;
  private fileHandle?: any;
  private buffer: string[] = [];
  private flushTimer?: ReturnType<typeof setTimeout>;
  private static readonly FLUSH_INTERVAL = 3000; // flush a cada 3s
  private static readonly BUFFER_LIMIT = 50; // flush se buffer > 50 linhas

  constructor(prefix: string = "🎣", logFile?: string) {
    this.prefix = prefix;
    this.logFile = logFile;

    if (logFile) {
      const fs = require("fs");
      const path = require("path");
      const logDir = path.dirname(logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      // Abre file handle para append async
      this.fileHandle = Bun.file(logFile).writer();
      this.startFlushTimer();
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => this.flush(), Logger.FLUSH_INTERVAL);
  }

  private enqueue(level: string, message: string, ...args: any[]) {
    if (!this.fileHandle) return;

    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? " " + args.map(a =>
      typeof a === "object" ? JSON.stringify(a) : String(a)
    ).join(" ") : "";

    this.buffer.push(`[${timestamp}] ${level.toUpperCase()} ${this.prefix} ${message}${argsStr}\n`);

    if (this.buffer.length >= Logger.BUFFER_LIMIT) {
      this.flush();
    }
  }

  flush() {
    if (!this.fileHandle || this.buffer.length === 0) return;
    try {
      const data = this.buffer.join("");
      this.buffer.length = 0;
      this.fileHandle.write(data);
      this.fileHandle.flush();
    } catch {
      this.buffer.length = 0;
    }
  }

  close() {
    this.flush();
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.fileHandle) {
      try { this.fileHandle.end(); } catch {}
    }
  }

  info(message: string, ...args: any[]) {
    console.log(`${this.prefix} [${new Date().toISOString()}] ${message}`, ...args);
    this.enqueue("info", message, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`${this.prefix} [${new Date().toISOString()}] ${message}`, ...args);
    this.enqueue("error", message, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`${this.prefix} [${new Date().toISOString()}] ${message}`, ...args);
    this.enqueue("warn", message, ...args);
  }

  success(message: string, ...args: any[]) {
    console.log(`${this.prefix} [${new Date().toISOString()}] ${message}`, ...args);
    this.enqueue("success", message, ...args);
  }

  debug(message: string, ...args: any[]) {
    console.log(`${this.prefix} [${new Date().toISOString()}] ${message}`, ...args);
    this.enqueue("debug", message, ...args);
  }
}
