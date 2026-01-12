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
 * Logger com timestamp e suporte a arquivo
 */
export class Logger {
  private prefix: string;
  private logFile?: string;
  private fs?: any;

  constructor(prefix: string = "🎣", logFile?: string) {
    this.prefix = prefix;
    this.logFile = logFile;

    // Importa fs apenas se precisar gravar em arquivo
    if (logFile) {
      this.fs = require("fs");
      // Cria diretório de logs se não existir
      const logDir = require("path").dirname(logFile);
      if (!this.fs.existsSync(logDir)) {
        this.fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  private writeToFile(level: string, message: string, ...args: any[]) {
    if (!this.logFile || !this.fs) return;

    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? " " + args.map(a =>
      typeof a === "object" ? JSON.stringify(a) : String(a)
    ).join(" ") : "";

    const logLine = `[${timestamp}] ${level.toUpperCase()} ${this.prefix} ${message}${argsStr}\n`;

    try {
      this.fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      // Se falhar ao escrever, não faz nada (evita loop infinito)
    }
  }

  info(message: string, ...args: any[]) {
    console.log(`${this.prefix} [${new Date().toISOString()}] ${message}`, ...args);
    this.writeToFile("info", message, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`${this.prefix} ❌ [${new Date().toISOString()}] ${message}`, ...args);
    this.writeToFile("error", message, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`${this.prefix} ⚠️  [${new Date().toISOString()}] ${message}`, ...args);
    this.writeToFile("warn", message, ...args);
  }

  success(message: string, ...args: any[]) {
    console.log(`${this.prefix} ✅ [${new Date().toISOString()}] ${message}`, ...args);
    this.writeToFile("success", message, ...args);
  }

  debug(message: string, ...args: any[]) {
    console.log(`${this.prefix} 🔍 [${new Date().toISOString()}] ${message}`, ...args);
    this.writeToFile("debug", message, ...args);
  }
}
