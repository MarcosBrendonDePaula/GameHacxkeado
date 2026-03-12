/**
 * Sync From Game
 *
 * Extrai automaticamente do source.js (projeto pai):
 *   - IDL completa -> src/config/idl.ts
 *   - CU_LIMITS    -> src/config/cu-limits.ts
 *   - Endpoints    -> src/config/endpoints.ts
 *
 * Uso: bun run scripts/sync-from-game.ts
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { execSync } from "child_process";

const SOURCE_PATH = resolve(import.meta.dir, "../../source.js");
const CONFIG_DIR = resolve(import.meta.dir, "../src/config");

function log(msg: string) {
  console.log(`[sync] ${msg}`);
}

function warn(msg: string) {
  console.warn(`[sync] ⚠️  ${msg}`);
}

// ============================================================
// 1. Extract IDL
// ============================================================
function extractIDL(src: string) {
  const metaStart = src.indexOf('name: "fogo_fishing"');
  if (metaStart === -1) throw new Error("IDL not found in source (fogo_fishing)");

  const instrStart = src.indexOf("instructions = [", metaStart);
  const instrEnd = findMatchingBracket(src, instrStart + 16, "[", "]");

  const acctStart = src.indexOf("accounts = [", instrEnd);
  const acctEnd = findMatchingBracket(src, acctStart + 12, "[", "]");

  const typesStart = src.indexOf("types = [", acctEnd);
  const typesEnd = findMatchingBracket(src, typesStart + 9, "[", "]");

  const addrMatch = src.substring(metaStart - 200, metaStart).match(/address\s*=\s*"([^"]+)"/);
  const address = addrMatch ? addrMatch[1] : "SEAyjT1FUx3JyXJnWt5NtjELDwuU9XsoZeZVPVvweU4";

  const instrBlock = src.substring(instrStart + "instructions = ".length, instrEnd);
  const acctBlock = src.substring(acctStart + "accounts = ".length, acctEnd);
  const typesBlock = src.substring(typesStart + "types = ".length, typesEnd);

  // Write temp file to avoid ENAMETOOLONG with node -e
  const tmpFile = join(import.meta.dir, "_tmp_idl_extract.js");
  const jsCode = `
    const IDL = {
      address: "${address}",
      metadata: { name: "fogo_fishing", version: "0.1.0", spec: "0.1.0" },
      instructions: ${instrBlock},
      accounts: ${acctBlock},
      types: ${typesBlock}
    };
    process.stdout.write(JSON.stringify(IDL, null, 2));
  `;

  writeFileSync(tmpFile, jsCode);
  try {
    const json = execSync(`node "${tmpFile}"`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(json);
  } finally {
    try { require("fs").unlinkSync(tmpFile); } catch {}
  }
}

// ============================================================
// 2. Extract CU_LIMITS
// ============================================================
function extractCULimits(src: string): Record<string, number> {
  const cuStart = src.indexOf("const CU_LIMITS = {");
  if (cuStart === -1) throw new Error("CU_LIMITS not found in source");

  const cuEnd = src.indexOf("};", cuStart) + 2;
  const block = src.substring(cuStart, cuEnd);

  const limits: Record<string, number> = {};
  const entryRegex = /(\w+):\s*([0-9e]+)/g;
  let m: RegExpExecArray | null;
  while ((m = entryRegex.exec(block)) !== null) {
    const key = m[1];
    const value = m[2];
    if (key && value) {
      limits[key] = parseFloat(value);
    }
  }

  return limits;
}

// ============================================================
// 3. Extract Endpoints
// ============================================================
function extractEndpoints(src: string): Record<string, string> {
  const endpoints: Record<string, string> = {};

  const capMatch = src.match(/CAPABILITY_URL\s*=\s*"([^"]+)"/);
  if (capMatch?.[1]) endpoints.capability = capMatch[1];

  const statsMatch = src.match(/STATS_API_URL\s*=\s*"([^"]+)"/);
  if (statsMatch?.[1]) endpoints.stats = statsMatch[1].replace(/\/+$/, "");

  const epochsMatch = src.match(/EPOCHS_API_URL\s*=\s*"([^"]+)"/);
  if (epochsMatch?.[1]) endpoints.epochs = epochsMatch[1].replace(/\/+$/, "");

  const pmMatch = src.match(/Mainnet\]:\s*"([^"]+dourolabs-paymaster[^"]+)"/);
  if (pmMatch?.[1]) endpoints.paymaster = pmMatch[1] + "/api/sponsor_and_send";

  endpoints.paymaster_domain = "https://fogofishing.com";
  endpoints.rpc = "https://eu.fogo.fluxrpc.com/?key=74a5f926-d7b0-4c72-9a5c-0eaec1a57781";

  return endpoints;
}

// ============================================================
// Helpers
// ============================================================
function findMatchingBracket(src: string, startAfter: number, open: string, close: string): number {
  let depth = 0;
  for (let i = startAfter; i < src.length; i++) {
    if (src[i] === open) depth++;
    if (src[i] === close) {
      if (depth === 0) return i + 1;
      depth--;
    }
  }
  throw new Error(`Matching ${close} not found`);
}

function formatCULimits(limits: Record<string, number>): string {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const lines = Object.entries(limits).map(([k, v]) => {
    const formatted = v.toLocaleString("en-US").replace(/,/g, "_");
    return `  ${k}: ${formatted},`;
  });

  return [
    `// CU Limits extraidos do game source`,
    `// Gerado por: bun run scripts/sync-from-game.ts`,
    `// Ultima sync: ${today}`,
    ``,
    `export const CU_LIMITS = {`,
    ...lines,
    `} as const;`,
    ``,
    `export type CULimitKey = keyof typeof CU_LIMITS;`,
    ``,
  ].join("\n");
}

function formatEndpoints(endpoints: Record<string, string>): string {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const entries = Object.entries(endpoints)
    .map(([k, v]) => `  ${k}: "${v}",`)
    .join("\n");

  return [
    `// Endpoints extraidos do game source`,
    `// Gerado por: bun run scripts/sync-from-game.ts`,
    `// Ultima sync: ${today}`,
    ``,
    `export const ENDPOINTS = {`,
    entries,
    `} as const;`,
    ``,
    `export type EndpointKey = keyof typeof ENDPOINTS;`,
    ``,
  ].join("\n");
}

function formatIDL(idl: any): string {
  const today = new Date().toISOString().split("T")[0] ?? "";
  return [
    `// IDL extraida automaticamente do game source`,
    `// Gerado por: bun run scripts/sync-from-game.ts`,
    `// Ultima sync: ${today}`,
    ``,
    `export const FOGO_FISHING_IDL = ${JSON.stringify(idl, null, 2)} as const;`,
    ``,
    `export type FogoFishingIDL = typeof FOGO_FISHING_IDL;`,
    ``,
  ].join("\n");
}

// ============================================================
// Main
// ============================================================
console.log("🔄 Sync From Game Source");
console.log("========================\n");

if (!existsSync(SOURCE_PATH)) {
  console.error(`❌ source.js not found at ${SOURCE_PATH}`);
  console.error("   Run auto-update.js first to download the game source.");
  process.exit(1);
}

log(`Reading ${SOURCE_PATH}...`);
const src = readFileSync(SOURCE_PATH, "utf-8");
log(`Source size: ${(src.length / 1024 / 1024).toFixed(2)} MB\n`);

// IDL
try {
  log("Extracting IDL...");
  const idl = extractIDL(src);
  const idlContent = formatIDL(idl);
  writeFileSync(join(CONFIG_DIR, "idl.ts"), idlContent);
  log(`✅ IDL: ${idl.instructions.length} instructions, ${idl.accounts.length} accounts, ${idl.types.length} types`);
} catch (e: any) {
  warn(`IDL extraction failed: ${e.message}`);
}

// CU_LIMITS
try {
  log("Extracting CU_LIMITS...");
  const limits = extractCULimits(src);
  const limitsContent = formatCULimits(limits);
  writeFileSync(join(CONFIG_DIR, "cu-limits.ts"), limitsContent);
  log(`✅ CU_LIMITS: ${Object.keys(limits).length} entries`);
} catch (e: any) {
  warn(`CU_LIMITS extraction failed: ${e.message}`);
}

// Endpoints
try {
  log("Extracting endpoints...");
  const endpoints = extractEndpoints(src);
  const endpointsContent = formatEndpoints(endpoints);
  writeFileSync(join(CONFIG_DIR, "endpoints.ts"), endpointsContent);
  log(`✅ Endpoints: ${Object.keys(endpoints).length} entries`);
} catch (e: any) {
  warn(`Endpoints extraction failed: ${e.message}`);
}

console.log("\n🎉 Sync complete!");
