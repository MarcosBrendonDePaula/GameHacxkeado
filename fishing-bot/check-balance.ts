#!/usr/bin/env bun

/**
 * Script rápido para verificar o saldo de SOL da wallet
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { BOT_CONFIG } from "./src/config/constants";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Uso: bun run check-balance.ts <caminho-para-keypair.json>");
  process.exit(1);
}

const keypairArg = args[0];
if (!keypairArg) {
  throw new Error("Caminho da keypair não informado");
}

const keypairPath = path.resolve(keypairArg);
const secretKeyString = fs.readFileSync(keypairPath, "utf-8");
const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
const keypair = Keypair.fromSecretKey(secretKey);

console.log("🔍 Verificando saldo...");
console.log("Wallet:", keypair.publicKey.toBase58());

const connection = new Connection(BOT_CONFIG.rpc_endpoint, "confirmed");

const balance = await connection.getBalance(keypair.publicKey);
const balanceSOL = balance / LAMPORTS_PER_SOL;

console.log("\n💰 Saldo:");
console.log(`   ${balance} lamports`);
console.log(`   ${balanceSOL.toFixed(9)} SOL`);

if (balanceSOL < 0.001) {
  console.log("\n⚠️  AVISO: Saldo muito baixo!");
  console.log("Você precisa de pelo menos 0.001 SOL para fazer transações.");
  console.log("Adicione mais SOL à sua wallet.");
} else if (balanceSOL < 0.01) {
  console.log("\n⚠️  Saldo baixo. Considere adicionar mais SOL.");
} else {
  console.log("\n✅ Saldo suficiente para fazer transações.");
}
