# Como Usar Proxy no Bot

✅ **TESTADO E FUNCIONANDO** - O proxy está corretamente configurado!

## Seu Proxy

```
IP: 2.56.249.17
Porta: 50100
Tipo: HTTP
Auth: Por IP (sem usuário/senha)
```

## ⭐ Método Recomendado: Scripts Prontos

### Windows

```cmd
run-with-proxy.bat wallet.json
```

### Linux/Mac

```bash
chmod +x run-with-proxy.sh
./run-with-proxy.sh wallet.json
```

## Métodos Alternativos

### Método 1: Variáveis de Ambiente (FUNCIONA ✅)

```bash
# Windows (CMD)
set HTTP_PROXY=http://2.56.249.17:50100
set HTTPS_PROXY=http://2.56.249.17:50100
bun run src/index.ts wallet.json

# Windows (PowerShell)
$env:HTTP_PROXY="http://2.56.249.17:50100"
$env:HTTPS_PROXY="http://2.56.249.17:50100"
bun run src/index.ts wallet.json

# Linux/Mac
export HTTP_PROXY=http://2.56.249.17:50100
export HTTPS_PROXY=http://2.56.249.17:50100
bun run src/index.ts wallet.json
```

### Método 2: Inline (uma única linha)

```bash
# Windows (PowerShell)
$env:HTTP_PROXY="http://2.56.249.17:50100"; $env:HTTPS_PROXY="http://2.56.249.17:50100"; bun run src/index.ts wallet.json

# Linux/Mac
HTTP_PROXY=http://2.56.249.17:50100 HTTPS_PROXY=http://2.56.249.17:50100 bun run src/index.ts wallet.json
```

## 🧪 Testar o Proxy

Para verificar se o proxy está funcionando:

```bash
# Windows
set HTTP_PROXY=http://2.56.249.17:50100
set HTTPS_PROXY=http://2.56.249.17:50100
bun run test-proxy.ts http://2.56.249.17:50100

# Linux/Mac
HTTP_PROXY=http://2.56.249.17:50100 HTTPS_PROXY=http://2.56.249.17:50100 bun run test-proxy.ts http://2.56.249.17:50100
```

**Resultado esperado:**
```
✅ IP detectado: 2.56.249.17
```

Se mostrar outro IP, o proxy NÃO está sendo usado!

## Outros Formatos de Proxy

### HTTP/HTTPS com autenticação
```bash
export HTTP_PROXY=http://usuario:senha@proxy.com:8080
export HTTPS_PROXY=http://usuario:senha@proxy.com:8080
```

### SOCKS5
```bash
export HTTP_PROXY=socks5://proxy.com:1080
export HTTPS_PROXY=socks5://proxy.com:1080
```

### SOCKS5 com autenticação
```bash
export HTTP_PROXY=socks5://usuario:senha@proxy.com:1080
export HTTPS_PROXY=socks5://usuario:senha@proxy.com:1080
```

## Verificação

Quando você roda o teste, deve ver:

```
✅ IP detectado: 2.56.249.17 ← Seu proxy
✅ RPC respondeu: {"jsonrpc":"2.0","id":1,"result":"ok"}
✅ Capability service respondeu
✅ Paymaster respondeu
```

## Observações Importantes

- ✅ **O proxy funciona APENAS via variáveis de ambiente HTTP_PROXY/HTTPS_PROXY**
- ❌ O argumento `--proxy` NÃO funciona (limitação do Bun)
- ✅ Use os scripts `run-with-proxy.bat` ou `run-with-proxy.sh` que já configuram tudo
- O proxy é usado para TODAS as requisições:
  - ✅ Conexão RPC Solana
  - ✅ Capability service
  - ✅ Paymaster service
- Se o proxy falhar, o bot mostrará erros de conexão
- Para voltar a usar sem proxy, simplesmente não defina as variáveis de ambiente
