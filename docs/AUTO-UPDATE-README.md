# 🌐 Sistema de Auto-Update GameHacxkeado

Sistema automatizado para baixar e processar automaticamente a versão mais recente do JavaScript do jogo diretamente do site oficial.

## ✨ Funcionalidades

### 🔍 Detecção Automática
- **Detecta arquivo JS atual** do site `https://app.fogofishing.com/`
- **Extrai nome dinamicamente** (ex: `index-BkG_DUxV.js`)
- **Funciona mesmo com mudanças** no hash do arquivo

### 📥 Download Inteligente
- **Baixa apenas se necessário** - compara com versão atual
- **Download com progresso** em tempo real
- **Headers realistas** para evitar bloqueios

### 🔄 Integração Completa
- **Integra com auto-unminify.js** automaticamente
- **Backup automático** do source.js atual
- **Rollback automático** em caso de erro

### 🛡️ Sistema Seguro
- **Backup antes de modificar** qualquer arquivo
- **Validação de mudanças** antes de aplicar
- **Recuperação automática** em caso de falha

## 🚀 Como Usar

### Método 1: Scripts de Conveniência (Recomendado)

#### Windows
```batch
# Update completo
scripts\update.bat

# Apenas verificar updates
scripts\check-updates.bat
```

#### Linux/Mac
```bash
# Update completo
./scripts/update.sh

# Apenas verificar updates
./scripts/check-updates.sh
```

### Método 2: Linha de Comando Direta

```bash
# Update normal (recomendado)
node auto-update.js

# Verificar se há updates sem baixar
node auto-update.js --check

# Forçar update mesmo sem mudanças
node auto-update.js --force

# Mostrar ajuda
node auto-update.js --help
```

## 📊 Processo de Update

### 1. 🔍 Detecção
```
🔍 Detectando arquivo JavaScript atual...
📄 Arquivo detectado: index-BkG_DUxV.js
🌐 URL de download: https://app.fogofishing.com/assets/index-BkG_DUxV.js
```

### 2. 📥 Download
```
⬇️  Iniciando download...
📥 Baixando... 87% (5.89 MB)
✅ Arquivo baixado: temp-index-BkG_DUxV.js
```

### 3. 🔍 Verificação
```
📊 Comparando arquivos:
   Atual: 10.15 MB
   Novo:  10.23 MB
🔄 Mudanças detectadas no tamanho do arquivo
```

### 4. 💾 Backup
```
💾 Criando backup do source.js atual...
✅ Backup criado: old-source-2025-12-29T22-15-30-123Z.js
```

### 5. 🔄 Unminify
```
🔄 Executando unminify automático...
[AutoUnminify] Desminificando código com Prettier...
✅ Unminify concluído!
```

### 6. 🎉 Finalização
```
🎉 Update concluído com sucesso!
📄 Novo arquivo: source.js
💾 Backup anterior: old-source-2025-12-29T22-15-30-123Z.js
```

## ⚙️ Configurações

### Headers HTTP Personalizados
O sistema usa headers realistas para evitar bloqueios:

```javascript
headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
    'Accept': 'text/html,application/xhtml+xml,application/xml...',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache'
}
```

### Detecção de Mudanças
- **Tamanho do arquivo**: Diferença > 1% = mudança detectada
- **Conteúdo**: Comparação dos primeiros 1000 bytes
- **Fallback**: Em caso de erro, assume que há mudanças

## 🔧 Resolução de Problemas

### ❌ Erro: Arquivo auto-unminify.js não encontrado
**Solução**: Execute o comando na pasta raiz do projeto GameHacxkeado

### ❌ Erro HTTP 403/429 (Forbidden/Too Many Requests)
**Soluções**:
1. Aguarde alguns minutos antes de tentar novamente
2. Verifique sua conexão com a internet
3. O site pode ter proteção anti-bot temporária

### ❌ Erro: Falha no unminify
**Soluções**:
1. Verifique se prettier está instalado (`npm install`)
2. Arquivo baixado pode estar corrompido - tente novamente
3. Backup será restaurado automaticamente

### ❌ Nenhum arquivo JavaScript encontrado
**Soluções**:
1. Site pode estar em manutenção
2. Estrutura do site pode ter mudado
3. Problemas de conectividade

### ⚠️ Aviso: Nenhuma mudança detectada
**Normal**: O código já está atualizado
**Forçar update**: Use `--force` se necessário

## 📁 Arquivos Gerados

| Arquivo | Descrição |
|---------|-----------|
| `source.js` | Código desminificado atualizado |
| `old-source-TIMESTAMP.js` | Backup da versão anterior |
| `temp-index-*.js` | Arquivo temporário (removido automaticamente) |
| `index-*.js` | Arquivo original baixado (mantido para referência) |

## 🔄 Integração com Outros Sistemas

### Com Sistema de Patches
```bash
# 1. Update automático
node auto-update.js

# 2. Aplicar patches
./scripts/apply-all.sh
```

### Com Sistema Manual
```bash
# 1. Download manual do arquivo
# 2. Unminify manual
node auto-unminify.js

# OU update automático
node auto-update.js  # Faz tudo automaticamente
```

## 💡 Dicas de Uso

### 🕒 Frequência de Updates
- **Diariamente**: Para acompanhar mudanças do jogo
- **Após reports**: Quando há reports de bugs/mudanças
- **Antes de usar patches**: Sempre atualize antes de aplicar patches

### 🔄 Workflow Recomendado
1. `./scripts/check-updates.sh` - Verificar se há updates
2. `./scripts/update.sh` - Baixar e processar se necessário
3. `./scripts/apply-all.sh` - Aplicar patches desejados

### 🛡️ Backup Strategy
- O sistema mantém **apenas 1 backup** por execução
- Para múltiplos backups, renomeie manualmente os arquivos old-source-*
- Backups automáticos do sistema de patches ficam em `patches/backups/`

### ⚡ Performance
- **Primeira execução**: Mais lenta (precisa baixar arquivo)
- **Execuções seguintes**: Rápidas se não há mudanças
- **Verificação**: Muito rápida, apenas HTTP HEAD request

## 🔗 Links Relacionados

- [Sistema de Unminify](./UNMINIFY-README.md)
- [Sistema de Patches](./PATCH-SYSTEM-README.md)
- [Como Usar Auto-Repair](./COMO-USAR-AUTO-REPAIR.md)
- [Guia de Delay Finder](./delay-finder-guide.md)

---

**⚠️ Aviso**: Este sistema é para uso educacional. Respeite os termos de serviço do jogo e use com responsabilidade.