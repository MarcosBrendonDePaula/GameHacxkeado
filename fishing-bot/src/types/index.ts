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
