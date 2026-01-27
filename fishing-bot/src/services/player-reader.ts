import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { PROGRAM_ID, BOT_CONFIG, CUSTOM_HEADERS } from "../config/constants";
import { getPlayerStatePDA } from "../utils/pda";
import { FOGO_FISHING_IDL } from "../config/idl";
import { PlayerState } from "../types";

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
}

// Singleton para reutilizar a conexão
let playerReaderInstance: PlayerReader | null = null;

export function getPlayerReader(): PlayerReader {
  if (!playerReaderInstance) {
    playerReaderInstance = new PlayerReader();
  }
  return playerReaderInstance;
}
