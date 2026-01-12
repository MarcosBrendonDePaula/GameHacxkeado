# 🎣 Fogo Fishing Bot

Bot automatizado em TypeScript para o jogo Fogo Fishing. Executa casts (pescas) automaticamente usando Bun runtime.

## 📋 Pré-requisitos

- [Bun](https://bun.sh/) instalado
- Uma carteira Solana com SOL para taxas de transação
- Conta de jogador já inicializada no Fogo Fishing

## 🚀 Instalação

As dependências já foram instaladas. Se precisar reinstalar:

```bash
bun install
```

## 📁 Estrutura do Projeto

```
fishing-bot/
├── src/
│   ├── config/
│   │   ├── constants.ts    # Constantes e configurações
│   │   └── idl.ts          # IDL do programa Anchor
│   ├── types/
│   │   └── index.ts        # Tipos TypeScript
│   ├── utils/
│   │   ├── pda.ts          # Funções para calcular PDAs
│   │   └── helpers.ts      # Funções auxiliares
│   ├── services/
│   │   └── fishing.ts      # Serviço principal de pesca
│   └── index.ts            # Arquivo principal do bot
├── package.json
└── README.md
```

## 🔑 Configurando sua Wallet

Você precisa de um arquivo JSON com sua keypair Solana. Existem algumas formas de obter:

### Opção 1: Exportar da Phantom/Solflare

1. Vá nas configurações da sua wallet
2. Exporte a chave privada
3. Salve como um arquivo JSON no formato: `[123,45,67,...]`

### Opção 2: Usar Solana CLI

```bash
solana-keygen new --outfile ./wallet.json
```

⚠️ **IMPORTANTE**: Nunca compartilhe seu arquivo de keypair! Adicione-o ao `.gitignore`

## 🎮 Como Usar

### Uso Básico

```bash
bun run src/index.ts ./caminho/para/wallet.json
```

### Com Opções Personalizadas

```bash
# Delay personalizado entre casts (em ms)
bun run src/index.ts ./wallet.json --delay 1000

# RPC endpoint personalizado
bun run src/index.ts ./wallet.json --rpc https://api.mainnet-beta.solana.com

# Combinando opções
bun run src/index.ts ./wallet.json --delay 500 --rpc https://seu-rpc.com
```

### Opções Disponíveis

- `--delay <ms>`: Define o delay entre casts em milissegundos (padrão: 500ms)
- `--rpc <url>`: Define o endpoint RPC da Solana (padrão: https://api.mainnet-beta.solana.com)
- `--help`, `-h`: Mostra a ajuda

## ⚙️ Configuração

Edite `src/config/constants.ts` para ajustar:

```typescript
export const BOT_CONFIG = {
  // Delay entre casts em milissegundos
  autocast_delay: 500,

  // RPC endpoint oficial do Fogo Fishing
  rpc_endpoint: "https://eu.fogo.fluxrpc.com/?key=74a5f926-d7b0-4c72-9a5c-0eaec1a57781",

  // Máximo de tentativas em caso de erro
  max_retries: 3,

  // Timeout para transações (em segundos)
  transaction_timeout: 60,
};

// Headers customizados - simula requisições do navegador
export const CUSTOM_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0",
  "Referer": "https://app.fogofishing.com/",
  "Origin": "https://app.fogofishing.com",
  // ... outros headers
};
```

**Nota**: O bot já está configurado para usar o RPC oficial do Fogo Fishing com headers customizados que simulam um navegador. Isso ajuda a evitar bloqueios e rate limits.

## 📊 O que o Bot Faz

1. **Conecta** à blockchain Solana
2. **Verifica** o estado do jogador (rod level, durability, etc)
3. **Executa casts** automaticamente em loop
4. **Aguarda** o delay configurado entre cada cast
5. **Registra** sucessos e erros no console

## 🔍 Logs

O bot exibe informações detalhadas:

```
🎣 FISHING [2026-01-11T...] Wallet: ABC...XYZ
🎣 FISHING [2026-01-11T...] 📊 Buscando estado do jogo...
🎣 FISHING [2026-01-11T...] 🎣 Rod Level: 5
🎣 FISHING [2026-01-11T...] ⚡ Power: 1200
🎣 FISHING [2026-01-11T...] 🔧 Durability: 450/500
🎣 FISHING [2026-01-11T...] ✅ Cast realizado! Sig: abc123...
```

## ⚠️ Avisos Importantes

1. **SOL para Taxas**: Certifique-se de ter SOL suficiente na wallet para pagar as taxas de transação
2. **Durabilidade**: O bot não para automaticamente quando a durabilidade chega a 0. Monitore!
3. **Rate Limits**: Cuidado com rate limits do RPC. Use um RPC privado se necessário
4. **Segurança**: NUNCA compartilhe sua keypair ou commit ela no git

## 🛠️ Troubleshooting

### "Conta de jogador não encontrada"

Você precisa inicializar sua conta no jogo primeiro. Acesse o jogo no navegador e crie sua conta.

### "Erro de RPC"

Tente usar um RPC endpoint diferente:

```bash
bun run src/index.ts ./wallet.json --rpc https://solana-mainnet.g.alchemy.com/v2/YOUR-KEY
```

### "Durabilidade em 0"

Seu rod precisa de reparo. Faça isso manualmente no jogo por enquanto.

## 🔄 Próximas Funcionalidades

- [ ] Auto-repair quando durabilidade baixa
- [ ] Suporte a supercast automático
- [ ] Estatísticas detalhadas (taxa de sucesso, fish caught, etc)
- [ ] Notificações (Discord, Telegram)
- [ ] Interface web para monitoramento

## 📝 Licença

Este projeto é apenas para fins educacionais. Use por sua conta e risco.

## 🤝 Contribuindo

Sinta-se livre para abrir issues ou pull requests!

---

**Feito com ❤️ usando Bun e TypeScript**
