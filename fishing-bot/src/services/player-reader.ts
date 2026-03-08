import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { PROGRAM_ID, BOT_CONFIG, CUSTOM_HEADERS, FISH_MINT, FOGO_MINT } from "../config/constants";
import { getPlayerStatePDA, getConfigPDA, getGlobalStatePDA, getRiverFishConfigPDA, getRiverFishStatePDA } from "../utils/pda";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { FOGO_FISHING_IDL } from "../config/idl";
import { PlayerState, RiverBaitDef, RiverFishState } from "../types";

/**
 * Serviço para ler dados do player diretamente da blockchain
 * Não requer autenticação - apenas leitura de dados públicos
 */
export class PlayerReader {
  private connection: Connection;
  private program: Program;

  constructor(rpcEndpoint: string = BOT_CONFIG.rpc_endpoint) {
    // Cria fetch customizado com headers do navegador
    const customFetch = (url: string, options: any) => {
      const opts = { ...options };
      const headers: any = {
        ...CUSTOM_HEADERS,
        ...(opts?.headers || {}),
      };

      if (opts?.method === "POST" || opts?.body) {
        headers["Content-Type"] = "application/json";
      }

      if (headers["solana-client"]) {
        delete headers["solana-client"];
      }

      opts.headers = headers;
      return fetch(url, opts);
    };

    this.connection = new Connection(rpcEndpoint, {
      commitment: "confirmed",
      fetch: customFetch as any,
    });

    // Cria um wallet dummy para o provider (não será usado para assinar)
    const dummyWallet = new Wallet(Keypair.generate());
    const provider = new AnchorProvider(
      this.connection,
      dummyWallet,
      AnchorProvider.defaultOptions()
    );

    // @ts-ignore
    this.program = new Program(FOGO_FISHING_IDL, provider);
  }

  /**
   * Busca o estado do jogador pela wallet pubkey
   */
  async fetchPlayerState(walletPubkey: string): Promise<PlayerState | null> {
    try {
      const walletPublicKey = new PublicKey(walletPubkey);
      const [playerStatePDA] = getPlayerStatePDA(walletPublicKey);
      const playerState = await this.program.account.playerState.fetch(
        playerStatePDA
      );

      // @ts-ignore
      return {
        owner: playerState.owner.toBase58(),
        rodLevel: playerState.rodLevel,
        boatTier: playerState.boatTier ?? 1,
        castCount: playerState.castCount.toString(),
        fishCaughtAllTime: playerState.fishCaughtAllTime.toString(),
        power: playerState.power.toString(),
        maxDurability: playerState.maxDurability,
        currentDurability: playerState.currentDurability,
        supercastRemainingCasts: playerState.supercastRemainingCasts || 0,
        lastDurabilityTs: playerState.lastDurabilityTs?.toString() || "0",
        unprocessedFish: playerState.unprocessedFish?.toString() || "0",
        lastCastSlot: playerState.lastCastSlot?.toString() || "0",
        upgradeInProgress: playerState.upgradeInProgress ?? false,
        upgradeTargetLevel: playerState.upgradeTargetLevel ?? 0,
        upgradeCastsAtStart:
          playerState.upgradeCastsAtStart?.toString() || "0",
        lastClaimFeesSnapshot:
          playerState.lastClaimFeesSnapshot?.toString() || "0",
      };
    } catch (error: any) {
      if (error.message?.includes("Account does not exist")) {
        return null;
      }
      console.error("Erro ao buscar player state:", error);
      return null;
    }
  }
  /**
   * Busca as configurações do programa (Config PDA)
   */
  async fetchConfig(): Promise<any | null> {
    try {
      const [configPDA] = getConfigPDA();
      const config = await this.program.account.config.fetch(configPDA);
      return {
        authority: config.authority.toBase58(),
        issuerPubkey: config.issuerPubkey.toBase58(),
        requireCapabilityForCatch: config.requireCapabilityForCatch,
        requireCapabilityForSpend: config.requireCapabilityForSpend,
        requireFeeForInit: config.requireFeeForInit,
        softGateMode: config.softGateMode,
        basicCooldownMs: config.basicCooldownMs,
      };
    } catch (error: any) {
      console.error("Erro ao buscar config:", error);
      return null;
    }
  }

  /**
   * Busca o estado global do jogo (GlobalState PDA)
   */
  async fetchGlobalState(): Promise<any | null> {
    try {
      const [globalStatePDA] = getGlobalStatePDA();
      const gs = await this.program.account.globalState.fetch(globalStatePDA);
      return {
        authority: gs.authority.toBase58(),
        fishMint: gs.fishMint.toBase58(),
        fogoMint: gs.fogoMint.toBase58(),
        fogoTreasury: gs.fogoTreasury.toBase58(),
        fishBurnVault: gs.fishBurnVault.toBase58(),
        currentDifficulty: gs.currentDifficulty.toString(),
        totalNetworkPower: gs.totalNetworkPower.toString(),
        lastDifficultyAdjustment: gs.lastDifficultyAdjustment.toString(),
        baseEmissionRate: gs.baseEmissionRate.toString(),
        emissionDecayRate: gs.emissionDecayRate.toString(),
        dailyTargetEmission: gs.dailyTargetEmission.toString(),
        totalFogoCollected: gs.totalFogoCollected.toString(),
        totalFishMinted: gs.totalFishMinted.toString(),
        totalUnprocessedFish: gs.totalUnprocessedFish?.toString() || "0",
        accumulatedProcessingFees: gs.accumulatedProcessingFees?.toString() || "0",
        feesPerUnprocessedFish: gs.feesPerUnprocessedFish?.toString() || "0",
        halvingCount: Number(gs.halvingCount ?? 0),
        yieldGateActive: Number(gs.yieldGateActive ?? 0),
        gamePaused: Number(gs.gamePaused ?? 0),
      };
    } catch (error: any) {
      console.error("Erro ao buscar global state:", error);
      return null;
    }
  }

  /**
   * Busca o RiverFishConfig (definicoes globais dos baits)
   */
  async fetchRiverFishConfig(): Promise<{ baits: RiverBaitDef[]; difficultyRef: string; isActive: boolean } | null> {
    try {
      const [riverFishConfigPDA] = getRiverFishConfigPDA();
      const config = await this.program.account.riverFishConfig.fetch(riverFishConfigPDA);

      const baits: RiverBaitDef[] = [];
      for (let i = 0; i < 10; i++) {
        const b = (config.baits as any[])[i];
        baits.push({
          unlockLevel: b.unlockLevel,
          castsPerUnit: b.castsPerUnit,
          fishCostAtRefDifficulty: b.fishCostAtRefDifficulty.toString(),
          usdcFee: b.usdcFee.toString(),
        });
      }

      return {
        baits,
        difficultyRef: (config as any).difficultyRef.toString(),
        isActive: config.isActive as boolean,
      };
    } catch (error: any) {
      console.error("Erro ao buscar river fish config:", error);
      return null;
    }
  }

  /**
   * Busca o RiverFishState do player (inventario de iscas)
   */
  async fetchRiverFishState(walletPubkey: string): Promise<RiverFishState | null> {
    try {
      const walletPublicKey = new PublicKey(walletPubkey);
      const [riverFishStatePDA] = getRiverFishStatePDA(walletPublicKey);
      const state = await this.program.account.riverFishState.fetch(riverFishStatePDA);

      return {
        owner: (state.owner as PublicKey).toBase58(),
        activeBait: state.activeBait as number,
        remainingCasts: (state.remainingCasts as number[]).map(Number),
      };
    } catch (error: any) {
      if (error.message?.includes("Account does not exist")) {
        return null;
      }
      console.error("Erro ao buscar river fish state:", error);
      return null;
    }
  }

  /**
   * Busca balances da wallet (FOGO nativo, FISH, USDC)
   * Na Fogo chain: getBalance() retorna FOGO (token nativo), FOGO_MINT é na verdade USDC
   */
  async fetchWalletBalances(walletPubkey: string): Promise<{ fogo: number; fish: number; usdc: number } | null> {
    try {
      const walletPublicKey = new PublicKey(walletPubkey);

      // FOGO balance (token nativo da chain - equivalente ao SOL na Solana)
      const fogoBalance = await this.connection.getBalance(walletPublicKey);

      // FISH token balance
      let fishBalance = 0;
      try {
        const fishAta = getAssociatedTokenAddressSync(FISH_MINT, walletPublicKey);
        const fishAccount = await this.connection.getTokenAccountBalance(fishAta);
        fishBalance = fishAccount.value.uiAmount || 0;
      } catch {
        // Token account doesn't exist
      }

      // USDC token balance (FOGO_MINT é na verdade USDC)
      let usdcBalance = 0;
      try {
        const usdcAta = getAssociatedTokenAddressSync(FOGO_MINT, walletPublicKey);
        const usdcAccount = await this.connection.getTokenAccountBalance(usdcAta);
        usdcBalance = usdcAccount.value.uiAmount || 0;
      } catch {
        // Token account doesn't exist
      }

      return {
        fogo: fogoBalance / LAMPORTS_PER_SOL,
        fish: fishBalance,
        usdc: usdcBalance,
      };
    } catch (error: any) {
      console.error("Erro ao buscar balances:", error);
      return null;
    }
  }
}

// Singleton para reutilizar a conexão
let playerReaderInstance: PlayerReader | null = null;

export function getPlayerReader(): PlayerReader {
  if (!playerReaderInstance) {
    playerReaderInstance = new PlayerReader();
  }
  return playerReaderInstance;
}
