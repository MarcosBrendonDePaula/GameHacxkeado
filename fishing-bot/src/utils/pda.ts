import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  GLOBAL_STATE_SEED,
  PLAYER_STATE_SEED,
  RATE_STATE_SEED,
  CONFIG_SEED,
} from "../config/constants";

/**
 * Calcula o PDA do Global State
 */
export function getGlobalStatePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(GLOBAL_STATE_SEED)],
    PROGRAM_ID
  );
}

/**
 * Calcula o PDA do Player State
 */
export function getPlayerStatePDA(walletPublicKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_STATE_SEED), walletPublicKey.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Calcula o PDA do Rate State (anti-spam)
 */
export function getRateStatePDA(walletPublicKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(RATE_STATE_SEED), walletPublicKey.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Calcula o PDA do Config
 */
export function getConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    PROGRAM_ID
  );
}
