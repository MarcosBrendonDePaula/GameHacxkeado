import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export interface GlobalState {
  authority: string;
  fishMint: string;
  fogoMint: string;
  collateralTreasury: string;
  fogoTreasury: string;
  fishBurnVault: string;
  currentDifficulty: string;
  totalNetworkPower: string;
  baseEmissionRate: string;
  dailyTargetEmission: string;
  emissionDecayRate: string;
  lastDifficultyAdjustment: string;
  collateralPoolValue: string;
  totalFishMinted: string;
  totalUnprocessedFish: string;
  feesPerUnprocessedFish: string;
  halvingCount: number;
}

export interface PlayerState {
  owner: string;
  rodLevel: number;
  boatTier: number;
  castCount: string;
  fishCaughtAllTime: string;
  power: string;
  maxDurability: number;
  currentDurability: number;
  supercastRemainingCasts: number;
  lastDurabilityTs: string;
  unprocessedFish: string;
  lastCastSlot: string;
  upgradeInProgress: boolean;
  upgradeTargetLevel: number;
  upgradeCastsAtStart: string;
  lastClaimFeesSnapshot: string;
}

export interface CastLineParams {
  walletPublicKey: PublicKey;
  slot: BN;
  isSupercast: boolean;
  nonce: BN;
}

export interface CastResult {
  signature: string;
  hasFish: boolean;
  rarity?: number;
  amount?: number;
}

export interface BotConfig {
  walletKeypairPath: string;
  sessionKeypairPath?: string;
  rpcEndpoint: string;
  autocastDelay: number;
  maxRetries: number;
  transactionTimeout: number;
}

export enum FishRarity {
  COMMON = 0,
  UNCOMMON = 1,
  RARE = 2,
  EPIC = 3,
  LEGENDARY = 4,
  LUNKER = 5,
}

// ============================================
// River Bait System (Season 2)
// ============================================

export interface RiverBaitDef {
  unlockLevel: number;
  castsPerUnit: number;
  fishCostAtRefDifficulty: string; // lamports (6 decimals)
  usdcFee: string; // lamports (6 decimals)
}

export interface RiverFishState {
  owner: string;
  activeBait: number; // 0 = none, 1-10 = bait type
  remainingCasts: number[]; // 10 buckets, index = bait_id - 1
}

export const BAIT_NAMES: Record<number, string> = {
  1: "Mudwiggler",
  2: "Skitterbug",
  3: "River Scraps",
  4: "Scented Dough",
  5: "Flash Spinner",
  6: "Crankbait",
  7: "Live Flicker",
  8: "Glow Ember",
  9: "Ember Bait",
  10: "River Charm",
};

export const BAIT_CATALOGUE = [
  { id: 1, name: "Mudwiggler", level: 4, castsPerUnit: 600, fishCost: "75K", usdcFee: "0.13" },
  { id: 2, name: "Skitterbug", level: 10, castsPerUnit: 750, fishCost: "150K", usdcFee: "0.13" },
  { id: 3, name: "River Scraps", level: 18, castsPerUnit: 500, fishCost: "150K", usdcFee: "0.13" },
  { id: 4, name: "Scented Dough", level: 20, castsPerUnit: 900, fishCost: "315K", usdcFee: "0.25" },
  { id: 5, name: "Flash Spinner", level: 22, castsPerUnit: 1200, fishCost: "480K", usdcFee: "0.25" },
  { id: 6, name: "Crankbait", level: 26, castsPerUnit: 1400, fishCost: "665K", usdcFee: "0.38" },
  { id: 7, name: "Live Flicker", level: 35, castsPerUnit: 800, fishCost: "1.5M", usdcFee: "0.38" },
  { id: 8, name: "Glow Ember", level: 38, castsPerUnit: 1000, fishCost: "2M", usdcFee: "0.50" },
  { id: 9, name: "Ember Bait", level: 50, castsPerUnit: 1500, fishCost: "5M", usdcFee: "0.63" },
  { id: 10, name: "River Charm", level: 55, castsPerUnit: 2000, fishCost: "10M", usdcFee: "0.75" },
];
