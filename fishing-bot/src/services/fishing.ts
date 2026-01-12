import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  PROGRAM_ID,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SYSTEM_PROGRAM_ID,
  CU_LIMITS,
  BOT_CONFIG,
  CUSTOM_HEADERS,
} from "../config/constants";
import {
  getGlobalStatePDA,
  getPlayerStatePDA,
  getRateStatePDA,
  getConfigPDA,
} from "../utils/pda";
import { generateRandomNonce, Logger, sleep } from "../utils/helpers";
import { createCapabilityInstruction } from "../utils/capability";
import { sendTransactionViaPaymaster, getSponsor } from "../utils/paymaster";
import { FOGO_FISHING_IDL } from "../config/idl";
import { PlayerState, GlobalState } from "../types";
import { createProxyAgent } from "../utils/proxy";

export class FishingService {
  private connection: Connection;
  private wallet: Wallet;
  private program: Program;
  private logger: Logger;
  private walletPublicKey: PublicKey;

  constructor(walletKeypair: Keypair, rpcEndpoint: string, proxyUrl?: string, botId?: string, logFile?: string) {
    this.logger = new Logger(botId ? `🤖 ${botId}` : "🎣 FISHING", logFile);

    // Cria proxy agent se configurado
    const proxyAgent = proxyUrl ? createProxyAgent(proxyUrl) : undefined;

    // Cria função fetch customizada com headers do navegador e proxy
    const customFetch = (url: string, options: any) => {
      const opts = { ...options };

      // Garante que Content-Type seja application/json
      const headers: any = {
        ...CUSTOM_HEADERS,
        ...(opts?.headers || {}),
      };

      // Força Content-Type correto (com C maiúsculo)
      if (opts?.method === "POST" || opts?.body) {
        headers["Content-Type"] = "application/json";
      }

      // IMPORTANTE: Remove header solana-client (igual ao jogo faz)
      if (headers["solana-client"]) {
        delete headers["solana-client"];
      }

      opts.headers = headers;

      // Adiciona proxy agent se configurado
      if (proxyAgent) {
        // @ts-ignore - agent não está nos tipos padrão mas funciona
        opts.agent = proxyAgent;
      }

      return fetch(url, opts);
    };

    // Cria conexão com fetch customizado
    this.connection = new Connection(rpcEndpoint, {
      commitment: "confirmed",
      fetch: customFetch as any,
    });

    this.wallet = new Wallet(walletKeypair);
    this.walletPublicKey = walletKeypair.publicKey;

    const provider = new AnchorProvider(
      this.connection,
      this.wallet,
      AnchorProvider.defaultOptions()
    );

    // @ts-ignore - Anchor types podem ser complicados
    this.program = new Program(FOGO_FISHING_IDL, provider);

    this.logger.info(`Wallet: ${this.walletPublicKey.toBase58()}`);
    this.logger.debug(`🌐 RPC: ${rpcEndpoint.substring(0, 50)}...`);

    if (proxyUrl) {
      this.logger.info(`🌐 Proxy: ${proxyUrl}`);
    }
  }

  /**
   * Busca o estado global do jogo
   */
  async fetchGlobalState(): Promise<GlobalState | null> {
    try {
      const [globalStatePDA] = getGlobalStatePDA();
      const globalState = await this.program.account.globalState.fetch(
        globalStatePDA
      );

      // @ts-ignore
      return {
        authority: globalState.authority.toBase58(),
        fishMint: globalState.fishMint.toBase58(),
        fogoMint: globalState.fogoMint.toBase58(),
        collateralTreasury: globalState.fogoTreasury.toBase58(),
        fogoTreasury: globalState.fogoTreasury.toBase58(),
        fishBurnVault: globalState.fishBurnVault.toBase58(),
        currentDifficulty: globalState.currentDifficulty.toString(),
        totalNetworkPower: globalState.totalNetworkPower.toString(),
        baseEmissionRate: globalState.baseEmissionRate.toString(),
        dailyTargetEmission: globalState.dailyTargetEmission.toString(),
        emissionDecayRate: globalState.emissionDecayRate.toString(),
        lastDifficultyAdjustment:
          globalState.lastDifficultyAdjustment.toString(),
        collateralPoolValue: globalState.totalFogoCollected.toString(),
        totalFishMinted: globalState.totalFishMinted.toString(),
        totalUnprocessedFish: globalState.totalUnprocessedFish?.toString() || "0",
        feesPerUnprocessedFish:
          globalState.feesPerUnprocessedFish?.toString() || "0",
        halvingCount: Number(globalState.halvingCount ?? 0),
      };
    } catch (error) {
      this.logger.error("Erro ao buscar global state:", error);
      return null;
    }
  }

  /**
   * Busca o estado do jogador
   */
  async fetchPlayerState(): Promise<PlayerState | null> {
    try {
      const [playerStatePDA] = getPlayerStatePDA(this.walletPublicKey);
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
        this.logger.warn("Conta de jogador não existe. Precisa inicializar.");
        return null;
      }
      this.logger.error("Erro ao buscar player state:", error);
      return null;
    }
  }

  /**
   * Verifica o resultado de um cast analisando os logs da transação e comparando estado
   */
  async checkCastResult(
    signature: string,
    fishCaughtBefore: string
  ): Promise<{
    isCatch: boolean;
    fishAmount?: number;
    rarity?: number;
    tile?: number;
  } | null> {
    try {
      // Aguarda um pouco para garantir que a transação foi processada
      await sleep(1500);

      // Busca a transação com logs
      const txData = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      if (!txData || !txData.meta) {
        this.logger.warn("Transação não encontrada ou sem metadata");
        return null;
      }

      // Procura por logs que indicam CATCH ou MISS
      const logs = txData.meta.logMessages || [];

      // Procura por padrões nos logs (similar ao que o jogo mostra)
      for (const log of logs) {
        // Procura por CATCH - o log geralmente contém algo como "Program log: Catch"
        if (log.includes("Catch") || log.includes("catch")) {
          // Tenta extrair informações do log
          this.logger.debug(`Log de catch encontrado: ${log}`);
          return {
            isCatch: true,
          };
        }

        // Procura por MISS
        if (log.includes("Miss") || log.includes("miss")) {
          this.logger.debug(`Log de miss encontrado: ${log}`);
          return {
            isCatch: false,
          };
        }
      }

      // Se não encontrou logs específicos, compara o estado do jogador
      this.logger.debug("Comparando estado do jogador para determinar resultado...");
      const playerStateAfter = await this.fetchPlayerState();

      if (playerStateAfter) {
        const fishCaughtAfter = playerStateAfter.fishCaughtAllTime;

        // Se fishCaughtAllTime aumentou, foi um CATCH
        if (BigInt(fishCaughtAfter) > BigInt(fishCaughtBefore)) {
          const diff = BigInt(fishCaughtAfter) - BigInt(fishCaughtBefore);
          // FISH token tem 6 decimais, converter de lamports para fish
          const fishAmount = Number(diff) / 1_000_000;
          this.logger.debug(`Estado mudou: +${fishAmount} fish`);
          return {
            isCatch: true,
            fishAmount: fishAmount,
          };
        } else {
          this.logger.debug("Estado não mudou: MISS");
          return {
            isCatch: false,
          };
        }
      }

      // Se não conseguiu determinar de nenhuma forma
      this.logger.debug("Não foi possível determinar o resultado");
      return null;

    } catch (error: any) {
      this.logger.error("Erro ao verificar resultado:", error.message);
      return null;
    }
  }

  /**
   * Executa um cast (pesca)
   */
  async castLine(useSupercast: boolean = false): Promise<string | null> {
    try {
      // Busca slot atual
      const currentSlot = await this.connection.getSlot("processed");

      // Gera nonce aleatório
      const nonceBytes = generateRandomNonce();
      const nonce = new BN(nonceBytes);

      // Calcula PDAs
      const [globalStatePDA] = getGlobalStatePDA();
      const [configPDA] = getConfigPDA();
      const [rateStatePDA] = getRateStatePDA(this.walletPublicKey);
      const [playerStatePDA] = getPlayerStatePDA(this.walletPublicKey);

      this.logger.debug("Preparando cast...");
      this.logger.debug(`Slot: ${currentSlot}`);
      this.logger.debug(`Supercast: ${useSupercast}`);

      // Cria a instrução de capability (autenticação)
      const capabilityIx = await createCapabilityInstruction(this.walletPublicKey, this.logger);

      // Cria a instrução de cast
      // @ts-ignore
      const castIx = await this.program.methods
        .castLine(
          this.walletPublicKey,
          new BN(currentSlot),
          useSupercast,
          nonce
        )
        .accounts({
          signer: this.walletPublicKey,
          globalState: globalStatePDA,
          config: configPDA,
          rateState: rateStatePDA,
          instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
          playerState: playerStatePDA,
          systemProgram: SYSTEM_PROGRAM_ID,
        })
        .instruction();

      // Adiciona compute unit limit com randomização
      const randomExtra = Math.floor(Math.random() * 1000);
      const computeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: CU_LIMITS.CAST_LINE + randomExtra,
      });

      // Busca o sponsor (quem paga as taxas)
      const sponsor = await getSponsor(this.logger);

      // Monta a transação
      const { blockhash } = await this.connection.getLatestBlockhash();

      const Transaction = require("@solana/web3.js").Transaction;
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sponsor; // IMPORTANTE: sponsor como feePayer!

      // Adiciona as instruções na ordem correta
      tx.add(computeUnitIx);
      tx.add(capabilityIx); // Capability para autenticação
      tx.add(castIx);

      // Assina a transação com a wallet
      tx.sign(this.wallet.payer);

      // Envia via paymaster (que paga as taxas)
      const signature = await sendTransactionViaPaymaster(tx, sponsor, this.logger);

      this.logger.success(`Cast realizado! Sig: ${signature.slice(0, 12)}...`);
      return signature;
    } catch (error: any) {
      this.logger.error("Erro ao fazer cast:", error.message || error);
      return null;
    }
  }

  /**
   * Loop principal do bot
   */
  async startAutoCast(autocastDelay: number = BOT_CONFIG.autocast_delay) {
    this.logger.info("🚀 Iniciando auto-cast...");
    this.logger.info(`⏱️  Delay entre casts: ${autocastDelay}ms`);

    // Verifica estado inicial
    const playerState = await this.fetchPlayerState();
    if (!playerState) {
      this.logger.error("Jogador não inicializado. Abortando.");
      return;
    }

    this.logger.info(`🎣 Rod Level: ${playerState.rodLevel}`);
    this.logger.info(`⚡ Power: ${playerState.power}`);
    this.logger.info(`🔧 Durability: ${playerState.currentDurability}/${playerState.maxDurability}`);

    let castCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let catchCount = 0;
    let missCount = 0;
    let totalFishCaught = 0;

    while (true) {
      try {
        castCount++;
        this.logger.info(`\n--- Cast #${castCount} ---`);

        // Busca estado antes do cast
        const playerStateBefore = await this.fetchPlayerState();
        const fishCaughtBefore = playerStateBefore?.fishCaughtAllTime || "0";

        const signature = await this.castLine(false);

        if (signature) {
          successCount++;

          // Verifica o resultado do cast
          const result = await this.checkCastResult(signature, fishCaughtBefore);

          if (result !== null) {
            if (result.isCatch) {
              catchCount++;
              const fishAmount = result.fishAmount || 0;
              totalFishCaught += fishAmount;

              if (fishAmount > 0) {
                this.logger.success(`🐟 CATCH! +${fishAmount.toLocaleString()} fish`);
              } else {
                this.logger.success(`🐟 CATCH!`);
              }
            } else {
              missCount++;
              this.logger.warn(`🔴 MISS`);
            }
          } else {
            this.logger.info(`⚠️ Resultado indeterminado`);
          }

          // Estatísticas gerais
          const successRate = ((successCount / castCount) * 100).toFixed(1);
          const catchRate = catchCount > 0 ? ((catchCount / (catchCount + missCount)) * 100).toFixed(1) : "0.0";

          this.logger.success(
            `📊 ${successCount}/${castCount} (${successRate}%) | 🐟 ${catchCount} catches (${catchRate}%) | 🔴 ${missCount} misses | Total: ${totalFishCaught.toLocaleString()} fish`
          );
        } else {
          errorCount++;
          this.logger.warn(`❌ Erros: ${errorCount}/${castCount}`);
        }

        // Aguarda o delay configurado
        this.logger.debug(`Aguardando ${autocastDelay}ms...`);
        await sleep(autocastDelay);

      } catch (error: any) {
        this.logger.error("Erro no loop:", error);
        errorCount++;

        // Em caso de erro, aguarda um pouco mais
        await sleep(autocastDelay * 2);
      }
    }
  }
}
