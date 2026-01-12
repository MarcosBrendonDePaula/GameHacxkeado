# 📖 Exemplo de Uso

## Gerando uma Keypair de Teste

Se você não tem uma keypair ainda, pode gerar uma para teste:

```bash
# Usando Solana CLI
solana-keygen new --outfile ./test-wallet.json

# Ou usando Node.js/Bun (criar um arquivo generate-keypair.ts):
```

### generate-keypair.ts

```typescript
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";

const keypair = Keypair.generate();
const secretKey = Array.from(keypair.secretKey);

fs.writeFileSync(
  "./test-wallet.json",
  JSON.stringify(secretKey),
  "utf-8"
);

console.log("Keypair gerada!");
console.log("Public Key:", keypair.publicKey.toBase58());
console.log("Arquivo salvo em: ./test-wallet.json");
```

Execute:
```bash
bun run generate-keypair.ts
```

⚠️ **IMPORTANTE**: Esta keypair é apenas para TESTES! Não envie SOL real para ela sem antes fazer backup adequado.

## Exemplo de Execução Completa

### 1. Prepare sua Wallet

```bash
# Gere uma keypair (se ainda não tiver)
bun run generate-keypair.ts

# Veja o endereço público
solana address -k ./test-wallet.json
```

### 2. Adicione SOL (Devnet para Testes)

```bash
# Se estiver usando devnet
solana airdrop 2 $(solana address -k ./test-wallet.json) --url devnet
```

### 3. Execute o Bot

```bash
# Execução básica
bun run src/index.ts ./test-wallet.json

# Com delay personalizado (1 segundo entre casts)
bun run src/index.ts ./test-wallet.json --delay 1000

# Com RPC customizado
bun run src/index.ts ./test-wallet.json --rpc https://api.devnet.solana.com
```

## Exemplo de Output Esperado

```
============================================================
🎮 BOT [2026-01-11T...] 🎣 FOGO FISHING BOT - Versão 1.0
============================================================
🎮 BOT [2026-01-11T...] 📁 Carregando keypair de: ./test-wallet.json
🎮 BOT [2026-01-11T...] 👛 Wallet: AbC...XyZ
🎮 BOT [2026-01-11T...] 🌐 RPC: https://api.mainnet-beta.solana.com
🎮 BOT [2026-01-11T...] ⏱️  Auto-cast delay: 500ms
============================================================
🎮 BOT [2026-01-11T...] 📊 Buscando estado do jogo...
🎮 BOT [2026-01-11T...] 🌍 Dificuldade: 1000000
🎮 BOT [2026-01-11T...] 🐟 Total FISH mintado: 50000000

🎮 BOT [2026-01-11T...] 👤 Estado do Jogador:
🎮 BOT [2026-01-11T...]    🎣 Rod Level: 3
🎮 BOT [2026-01-11T...]    ⛵ Boat Tier: 1
🎮 BOT [2026-01-11T...]    ⚡ Power: 500
🎮 BOT [2026-01-11T...]    🔧 Durability: 280/300
🎮 BOT [2026-01-11T...]    📊 Casts totais: 1523
🎮 BOT [2026-01-11T...]    🐟 Peixes pescados: 987

============================================================
🎮 BOT [2026-01-11T...] 🚀 Iniciando bot...
🎮 BOT [2026-01-11T...] Pressione Ctrl+C para parar
============================================================
🎣 FISHING [2026-01-11T...] 🚀 Iniciando auto-cast...
🎣 FISHING [2026-01-11T...] ⏱️  Delay entre casts: 500ms
🎣 FISHING [2026-01-11T...] 🎣 Rod Level: 3
🎣 FISHING [2026-01-11T...] ⚡ Power: 500
🎣 FISHING [2026-01-11T...] 🔧 Durability: 280/300

🎣 FISHING [2026-01-11T...]
--- Cast #1 ---
🎣 FISHING [2026-01-11T...] 🔍 Preparando cast...
🎣 FISHING [2026-01-11T...] 🔍 Slot: 234567890
🎣 FISHING [2026-01-11T...] 🔍 Supercast: false
🎣 FISHING [2026-01-11T...] ✅ Cast realizado! Sig: 5Kx...abc
🎣 FISHING [2026-01-11T...] ✅ Sucessos: 1/1
🎣 FISHING [2026-01-11T...] 🔍 Aguardando 500ms...

🎣 FISHING [2026-01-11T...]
--- Cast #2 ---
...
```

## Monitorando Transações

Você pode monitorar as transações no Solana Explorer:

```
https://explorer.solana.com/tx/<SIGNATURE>?cluster=mainnet
```

Ou se estiver em devnet:
```
https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet
```

## Parando o Bot

Para parar o bot de forma segura, pressione:
- Windows/Linux: `Ctrl+C`
- Mac: `Cmd+C`

O bot vai finalizar a transação atual antes de parar.

## Dicas

1. **Comece com delay alto**: Use `--delay 2000` (2 segundos) no início para ver se está funcionando
2. **Monitore a durabilidade**: O bot não para sozinho quando acaba a durabilidade
3. **Use logs para debug**: Se algo der errado, os logs vão mostrar o erro exato
4. **Teste em devnet primeiro**: Se possível, teste em devnet antes de usar em mainnet

## Troubleshooting Comum

### Erro: "Conta de jogador não encontrada"
**Solução**: Acesse o jogo no navegador e inicialize sua conta primeiro

### Erro: "Insufficient funds"
**Solução**: Adicione mais SOL à sua wallet para pagar as taxas de transação

### Erro: "Durabilidade em 0"
**Solução**: Repare sua vara no jogo manualmente

### Erro: "RPC endpoint não responde"
**Solução**: Tente usar outro RPC endpoint com `--rpc`

## Scripts Úteis

### Ver saldo da wallet
```bash
solana balance -k ./test-wallet.json
```

### Ver histórico de transações
```bash
solana transaction-history $(solana address -k ./test-wallet.json) --limit 10
```

### Transferir SOL para a wallet
```bash
solana transfer <DESTINO> <QUANTIDADE> -k ./sua-wallet-com-saldo.json
```
