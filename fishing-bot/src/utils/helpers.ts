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
 * Logger com timestamp
 */
export class Logger {
  private prefix: string;

  constructor(prefix: string = "🎣") {
    this.prefix = prefix;
  }

  info(message: string, ...args: any[]) {
    console.log(`${this.prefix} [${new Date().toISOString()}] ${message}`, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`${this.prefix} ❌ [${new Date().toISOString()}] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`${this.prefix} ⚠️  [${new Date().toISOString()}] ${message}`, ...args);
  }

  success(message: string, ...args: any[]) {
    console.log(`${this.prefix} ✅ [${new Date().toISOString()}] ${message}`, ...args);
  }

  debug(message: string, ...args: any[]) {
    console.log(`${this.prefix} 🔍 [${new Date().toISOString()}] ${message}`, ...args);
  }
}
