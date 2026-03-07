import { PublicKey } from "@solana/web3.js";

// Re-exports dos modulos extraidos do game source
export { CU_LIMITS } from "./cu-limits";
export { ENDPOINTS } from "./endpoints";
export { FOGO_FISHING_IDL } from "./idl";

// Program ID
export const PROGRAM_ID = new PublicKey("SEAyjT1FUx3JyXJnWt5NtjELDwuU9XsoZeZVPVvweU4");

// Seeds for PDAs
export const GLOBAL_STATE_SEED = "global-state";
export const PLAYER_STATE_SEED = "player";
export const RATE_STATE_SEED = "rate";
export const CONFIG_SEED = "config";
export const RIVER_FISH_CONFIG_SEED = "river-fish-config";
export const RIVER_FISH_STATE_SEED = "river-fish-state";

// Token Mints
export const FISH_MINT = new PublicKey("F1SHuJ3sFF2wJoYbUJxK4iZ6CYg6MakFj8q6QHACFd4s");
export const FOGO_MINT = new PublicKey("uSd2czE61Evaf76RNbq4KPpXnkiL3irdzgLFUMe3NoG");
export const PAYMENT_TOKEN_MINT = new PublicKey("uSd2czE61Evaf76RNbq4KPpXnkiL3irdzgLFUMe3NoG"); // USDC

// Treasury Accounts (para reparo)
export const BUYBACK_TREASURY = new PublicKey("GdA82MAfigaBJm6r5UJJRRSVKN958nsh5dngBG1wR71p");
export const LIQUIDITY_TREASURY = new PublicKey("BXSy9qEa9u4W9sk3GpfnD184ttzyae1PhZXLAqKGgmeB");
export const OPS_TREASURY = new PublicKey("CAQ9C4GYAkqXDBt9Lqom5iF2oBJEAwjZugWbzfSuw2uG");

// Token Program
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// System Program IDs
export const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
export const SYSVAR_INSTRUCTIONS_PUBKEY = new PublicKey("Sysvar1nstructions1111111111111111111111111");
export const SYSVAR_SLOT_HASHES_PUBKEY = new PublicKey("SysvarS1otHashes111111111111111111111111111");

// Configuration (URLs vem de ENDPOINTS, re-exportados para compatibilidade)
import { ENDPOINTS } from "./endpoints";
export const PAYMASTER_URL = ENDPOINTS.paymaster;
export const PAYMASTER_DOMAIN = ENDPOINTS.paymaster_domain;
export const DEV_MODE = false;

// Bot Configuration
export const BOT_CONFIG = {
  autocast_delay: 500,
  rpc_endpoint: ENDPOINTS.rpc,
  max_retries: 3,
  transaction_timeout: 60,
  proxy_url: process.env.PROXY_URL || "",
  ws_timeout_ms: 15000,
  ws_reconnect_ms: 1500,
  ws_ping_interval_ms: 15000,
  ws_watch_account: "2boFwRY5EGZ18fhTLkC6PEH3VDcVHr7ZMt9APyJAKYtw",
};

// Headers customizados para simular navegador
export const CUSTOM_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0",
  "Accept": "*/*",
  "Accept-Language": "pt-PT,pt;q=0.8,en-US;q=0.5,en;q=0.3",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Referer": "https://app.fogofishing.com/",
  "Origin": "https://app.fogofishing.com",
  "Connection": "keep-alive",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site",
  "Priority": "u=4",
  "TE": "trailers",
};
