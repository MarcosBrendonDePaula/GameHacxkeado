# 🎣 Fogo Fishing Bot

Bot automatizado em TypeScript para o jogo Fogo Fishing. Executa casts (pescas) automaticamente usando Bun runtime.

## ✨ Funcionalidades

- ✅ **Auto-cast automático** com delay configurável
- ✅ **Verificação de resultados** - Mostra CATCH vs MISS após cada pescaria
- ✅ **Estatísticas em tempo real** - Catches, misses, fish total, taxa de sucesso
- ✅ **Suporte a Proxy** - HTTP, HTTPS e SOCKS5
- ✅ **Multi-Bot** - Execute múltiplas contas simultaneamente
- ✅ **Paymaster integrado** - Transações sem necessidade de SOL
- ✅ **Sistema de capability** para autenticação

## 📋 Pré-requisitos

- [Bun](https://bun.sh/) instalado
- Conta de jogador já inicializada no Fogo Fishing
- (Opcional) Proxy HTTP/HTTPS/SOCKS5

**Nota**: Não é necessário ter SOL na wallet! O bot usa um sistema de paymaster que paga as taxas.

## 🚀 Instalação

```bash
bun install
```

## 🎮 Como Usar

O bot funciona com um sistema de contas configurado em `accounts.json`. Você pode rodar **uma** ou **várias** contas simultaneamente!

### 1️⃣ Configuração Inicial

Crie o arquivo de configuração:
```bash
copy accounts.example.json accounts.json
```

### 2️⃣ Configure suas Contas

Edite `accounts.json`:

**Para uma única conta:**
```json
[
  {
    "name": "Minha Conta",
    "enabled": true,
    "keypair_path": "./wallets/wallet1.json",
    "proxy": "http://2.56.249.17:50100",
    "delay": 500
  }
]
```

**Para múltiplas contas:**
```json
[
  {
    "name": "Conta 1",
    "enabled": true,
    "keypair_path": "./wallets/wallet1.json",
    "proxy": "http://2.56.249.17:50100",
    "delay": 500
  },
  {
    "name": "Conta 2",
    "enabled": true,
    "keypair_path": "./wallets/wallet2.json",
    "proxy": "http://2.56.249.17:50100",
    "delay": 600
  },
  {
    "name": "Conta 3",
    "enabled": false,
    "keypair_path": "./wallets/wallet3.json",
    "delay": 500
  }
]
```

### 3️⃣ Execute o Bot

```bash
# Forma simples
bun run start

# Ou especifique um arquivo diferente
bun run start my-accounts.json

# Com auto-reload (modo desenvolvimento)
bun run dev
```

📖 **[Ver documentação completa do Multi-Bot](MULTI-BOT.md)**

### Modo Individual (Legado)

Se você preferir o modo antigo (uma conta via linha de comando):

```bash
bun run single ./wallet.json

# Com opções
bun run single ./wallet.json --delay 1000
```

## 📊 O que o Bot Mostra

```
--- Cast #5 ---
🐟 CATCH! +2,750,259 fish
📊 5/5 (100.0%) | 🐟 3 catches (60.0%) | 🔴 2 misses | Total: 8,345,678 fish
```

- **Taxa de sucesso**: Quantos casts foram enviados com sucesso
- **Catches vs Misses**: Quantas pescarias resultaram em peixe
- **Total pescado**: Quantidade total de fish capturado na sessão

📖 **[Ver documentação completa de Verificação de Resultados](VERIFICACAO-RESULTADOS.md)**

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
│   │   ├── helpers.ts      # Funções auxiliares
│   │   ├── capability.ts   # Sistema de autenticação
│   │   ├── paymaster.ts    # Integração com paymaster
│   │   └── proxy.ts        # Suporte a proxy
│   ├── services/
│   │   └── fishing.ts      # Serviço principal de pesca
│   ├── index.ts            # Bot individual
│   └── multi-bot.ts        # Multi-bot runner
├── accounts.example.json   # Exemplo de configuração multi-bot
├── MULTI-BOT.md           # Documentação do multi-bot
├── PROXY.md               # Documentação de proxy
├── VERIFICACAO-RESULTADOS.md  # Documentação de verificação
└── README.md
```

## 🔑 Configurando sua Wallet

### Opção 1: Exportar da Phantom/Solflare

1. Vá nas configurações da sua wallet
2. Exporte a chave privada
3. Salve como um arquivo JSON no formato: `[123,45,67,...]`

### Opção 2: Usar Solana CLI

```bash
solana-keygen new --outfile ./wallet.json
```

### Organização (Recomendado para Multi-Bot)

Crie uma pasta `wallets/` para organizar:
```
fishing-bot/
├── accounts.json
├── wallets/
│   ├── wallet1.json
│   ├── wallet2.json
│   └── wallet3.json
```

⚠️ **IMPORTANTE**: Nunca compartilhe suas keypairs! A pasta `wallets/` está no `.gitignore`

## 🧪 Scripts de Teste

### Testar um único cast
```bash
bun run test-cast-result.ts wallet.json
```

### Testar proxy
```bash
set HTTP_PROXY=http://2.56.249.17:50100
set HTTPS_PROXY=http://2.56.249.17:50100
bun run test-proxy.ts http://2.56.249.17:50100
```

## ⚙️ Configuração Avançada

Edite `src/config/constants.ts`:

```typescript
export const BOT_CONFIG = {
  autocast_delay: 500,  // Delay entre casts (ms)
  rpc_endpoint: "https://eu.fogo.fluxrpc.com/?key=...",
  max_retries: 3,
  transaction_timeout: 60,
};
```

## 🔍 Logs Detalhados

### Console (Tempo Real)

```
🤖 BOT-1 [Conta 1 - Bot A] Iniciando...
🤖 BOT-1 [Conta 1 - Bot A] 📝 Log sendo gravado em: logs/bot-1-conta-1-bot-a.log
🤖 BOT-1 [Conta 1 - Bot A] Wallet: 2Y2fq8xv...jyX8h
🤖 BOT-1 [Conta 1 - Bot A] 🐟 CATCH! +2,750,259 fish
🤖 BOT-2 [Conta 1 - Bot B] 🔴 MISS
```

### Arquivos de Log (Permanentes)

Cada bot grava seus logs em `logs/bot-X-nome.log`:

```
logs/
├── bot-1-conta-1-bot-a.log
├── bot-2-conta-1-bot-b.log
└── bot-3-farm-principal.log
```

Ver logs em tempo real:
```bash
# Linux/Mac
tail -f logs/bot-1-conta-1-bot-a.log

# Windows PowerShell
Get-Content logs/bot-1-conta-1-bot-a.log -Wait -Tail 50
```

📖 **[Ver documentação completa de Logs](LOGS.md)**

## 🌐 Usando Proxy

O bot suporta HTTP, HTTPS e SOCKS5:

```bash
# HTTP
set HTTP_PROXY=http://2.56.249.17:50100
set HTTPS_PROXY=http://2.56.249.17:50100

# HTTP com autenticação
set HTTP_PROXY=http://user:pass@proxy.com:8080

# SOCKS5
set HTTP_PROXY=socks5://proxy.com:1080
```

📖 **[Documentação completa de Proxy](PROXY.md)**

## ⚠️ Avisos Importantes

1. **Não precisa SOL**: O bot usa paymaster, não precisa ter SOL na wallet
2. **Durabilidade**: Monitore a durabilidade da vara (o bot avisa quando está em 0)
3. **Proxies**: Use proxies diferentes para cada conta no multi-bot
4. **Segurança**: NUNCA compartilhe suas keypairs ou commit no git
5. **Backup**: Faça backup do seu `accounts.json`

## 🛠️ Troubleshooting

### "Conta de jogador não encontrada"
Você precisa inicializar sua conta no jogo primeiro. Acesse o jogo no navegador e crie sua conta.

### "Transaction fee payer must be one of the sponsors"
Isso é normal, o bot já corrige automaticamente usando o sistema de paymaster.

### "Durabilidade em 0"
Seu rod precisa de reparo. Faça isso manualmente no jogo.

### Proxy não está funcionando
Certifique-se de usar as variáveis de ambiente `HTTP_PROXY` e `HTTPS_PROXY`:
```bash
set HTTP_PROXY=http://2.56.249.17:50100
set HTTPS_PROXY=http://2.56.249.17:50100
```

### Multi-bot não inicia
Verifique se o `accounts.json` existe e tem pelo menos uma conta com `"enabled": true`.

## 📚 Documentação Completa

- **[MULTI-BOT.md](MULTI-BOT.md)** - Sistema de múltiplas contas
- **[PROXY.md](PROXY.md)** - Configuração de proxy
- **[VERIFICACAO-RESULTADOS.md](VERIFICACAO-RESULTADOS.md)** - Sistema de verificação de catches
- **[LOGS.md](LOGS.md)** - Sistema de logs por arquivo

## 📝 Licença

Este projeto é apenas para fins educacionais. Use por sua conta e risco.

## 🤝 Contribuindo

Sinta-se livre para abrir issues ou pull requests!

---

**Feito com ❤️ usando Bun e TypeScript**
