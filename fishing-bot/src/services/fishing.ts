import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
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
  FISH_MINT,
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
  getRiverFishConfigPDA,
  getRiverFishStatePDA,
} from "../utils/pda";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { generateRandomNonce, Logger, sleep } from "../utils/helpers";
import { createCapabilityInstruction } from "../utils/capability";
import { sendTransactionViaPaymaster, getSponsor } from "../utils/paymaster";
import { FOGO_FISHING_IDL } from "../config/idl";
import type { PlayerState, GlobalState, RiverFishState } from "../types";
import { createProxyAgent, checkProxyIP } from "../utils/proxy";
import { CastLogMonitor } from "./log-monitor";

type ProgramAccountMap = {
  globalState: { fetch(address: PublicKey): Promise<any> };
  playerState: { fetch(address: PublicKey): Promise<any> };
  riverFishState: { fetch(address: PublicKey): Promise<any> };
  riverFishConfig: { fetch(address: PublicKey): Promise<any> };
  config: { fetch(address: PublicKey): Promise<any> };
};

export class FishingService {
  private connection: Connection;
  private wallet: Wallet;
  private program: Program;
  private logger: Logger;
  private walletPublicKey: PublicKey; // Wallet original (para PDAs e conta do jogador)
  private signerPublicKey: PublicKey; // Quem assina (session key ou wallet)
  private logMonitor: CastLogMonitor;
  // Mints dinâmicos carregados do GlobalState on-chain
  private dynamicFishMint: PublicKey | null = null;
  private dynamicFogoMint: PublicKey | null = null;

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
   * Carrega fishMint e fogoMint do GlobalState on-chain (cache após primeira chamada)
   */
  private async loadMintsFromGlobalState(): Promise<{ fishMint: PublicKey; fogoMint: PublicKey }> {
    if (this.dynamicFishMint && this.dynamicFogoMint) {
      return { fishMint: this.dynamicFishMint, fogoMint: this.dynamicFogoMint };
    }

    try {
      const [globalStatePDA] = getGlobalStatePDA();
      const gs = await (this.program.account as unknown as ProgramAccountMap).globalState.fetch(globalStatePDA);
      this.dynamicFishMint = gs.fishMint as PublicKey;
      this.dynamicFogoMint = gs.fogoMint as PublicKey;
      this.logger.info(`🔗 Mints carregados do GlobalState: FISH=${this.dynamicFishMint.toBase58().slice(0, 8)}... FOGO=${this.dynamicFogoMint.toBase58().slice(0, 8)}...`);
      return { fishMint: this.dynamicFishMint, fogoMint: this.dynamicFogoMint };
    } catch (error) {
      this.logger.warn("⚠️ Falha ao ler mints do GlobalState, usando constantes hardcoded");
      return { fishMint: FISH_MINT, fogoMint: FOGO_MINT };
    }
  }

  /**
   * Retorna o FISH mint (dinâmico se já carregado, senão constante)
   */
  private get fishMint(): PublicKey {
    return this.dynamicFishMint ?? FISH_MINT;
  }

  /**
   * Retorna o FOGO mint (dinâmico se já carregado, senão constante)
   */
  private get fogoMint(): PublicKey {
    return this.dynamicFogoMint ?? FOGO_MINT;
  }

  /**
   * Busca o estado global do jogo
   */
  async fetchGlobalState(): Promise<GlobalState | null> {
    try {
      const [globalStatePDA] = getGlobalStatePDA();
      const globalState = await (this.program.account as unknown as ProgramAccountMap).globalState.fetch(
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
      const playerState = await (this.program.account as unknown as ProgramAccountMap).playerState.fetch(
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
      const [riverFishConfigPDA] = getRiverFishConfigPDA();
      const [riverFishStatePDA] = getRiverFishStatePDA(this.walletPublicKey);

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
          riverFishConfig: riverFishConfigPDA,
          riverFishState: riverFishStatePDA,
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

      // Carrega mints do GlobalState (cache após primeira chamada)
      await this.loadMintsFromGlobalState();

      // Calcula PDAs
      const [globalStatePDA] = getGlobalStatePDA();
      const [configPDA] = getConfigPDA();
      const [playerStatePDA] = getPlayerStatePDA(this.walletPublicKey);
      const [programSignerPDA] = getProgramSignerPDA();

      // Calcula ATA do FOGO token para o owner
      const ownerFogoAta = getAssociatedTokenAddressSync(this.fogoMint, this.walletPublicKey);

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
          fogoMint: this.fogoMint,
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
   * Garante que a FOGO ATA existe para o owner wallet.
   * Se não existir, cria usando SOL da session key.
   */
  private async ensureFogoAtaExists(): Promise<boolean> {
    const ownerFogoAta = getAssociatedTokenAddressSync(this.fogoMint, this.walletPublicKey);

    try {
      const ataInfo = await this.connection.getAccountInfo(ownerFogoAta);
      if (ataInfo) {
        return true; // ATA já existe
      }
    } catch {
      // Erro ao verificar, tenta criar
    }

    this.logger.warn("⚠️ FOGO ATA não existe. Criando...");

    // Verifica se a session key tem SOL para pagar rent (~0.002 SOL)
    const sessionBalance = await this.connection.getBalance(this.signerPublicKey);
    const RENT_COST = 2_039_280; // lamports (~0.00204 SOL)
    const TX_FEE = 5_000; // lamports

    if (sessionBalance < RENT_COST + TX_FEE) {
      this.logger.error(
        `❌ Session key não tem SOL suficiente para criar FOGO ATA. ` +
        `Precisa de ~0.003 SOL. Balance: ${sessionBalance / 1e9} SOL. ` +
        `Envie SOL para a session key: ${this.signerPublicKey.toBase58()}`
      );
      return false;
    }

    try {
      const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        this.signerPublicKey, // payer (session key paga o rent)
        ownerFogoAta,         // ATA a criar
        this.walletPublicKey, // owner da ATA
        this.fogoMint,        // mint (dinâmico do GlobalState)
      );

      const { blockhash } = await this.connection.getLatestBlockhash();
      const Transaction = require("@solana/web3.js").Transaction;
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = this.signerPublicKey; // session key paga
      tx.add(createAtaIx);
      tx.sign(this.wallet.payer);

      const sig = await this.connection.sendRawTransaction(tx.serialize());
      await this.connection.confirmTransaction(sig, "confirmed");

      this.logger.success(`✅ FOGO ATA criada! Sig: ${sig.slice(0, 12)}...`);
      return true;
    } catch (error: any) {
      this.logger.error("❌ Erro ao criar FOGO ATA:", error.message || error);
      return false;
    }
  }

  async startUpgrade(targetLevel: number): Promise<string | null> {
    try {
      this.logger.info(`🔨 Iniciando upgrade para level ${targetLevel}...`);

      // Garante que a FOGO ATA existe (criada durante initialize_player, mas pode não existir)
      const fogoAtaReady = await this.ensureFogoAtaExists();
      if (!fogoAtaReady) {
        this.logger.error("❌ Não foi possível garantir a FOGO ATA. Upgrade cancelado.");
        return null;
      }

      // Calcula PDAs
      const [globalStatePDA] = getGlobalStatePDA();
      const [configPDA] = getConfigPDA();
      const [playerStatePDA] = getPlayerStatePDA(this.walletPublicKey);
      const [programSignerPDA] = getProgramSignerPDA();

      // Carrega mints dinâmicos do GlobalState on-chain
      await this.loadMintsFromGlobalState();

      // Calcula ATAs do owner para FISH e FOGO (usando mints dinâmicos)
      const ownerFishAta = getAssociatedTokenAddressSync(this.fishMint, this.walletPublicKey);
      const ownerFogoAta = getAssociatedTokenAddressSync(this.fogoMint, this.walletPublicKey);

      // Cria a instrução de capability (autenticação)
      const capabilityIx = await createCapabilityInstruction(this.walletPublicKey, this.logger);

      // Cria a instrução de start_upgrade
      // @ts-ignore
      const upgradeIx = await this.program.methods
        .startUpgrade(this.walletPublicKey, targetLevel)
        .accounts({
          signer: this.signerPublicKey,
          globalState: globalStatePDA,
          config: configPDA,
          playerState: playerStatePDA,
          fishMint: this.fishMint,
          ownerFishAta: ownerFishAta,
          fogoMint: this.fogoMint,
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
        units: CU_LIMITS.START_UPGRADE,
      });

      // Busca o sponsor
      const sponsor = await getSponsor(this.logger);

      // Monta a transação: [CU, Capability, StartUpgrade] (mesmo padrão do jogo)
      const { blockhash } = await this.connection.getLatestBlockhash();

      const Transaction = require("@solana/web3.js").Transaction;
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sponsor;

      tx.add(computeUnitIx);
      tx.add(capabilityIx);
      tx.add(upgradeIx);

      tx.sign(this.wallet.payer);

      const signature = await sendTransactionViaPaymaster(tx, sponsor, this.logger);

      this.logger.success(`🔨 Upgrade iniciado! Level ${targetLevel} | Sig: ${signature.slice(0, 12)}...`);
      return signature;
    } catch (error: any) {
      this.logger.error("Erro ao iniciar upgrade:", error.message || error);
      return null;
    }
  }

  /**
   * Finaliza upgrade da vara (após requisito de casts atingido)
   */
  async finishUpgrade(): Promise<string | null> {
    try {
      this.logger.info("🔨 Finalizando upgrade...");

      // Calcula PDAs
      const [globalStatePDA] = getGlobalStatePDA();
      const [playerStatePDA] = getPlayerStatePDA(this.walletPublicKey);

      // Cria a instrução de finish_upgrade
      // NOTA: finish_upgrade NÃO usa capability instruction (diferente de cast/start_upgrade)
      // @ts-ignore
      const finishIx = await this.program.methods
        .finishUpgrade(this.walletPublicKey)
        .accounts({
          signer: this.signerPublicKey,
          globalState: globalStatePDA,
          playerState: playerStatePDA,
        })
        .instruction();

      // Adiciona compute unit limit
      const computeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: CU_LIMITS.FINISH_UPGRADE,
      });

      // Busca o sponsor
      const sponsor = await getSponsor(this.logger);

      // Monta a transação
      const { blockhash } = await this.connection.getLatestBlockhash();

      const Transaction = require("@solana/web3.js").Transaction;
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sponsor;

      tx.add(computeUnitIx);
      tx.add(finishIx);

      tx.sign(this.wallet.payer);

      const signature = await sendTransactionViaPaymaster(tx, sponsor, this.logger);

      this.logger.success(`🔨 Upgrade finalizado! Sig: ${signature.slice(0, 12)}...`);
      return signature;
    } catch (error: any) {
      this.logger.error("Erro ao finalizar upgrade:", error.message || error);
      return null;
    }
  }

  /**
   * Busca o RiverFishState do player (inventario de iscas)
   */
  async fetchRiverFishState(): Promise<RiverFishState | null> {
    try {
      const [riverFishStatePDA] = getRiverFishStatePDA(this.walletPublicKey);
      const state = await (this.program.account as unknown as ProgramAccountMap).riverFishState.fetch(riverFishStatePDA);

      return {
        owner: (state.owner as PublicKey).toBase58(),
        activeBait: state.activeBait as number,
        remainingCasts: (state.remainingCasts as number[]).map(Number),
      };
    } catch (error: any) {
      if (error.message?.includes("Account does not exist")) {
        return null;
      }
      this.logger.error("Erro ao buscar river fish state:", error.message || error);
      return null;
    }
  }

  /**
   * Busca saldos da wallet do bot (FOGO nativo, FISH token, USDC token)
   */
  async fetchBalances(): Promise<{ fogo: number; fish: number; usdc: number } | null> {
    try {
      await this.loadMintsFromGlobalState();

      const fogoBalance = await this.connection.getBalance(this.walletPublicKey);

      let fishBalance = 0;
      try {
        const fishAta = getAssociatedTokenAddressSync(this.fishMint, this.walletPublicKey);
        const fishAccount = await this.connection.getTokenAccountBalance(fishAta);
        fishBalance = fishAccount.value.uiAmount || 0;
      } catch {}

      let usdcBalance = 0;
      try {
        const usdcAta = getAssociatedTokenAddressSync(this.fogoMint, this.walletPublicKey);
        const usdcAccount = await this.connection.getTokenAccountBalance(usdcAta);
        usdcBalance = usdcAccount.value.uiAmount || 0;
      } catch {}

      return {
        fogo: fogoBalance / LAMPORTS_PER_SOL,
        fish: fishBalance,
        usdc: usdcBalance,
      };
    } catch (error: any) {
      this.logger.error("Erro ao buscar balances:", error.message || error);
      return null;
    }
  }

  /**
   * Busca custos dinâmicos das baits (on-chain, escalados por dificuldade)
   * Retorna custo real em FISH e USDC para cada bait ID (1-10)
   */
  async fetchBaitDynamicCosts(): Promise<Record<number, { fishCost: number; usdcFee: number }> | null> {
    try {
      const [riverFishConfigPDA] = getRiverFishConfigPDA();
      const [globalStatePDA] = getGlobalStatePDA();
      const [config, globalState] = await Promise.all([
        (this.program.account as unknown as ProgramAccountMap).riverFishConfig.fetch(riverFishConfigPDA),
        (this.program.account as unknown as ProgramAccountMap).globalState.fetch(globalStatePDA),
      ]);

      const diffRef = Number((config as any).difficultyRef.toString());
      const curDiff = Number(globalState.currentDifficulty.toString());
      if (diffRef <= 0 || curDiff <= 0) return null;

      const costs: Record<number, { fishCost: number; usdcFee: number }> = {};
      for (let i = 0; i < 10; i++) {
        const b = (config.baits as any[])[i];
        const refCostLamports = Number(b.fishCostAtRefDifficulty.toString());
        const usdcFeeLamports = Number(b.usdcFee.toString());
        const actualFishLamports = Math.round(refCostLamports * diffRef / curDiff);
        costs[i + 1] = {
          fishCost: actualFishLamports / 1_000_000, // lamports -> FISH
          usdcFee: usdcFeeLamports / 1_000_000,     // lamports -> USDC
        };
      }
      return costs;
    } catch (error: any) {
      this.logger.error("Erro ao buscar bait dynamic costs:", error.message || error);
      return null;
    }
  }

  /**
   * Compra isca (queima FISH + USDC fee)
   */
  async buyRiverBait(baitType: number, quantity: number = 1): Promise<string | null> {
    try {
      this.logger.info(`🪱 Comprando isca tipo ${baitType} (qty: ${quantity})...`);

      await this.loadMintsFromGlobalState();

      const [globalStatePDA] = getGlobalStatePDA();
      const [configPDA] = getConfigPDA();
      const [playerStatePDA] = getPlayerStatePDA(this.walletPublicKey);
      const [riverFishConfigPDA] = getRiverFishConfigPDA();
      const [riverFishStatePDA] = getRiverFishStatePDA(this.walletPublicKey);
      const [programSignerPDA] = getProgramSignerPDA();

      const ownerFishAta = getAssociatedTokenAddressSync(this.fishMint, this.walletPublicKey);
      const ownerFogoAta = getAssociatedTokenAddressSync(this.fogoMint, this.walletPublicKey);

      const capabilityIx = await createCapabilityInstruction(this.walletPublicKey, this.logger);

      // @ts-ignore
      const buyIx = await this.program.methods
        .buyRiverBait(this.walletPublicKey, baitType, quantity)
        .accounts({
          signer: this.signerPublicKey,
          ownerAccount: this.walletPublicKey,
          globalState: globalStatePDA,
          config: configPDA,
          playerState: playerStatePDA,
          riverFishConfig: riverFishConfigPDA,
          riverFishState: riverFishStatePDA,
          fishMint: this.fishMint,
          ownerFishAta: ownerFishAta,
          fogoMint: this.fogoMint,
          ownerFogoAta: ownerFogoAta,
          buybackTreasury: BUYBACK_TREASURY,
          liquidityTreasury: LIQUIDITY_TREASURY,
          opsTreasury: OPS_TREASURY,
          programSigner: programSignerPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .instruction();

      const computeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: CU_LIMITS.BUY_RIVER_BAIT,
      });

      const sponsor = await getSponsor(this.logger);

      const { blockhash } = await this.connection.getLatestBlockhash();
      const Transaction = require("@solana/web3.js").Transaction;
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sponsor;

      tx.add(computeUnitIx);
      tx.add(capabilityIx);
      tx.add(buyIx);

      tx.sign(this.wallet.payer);

      const signature = await sendTransactionViaPaymaster(tx, sponsor, this.logger);

      this.logger.success(`🪱 Isca comprada! Tipo ${baitType} x${quantity} | Sig: ${signature.slice(0, 12)}...`);
      return signature;
    } catch (error: any) {
      this.logger.error("Erro ao comprar isca:", error.message || error);
      return null;
    }
  }

  /**
   * Equipa/desativa isca (0 = desativa)
   */
  async setActiveRiverBait(baitType: number): Promise<string | null> {
    try {
      this.logger.info(`🪱 ${baitType === 0 ? 'Desativando' : `Equipando isca tipo ${baitType}`}...`);

      const [playerStatePDA] = getPlayerStatePDA(this.walletPublicKey);
      const [riverFishConfigPDA] = getRiverFishConfigPDA();
      const [riverFishStatePDA] = getRiverFishStatePDA(this.walletPublicKey);

      // @ts-ignore
      const equipIx = await this.program.methods
        .setActiveRiverBait(this.walletPublicKey, baitType)
        .accounts({
          signer: this.signerPublicKey,
          playerState: playerStatePDA,
          riverFishConfig: riverFishConfigPDA,
          riverFishState: riverFishStatePDA,
        })
        .instruction();

      const computeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: CU_LIMITS.SET_ACTIVE_RIVER_BAIT,
      });

      const sponsor = await getSponsor(this.logger);

      const { blockhash } = await this.connection.getLatestBlockhash();
      const Transaction = require("@solana/web3.js").Transaction;
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sponsor;

      tx.add(computeUnitIx);
      tx.add(equipIx);

      tx.sign(this.wallet.payer);

      const signature = await sendTransactionViaPaymaster(tx, sponsor, this.logger);

      this.logger.success(`🪱 Isca ${baitType === 0 ? 'desativada' : `tipo ${baitType} equipada`}! Sig: ${signature.slice(0, 12)}...`);
      return signature;
    } catch (error: any) {
      this.logger.error("Erro ao equipar isca:", error.message || error);
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

    while (true) {
      try {
        castCount++;

        const signature = await this.castLine(false);

        if (signature) {
          successCount++;

          // Registra o cast como pendente (não bloqueia)
          this.logMonitor.registerCast(signature);

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
