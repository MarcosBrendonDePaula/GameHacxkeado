# 📝 Sistema de Logs

Cada bot grava seus logs em um arquivo separado na pasta `logs/`.

## 📁 Estrutura dos Logs

```
fishing-bot/
├── logs/
│   ├── bot-1-conta-1-bot-a.log
│   ├── bot-2-conta-1-bot-b.log
│   ├── bot-3-farm-principal.log
│   └── bot-4-conta-teste.log
```

## 📋 Nome dos Arquivos

Os arquivos de log são nomeados automaticamente:

```
bot-{número}-{nome-sanitizado}.log
```

Onde:
- **número**: Posição da conta no `accounts.json` (1, 2, 3...)
- **nome-sanitizado**: Nome da conta com caracteres especiais removidos

### Exemplos:

| Nome da Conta | Arquivo de Log |
|---------------|----------------|
| `Conta 1 - Bot A` | `bot-1-conta-1-bot-a.log` |
| `Farm Principal` | `bot-2-farm-principal.log` |
| `Teste #3` | `bot-3-teste-3.log` |

## 📊 Conteúdo dos Logs

Cada arquivo contém:

```
[2026-01-12T04:10:00.123Z] INFO 🤖 BOT-1 [Conta 1 - Bot A] Iniciando...
[2026-01-12T04:10:00.456Z] INFO 🤖 BOT-1 [Conta 1 - Bot A] 📝 Log sendo gravado em: logs/bot-1-conta-1-bot-a.log
[2026-01-12T04:10:00.789Z] INFO 🤖 BOT-1 [Conta 1 - Bot A] Wallet: 2Y2fq8xv...1jyX8h
[2026-01-12T04:10:01.012Z] INFO 🤖 BOT-1 [Conta 1 - Bot A] Proxy: http://2.56.249.17:50100
[2026-01-12T04:10:01.345Z] INFO 🤖 BOT-1 [Conta 1 - Bot A] Delay: 500ms
[2026-01-12T04:10:05.678Z] SUCCESS 🤖 BOT-1 [Conta 1 - Bot A] 🐟 CATCH! +2750259 fish
[2026-01-12T04:10:06.901Z] SUCCESS 🤖 BOT-1 [Conta 1 - Bot A] 📊 1/1 (100.0%) | 🐟 1 catches (100.0%) | 🔴 0 misses | Total: 2,750,259 fish
```

## 🎯 Níveis de Log

- **INFO**: Informações gerais (iniciando, configurações, etc)
- **SUCCESS**: Ações bem-sucedidas (catches, transações confirmadas)
- **WARN**: Avisos (misses, durabilidade baixa)
- **ERROR**: Erros (falhas de transação, problemas de rede)
- **DEBUG**: Informações de debug (detalhes técnicos)

## 📖 Como Ler os Logs

### Ver logs em tempo real (Linux/Mac):

```bash
# Ver log de um bot específico
tail -f logs/bot-1-conta-1-bot-a.log

# Ver logs de todos os bots
tail -f logs/*.log
```

### Ver logs em tempo real (Windows PowerShell):

```powershell
# Ver log de um bot específico
Get-Content logs/bot-1-conta-1-bot-a.log -Wait -Tail 50

# Ver últimas 100 linhas
Get-Content logs/bot-1-conta-1-bot-a.log -Tail 100
```

### Procurar por CATCHES:

```bash
# Linux/Mac
grep "CATCH" logs/bot-1-conta-1-bot-a.log

# Windows PowerShell
Select-String "CATCH" logs/bot-1-conta-1-bot-a.log
```

### Procurar por ERROS:

```bash
# Linux/Mac
grep "ERROR" logs/bot-1-conta-1-bot-a.log

# Windows PowerShell
Select-String "ERROR" logs/bot-1-conta-1-bot-a.log
```

## 🧹 Gerenciamento de Logs

### Limpar logs antigos:

```bash
# Deletar todos os logs
rm logs/*.log

# Ou no Windows
del logs\*.log
```

### Rotação de logs:

Os logs crescem indefinidamente. Considere implementar rotação ou limpar periodicamente:

```bash
# Mover logs antigos para backup (Linux/Mac)
mkdir logs/backup-$(date +%Y%m%d)
mv logs/*.log logs/backup-$(date +%Y%m%d)/

# Ou no Windows PowerShell
New-Item -Path "logs/backup-$(Get-Date -Format 'yyyyMMdd')" -ItemType Directory
Move-Item logs/*.log "logs/backup-$(Get-Date -Format 'yyyyMMdd')/"
```

## 📊 Análise de Logs

### Contar catches vs misses:

```bash
# Linux/Mac
echo "Catches: $(grep -c "CATCH!" logs/bot-1-conta-1-bot-a.log)"
echo "Misses: $(grep -c "MISS" logs/bot-1-conta-1-bot-a.log)"

# Windows PowerShell
Write-Host "Catches: $((Select-String "CATCH!" logs/bot-1-conta-1-bot-a.log).Count)"
Write-Host "Misses: $((Select-String "MISS" logs/bot-1-conta-1-bot-a.log).Count)"
```

### Total de fish pescado:

```bash
# Linux/Mac
grep "Total:" logs/bot-1-conta-1-bot-a.log | tail -1

# Windows PowerShell
Select-String "Total:" logs/bot-1-conta-1-bot-a.log | Select-Object -Last 1
```

## ⚠️ Importante

- A pasta `logs/` está no `.gitignore` - os logs **NÃO** são commitados no git
- Logs podem crescer bastante - monitore o tamanho do disco
- Cada bot escreve no seu próprio arquivo - **não há conflito**
- Os logs também aparecem no **console em tempo real**

## 🔄 Logs no Console vs Arquivo

**Console**:
- Logs em tempo real
- Coloridos e formatados
- Intercalados de todos os bots

**Arquivo**:
- Permanentes
- Separados por bot
- Fáceis de analisar depois
- Úteis para debugging

## 💡 Dicas

1. **Monitore o primeiro cast** de cada bot para garantir que está funcionando
2. **Use `tail -f`** para acompanhar em tempo real
3. **Faça backup** dos logs se quiser manter histórico
4. **Limpe periodicamente** para economizar espaço
5. **Analise os logs** para otimizar configurações (delays, etc)
