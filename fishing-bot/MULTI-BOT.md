# 🎣 Sistema de Contas (Multi-Bot)

Este é o **sistema principal do bot**. Você pode rodar uma ou várias contas simultaneamente!

## 🚀 Como Usar

### 1. Crie o arquivo de configuração

Copie o exemplo:
```bash
cp accounts.example.json accounts.json
```

Ou no Windows:
```cmd
copy accounts.example.json accounts.json
```

### 2. Configure suas contas

Edite `accounts.json`:

```json
[
  {
    "name": "Conta Principal",
    "enabled": true,
    "keypair_path": "./wallets/wallet1.json",
    "proxy": "http://2.56.249.17:50100",
    "delay": 500
  },
  {
    "name": "Conta Secundária",
    "enabled": true,
    "keypair_path": "./wallets/wallet2.json",
    "proxy": "http://2.56.249.17:50100",
    "delay": 600
  },
  {
    "name": "Conta Teste (Desabilitada)",
    "enabled": false,
    "keypair_path": "./wallets/wallet3.json",
    "delay": 500
  }
]
```

### 3. Execute o bot

```bash
# Forma simples (usa accounts.json)
bun run start

# Ou especifique um arquivo diferente
bun run start my-accounts.json

# Com auto-reload (modo desenvolvimento)
bun run dev

# Forma direta
bun run src/index.ts
```

## 📋 Formato do Arquivo de Configuração

Cada conta tem os seguintes campos:

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ✅ | Nome descritivo da conta |
| `enabled` | boolean | ✅ | Se o bot deve rodar (true/false) |
| `keypair_path` | string | ✅ | Caminho para o arquivo JSON da keypair |
| `proxy` | string | ❌ | URL do proxy para esta conta |
| `delay` | number | ❌ | Delay entre casts em ms (padrão: 500) |

### Exemplos de Proxy

```json
// HTTP
"proxy": "http://2.56.249.17:50100"

// HTTP com autenticação
"proxy": "http://user:pass@proxy.com:8080"

// SOCKS5
"proxy": "socks5://proxy.com:1080"

// SOCKS5 com autenticação
"proxy": "socks5://user:pass@proxy.com:1080"

// Sem proxy
// Simplesmente não inclua o campo "proxy"
```

## 📁 Organizando as Wallets

Crie uma pasta `wallets/` para organizar:

```
fishing-bot/
├── accounts.json
├── wallets/
│   ├── wallet1.json
│   ├── wallet2.json
│   ├── wallet3.json
│   └── wallet4.json
└── src/
```

**Importante:** A pasta `wallets/` está no `.gitignore` para não commitar suas chaves privadas!

## 🎯 Exemplo de Uso Real

### Cenário 1: 4 contas com o mesmo proxy

```json
[
  {
    "name": "Farm 1",
    "enabled": true,
    "keypair_path": "./wallets/farm1.json",
    "proxy": "http://2.56.249.17:50100",
    "delay": 500
  },
  {
    "name": "Farm 2",
    "enabled": true,
    "keypair_path": "./wallets/farm2.json",
    "proxy": "http://2.56.249.17:50100",
    "delay": 550
  },
  {
    "name": "Farm 3",
    "enabled": true,
    "keypair_path": "./wallets/farm3.json",
    "proxy": "http://2.56.249.17:50100",
    "delay": 600
  },
  {
    "name": "Farm 4",
    "enabled": true,
    "keypair_path": "./wallets/farm4.json",
    "proxy": "http://2.56.249.17:50100",
    "delay": 650
  }
]
```

### Cenário 2: Contas com proxies diferentes

```json
[
  {
    "name": "Conta US",
    "enabled": true,
    "keypair_path": "./wallets/us.json",
    "proxy": "http://us-proxy.com:8080",
    "delay": 500
  },
  {
    "name": "Conta EU",
    "enabled": true,
    "keypair_path": "./wallets/eu.json",
    "proxy": "http://eu-proxy.com:8080",
    "delay": 500
  },
  {
    "name": "Conta Asia",
    "enabled": true,
    "keypair_path": "./wallets/asia.json",
    "proxy": "socks5://asia-proxy.com:1080",
    "delay": 500
  }
]
```

### Cenário 3: Mix com e sem proxy

```json
[
  {
    "name": "Conta Principal (Com Proxy)",
    "enabled": true,
    "keypair_path": "./wallets/main.json",
    "proxy": "http://2.56.249.17:50100",
    "delay": 500
  },
  {
    "name": "Conta Local (Sem Proxy)",
    "enabled": true,
    "keypair_path": "./wallets/local.json",
    "delay": 500
  }
]
```

## 📊 Saída do Multi-Bot

Quando você executa o multi-bot, verá algo assim:

```
================================================================================
🎣 FOGO FISHING MULTI-BOT - Sistema de Múltiplas Contas
================================================================================
🎮 MULTI-BOT: ✅ 3 conta(s) habilitada(s) de 4 total
================================================================================
1. Farm 1
   Keypair: ./wallets/farm1.json
   Proxy: http://2.56.249.17:50100
   Delay: 500ms

2. Farm 2
   Keypair: ./wallets/farm2.json
   Proxy: http://2.56.249.17:50100
   Delay: 550ms

3. Farm 3
   Keypair: ./wallets/farm3.json
   Delay: 500ms

================================================================================
🎮 MULTI-BOT: 🚀 Iniciando todos os bots...
🎮 MULTI-BOT: Pressione Ctrl+C para parar todos
================================================================================

🤖 BOT-1 [Farm 1]: Iniciando...
🤖 BOT-2 [Farm 2]: Iniciando...
🤖 BOT-3 [Farm 3]: Iniciando...

🤖 BOT-1 [Farm 1]: Wallet: 2Y2fq8xv...jyX8h
🤖 BOT-1 [Farm 1]: Proxy: http://2.56.249.17:50100
🤖 BOT-1 [Farm 1]: Delay: 500ms

🤖 BOT-2 [Farm 2]: Wallet: 5Ks8mN2p...kL9a
🤖 BOT-2 [Farm 2]: Proxy: http://2.56.249.17:50100
🤖 BOT-2 [Farm 2]: Delay: 550ms

[... logs dos bots pescando ...]

🤖 BOT-1 [Farm 1]: 🐟 CATCH! +2750259 fish
🤖 BOT-2 [Farm 2]: 🔴 MISS
🤖 BOT-3 [Farm 3]: 🐟 CATCH! +3125432 fish
```

## 🔧 Dicas e Boas Práticas

### 1. Delays Diferentes
Use delays ligeiramente diferentes para cada conta para evitar sincronização:
```json
"delay": 500  // Bot 1
"delay": 550  // Bot 2
"delay": 600  // Bot 3
```

### 2. Teste Antes de Rodar Todos
Desabilite todas menos uma conta para testar:
```json
{ "enabled": true, ... }   // Apenas esta roda
{ "enabled": false, ... }  // Desabilitada
{ "enabled": false, ... }  // Desabilitada
```

### 3. Monitore a Durabilidade
Todas as contas precisam ter durabilidade na vara. O bot avisa quando está em 0.

### 4. Backup do accounts.json
Faça backup do seu `accounts.json`:
```bash
cp accounts.json accounts.backup.json
```

### 5. Proxies Rotativos
Se você tem múltiplos proxies, distribua entre as contas para melhor performance.

## ⚠️ Importante

- **NUNCA** commite o arquivo `accounts.json` - ele contém caminhos das suas wallets
- **NUNCA** commite a pasta `wallets/` - contém suas chaves privadas
- O arquivo `accounts.example.json` é seguro para commitar (é só um exemplo)
- Use proxies diferentes se possível para evitar rate limits

## 🎯 Vantagens do Sistema de Contas

✅ **Uma ou várias contas** no mesmo terminal
✅ **Configuração via JSON** - fácil de gerenciar
✅ **Proxy individual** por conta
✅ **Delay personalizado** por conta
✅ **Habilitar/desabilitar** facilmente (`enabled: true/false`)
✅ **Logs organizados** por bot (`🤖 BOT-1`, `🤖 BOT-2`, etc)
✅ **Gerenciamento centralizado** - todas as configurações em um arquivo

## 🐛 Troubleshooting

### Erro: "Arquivo de configuração não encontrado"
```bash
# Certifique-se que o arquivo existe
ls accounts.json

# Ou use o caminho completo
bun run src/multi-bot.ts ./accounts.json
```

### Erro: "Nenhuma conta habilitada"
```json
// Pelo menos uma conta precisa ter enabled: true
{
  "name": "Minha Conta",
  "enabled": true,  // ← Precisa ser true
  "keypair_path": "./wallet.json"
}
```

### Erro: "Arquivo não encontrado: ./wallets/wallet1.json"
```bash
# Verifique se o arquivo existe
ls wallets/wallet1.json

# Ou use caminho absoluto
"keypair_path": "C:/Users/Seu/caminho/wallet1.json"
```

### Bot não está usando proxy
```json
// Certifique-se que o campo proxy está correto
"proxy": "http://2.56.249.17:50100"  // ✅ Correto
"proxy": "2.56.249.17:50100"          // ❌ Falta http://
```

## 📝 Comandos Úteis

```bash
# Executar com arquivo padrão (accounts.json)
bun run start

# Executar com arquivo específico
bun run start my-accounts.json

# Com auto-reload (desenvolvimento)
bun run dev

# Ver ajuda
bun run start --help

# Executar em background (Linux/Mac)
nohup bun run start &

# Ver logs em tempo real (Linux/Mac)
tail -f nohup.out
```

## 🎉 Pronto!

Agora você pode gerenciar uma ou múltiplas contas de forma fácil e organizada!

**Próximos passos:**
1. Crie seu `accounts.json` baseado no exemplo
2. Adicione suas wallets na pasta `wallets/`
3. Configure os proxies se necessário
4. Execute: `bun run start`
5. Observe os logs de todas as contas simultaneamente!

**Dica**: Comece com apenas uma conta habilitada para testar, depois habilite as outras! 🎣
