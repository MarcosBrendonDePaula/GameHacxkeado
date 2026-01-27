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
  TOKEN_PROGRAM_ID,
  CU_LIMITS,
  BOT_CONFIG,
  CUSTOM_HEADERS,
  FOGO_MINT,
  BUYBACK_TREASURY,
  LIQUIDITY_TREASURY,
  OPS_TREASURY,
} from "../config/constants";
import {
  getGlobalStatePDA,
  getPlayerStatePDA,
  getRateStatePDA,
  getConfigPDA,
  getProgramSignerPDA,
} from "../utils/pda";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { generateRandomNonce, Logger, sleep } from "../utils/helpers";
import { createCapabilityInstruction } from "../utils/capability";
import { sendTransactionViaPaymaster, getSponsor } from "../utils/paymaster";
import { FOGO_FISHING_IDL } from "../config/idl";
import { PlayerState, GlobalState } from "../types";
import { createProxyAgent, checkProxyIP } from "../utils/proxy";
import { CastLogMonitor } from "./log-monitor";

export class FishingService {
  private connection: Connection;
  private wallet: Wallet;
  private program: Program;
  private logger: Logger;
  private walletPublicKey: PublicKey; // Wallet original (para PDAs e conta do jogador)
  private signerPublicKey: PublicKey; // Quem assina (session key ou wallet)
  private logMonitor: CastLogMonitor;

  constructor(
    walletKeypair: Keypair,
    rpcEndpoint: string,
    proxyUrl?: string,
    botId?: string,
    logFile?: string,
    ownerPublicKey?: PublicKey // Para session keys: a wallet original que tem a conta do jogador
  ) {
    this.logger = new Logger(botId ? `🤖 ${botId}` : "🎣 FISHING", logFile);

    // Se tem ownerPublicKey, usa ela para PDAs (session key mode)
    // Caso contrário, usa a public key do keypair
    const playerWallet = ownerPublicKey ?? walletKeypair.publicKey;

    // Calcula o PlayerState PDA para monitorar via WebSocket
    const [playerStatePDA] = getPlayerStatePDA(playerWallet);
    this.logMonitor = new CastLogMonitor(rpcEndpoint, proxyUrl, botId ?? "FISHING", playerStatePDA.toBase58());

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
    // Usa a wallet original para PDAs/transações (para session keys)
    this.walletPublicKey = playerWallet;
    // Quem assina é sempre o keypair (session key ou wallet normal)
    this.signerPublicKey = walletKeypair.publicKey;

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
      // Verifica IP do proxy em background
      checkProxyIP(proxyUrl).then(ip => {
        if (ip) {
          this.logger.success(`🌐 IP via proxy: ${ip}`);
        } else {
          this.logger.warn(`🌐 Nao foi possivel verificar IP do proxy`);
        }
      });
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
   * Verifica resultado de um cast via RPC (usado pelo sistema web)
   */
  async checkCastResult(signature: string, fishCaughtBefore: string): Promise<{ isCatch: boolean; fishAmount?: number } | null> {
    try {
      // Aguarda um pouco para a transação ser processada
      await sleep(1500);

      // Verifica o estado atual do jogador
      const playerStateAfter = await this.fetchPlayerState();
      if (!playerStateAfter) return null;

      const fishCaughtAfter = playerStateAfter.fishCaughtAllTime;

      if (BigInt(fishCaughtAfter) > BigInt(fishCaughtBefore)) {
        const diff = BigInt(fishCaughtAfter) - BigInt(fishCaughtBefore);
        const fishAmount = Number(diff) / 1_000_000;
        return { isCatch: true, fishAmount };
      }

      // Verifica se a transação existe e não tem erro
      const txData = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      if (txData?.meta?.err) {
        return { isCatch: false };
      }

      // Se a transação existe mas fish não aumentou = MISS
      if (txData) {
        return { isCatch: false };
      }

      // Transação ainda não confirmada
      return null;
    } catch (error: any) {
      this.logger.debug(`Erro ao verificar resultado: ${error.message}`);
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
          signer: this.signerPublicKey, // Session key ou wallet normal
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
   * Repara a vara de pesca
   */
  async repairRod(): Promise<string | null> {
    try {
      this.logger.info("🔧 Iniciando reparo da vara...");

      // Calcula PDAs
      const [globalStatePDA] = getGlobalStatePDA();
      const [configPDA] = getConfigPDA();
      const [playerStatePDA] = getPlayerStatePDA(this.walletPublicKey);
      const [programSignerPDA] = getProgramSignerPDA();

      // Calcula ATA do FOGO token para o owner
      const ownerFogoAta = getAssociatedTokenAddressSync(FOGO_MINT, this.walletPublicKey);

      // Cria a instrução de capability (autenticação)
      const capabilityIx = await createCapabilityInstruction(this.walletPublicKey, this.logger);

      // Cria a instrução de reparo
      // @ts-ignore
      const repairIx = await this.program.methods
        .repairRod(this.walletPublicKey)
        .accounts({
          signer: this.signerPublicKey,
          globalState: globalStatePDA,
          config: configPDA,
          playerState: playerStatePDA,
          fogoMint: FOGO_MINT,
          ownerFogoAta: ownerFogoAta,
          buybackTreasury: BUYBACK_TREASURY,
          liquidityTreasury: LIQUIDITY_TREASURY,
          opsTreasury: OPS_TREASURY,
          programSigner: programSignerPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .instruction();

      // Adiciona compute unit limit
      const computeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: CU_LIMITS.REPAIR_ROD,
      });

      // Busca o sponsor (quem paga as taxas)
      const sponsor = await getSponsor(this.logger);

      // Monta a transação
      const { blockhash } = await this.connection.getLatestBlockhash();

      const Transaction = require("@solana/web3.js").Transaction;
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sponsor;

      // Adiciona as instruções na ordem correta
      tx.add(computeUnitIx);
      tx.add(capabilityIx);
      tx.add(repairIx);

      // Assina a transação
      tx.sign(this.wallet.payer);

      // Envia via paymaster
      const signature = await sendTransactionViaPaymaster(tx, sponsor, this.logger);

      this.logger.success(`🔧 Reparo enviado! Sig: ${signature.slice(0, 12)}...`);

      // Aguarda confirmação
      await sleep(2000);

      // Verifica se o reparo foi bem-sucedido
      const playerState = await this.fetchPlayerState();
      if (playerState && playerState.currentDurability >= playerState.maxDurability * 0.9) {
        this.logger.success(`🔧 Reparo confirmado! Durabilidade: ${playerState.currentDurability}/${playerState.maxDurability}`);
      }

      return signature;
    } catch (error: any) {
      this.logger.error("Erro ao reparar vara:", error.message || error);
      return null;
    }
  }

  /**
   * Loop principal do bot (não-bloqueante)
   * Resultados são atualizados via WebSocket callback
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

    // Estatísticas
    let castCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let catchCount = 0;
    let missCount = 0;
    let totalFishCaught = 0;

    // Registra callback para resultados do WebSocket
    this.logMonitor.onResult((result) => {
      if (result.isCatch) {
        catchCount++;
        const fishAmount = result.fishAmount || 0;
        totalFishCaught += fishAmount;
        if (fishAmount > 0) {
          this.logger.success(`🐟 CATCH! +${fishAmount.toFixed(3)} fish`);
        } else {
          this.logger.success(`🐟 CATCH!`);
        }
      } else {
        missCount++;
        this.logger.warn(`🔴 MISS`);
      }

      // Mostra estatísticas
      const pending = this.logMonitor.getPendingCount();
      const catchRate = catchCount > 0 ? ((catchCount / (catchCount + missCount)) * 100).toFixed(1) : "0.0";
      this.logger.info(
        `📊 🐟 ${catchCount} (${catchRate}%) | 🔴 ${missCount} | Total: ${totalFishCaught.toFixed(3)} | ⏳ ${pending} pendentes`
      );
    });

    // Busca estado inicial para o monitor
    let lastFishCaught = playerState.fishCaughtAllTime;

    while (true) {
      try {
        castCount++;

        const signature = await this.castLine(false);

        if (signature) {
          successCount++;

          // Registra o cast como pendente (não bloqueia)
          this.logMonitor.registerCast(signature, lastFishCaught);

          this.logger.debug(`Cast #${castCount} enviado, ${this.logMonitor.getPendingCount()} pendentes`);
        } else {
          errorCount++;
          if (errorCount % 5 === 0) {
            this.logger.warn(`❌ ${errorCount} erros de ${castCount} casts`);
          }
        }

        // Aguarda o delay configurado
        await sleep(autocastDelay);

      } catch (error: any) {
        this.logger.error("Erro no loop:", error);
        errorCount++;
        await sleep(autocastDelay * 2);
      }
    }
  }
}
