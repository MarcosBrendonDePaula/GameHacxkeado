// Endpoints extraidos do game source
// Gerado por: bun run scripts/sync-from-game.ts
// Ultima sync: 2026-03-06

export const ENDPOINTS = {
  capability: "https://cast.fogofishing.com/capability",
  stats: "https://stats.fogofishing.com",
  epochs: "https://epochs.fogofishing.com",
  paymaster: "https://fogo-mainnet.dourolabs-paymaster.xyz/api/sponsor_and_send",
  paymaster_domain: "https://fogofishing.com",
  rpc: "https://eu.fogo.fluxrpc.com/?key=74a5f926-d7b0-4c72-9a5c-0eaec1a57781",
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;
