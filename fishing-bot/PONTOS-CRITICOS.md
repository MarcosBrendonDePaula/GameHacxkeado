# 🛡️ Pontos Críticos e Proteções do Bot

Este documento lista todos os pontos onde o bot pode falhar e as proteções implementadas.

## ✅ Problemas Corrigidos

### 1. **WebSocket Fechando Silenciosamente** ⚠️ CRÍTICO
**Problema Original:**
- WebSocket fechava por timeout/erro de rede
- Bot parava de funcionar sem aviso
- Não havia verificação de saúde do WebSocket

**Solução Implementada:**
- ✅ Método `isHealthy()` verifica estado do WebSocket
- ✅ Backoff exponencial nas reconexões (1s → 1.5s → 2.25s... até 30s)
- ✅ Contador de tentativas de reconexão
- ✅ Logs detalhados de cada tentativa
- ✅ Restart automático após 5 falhas consecutivas
- ✅ Aguarda 5 segundos para reconexão antes de considerar falha

**Arquivos:**
- `src/services/log-monitor.ts:127-145` (isHealthy)
- `src/services/log-monitor.ts:182-193` (contador de tentativas)
- `src/services/log-monitor.ts:207-221` (backoff exponencial)

### 2. **Cast Loop Parando por Falhas** ⚠️ CRÍTICO
**Problema Original:**
- `if (!this.service || !this.logMonitor) break;` parava o bot silenciosamente
- Sem tratamento de recuperação

**Solução Implementada:**
- ✅ Verifica saúde do logMonitor antes de cada cast
- ✅ Conta erros consecutivos (máximo 5)
- ✅ Aguarda 5s entre verificações para dar chance de reconexão
- ✅ Reinicia bot automaticamente após 5 falhas
- ✅ Reseta contador ao recuperar
- ✅ Logs detalhados de cada etapa

**Arquivo:** `src/web/bot-manager-db.ts:263-372`

### 3. **StateUpdate Loop Falhando** ⚠️ MÉDIO
**Problema Original:**
- `if (!this.service) break;` parava loop silenciosamente
- Exceções silenciosas no catch vazio
- Sem tratamento de erros ao buscar playerState

**Solução Implementada:**
- ✅ Contador de erros consecutivos (máximo 10)
- ✅ Restart automático após muitas falhas
- ✅ Logs de erros detalhados
- ✅ Reseta contador em caso de sucesso

**Arquivo:** `src/web/bot-manager-db.ts:197-271`

## ⚠️ Pontos de Atenção (Com Tratamento Parcial)

### 4. **Paymaster Falhando**
**Situação Atual:**
- ✅ Tratamento de erros adequado
- ✅ Lança exceção se falhar
- ❌ Não tem retry automático
- ❌ Não tem fallback

**Possível Melhoria Futura:**
- Implementar retry com backoff
- Cache de sponsor para evitar requests repetidos
- Fallback para outro paymaster

**Arquivo:** `src/utils/paymaster.ts`

### 5. **Capability Service Indisponível**
**Situação Atual:**
- ✅ Tem fallback para capability dummy
- ✅ Cache de 5 minutos
- ✅ Refresh em background
- ⚠️ Capability dummy pode ser rejeitada pelo programa

**Possível Melhoria Futura:**
- Verificar se capability dummy ainda funciona
- Implementar múltiplos servidores de capability

**Arquivo:** `src/utils/capability.ts`

### 6. **RPC Calls Sem Timeout**
**Situação Atual:**
- ❌ `getSlot()`, `getLatestBlockhash()`, `getTransaction()` sem timeout explícito
- ⚠️ Podem travar indefinidamente se RPC não responder
- ✅ Tratadas pelo contador de erros consecutivos do loop

**Impacto:**
- Pode causar delays nos casts
- Eventualmente será detectado pelo sistema de erros consecutivos

**Possível Melhoria Futura:**
```typescript
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
}
```

### 7. **Proxy Caindo**
**Situação Atual:**
- ✅ Proxy opcional
- ✅ Verificação de IP em background
- ❌ Não detecta quando proxy cai durante execução
- ⚠️ Pode causar erros de rede mascarados

**Possível Melhoria Futura:**
- Health check periódico do proxy
- Fallback para sem proxy se detectar muitos erros

**Arquivo:** `src/utils/proxy.ts`

### 8. **Memória e Performance**
**Situação Atual:**
- ✅ Cache limitado de capabilities
- ✅ Limpeza de casts pendentes antigos (timeout 15s)
- ⚠️ Logs podem crescer indefinidamente no banco
- ⚠️ castResults podem acumular

**Possível Melhoria Futura:**
- Implementar rotação/limpeza de logs antigos
- Limitar tamanho do banco de dados

## 🔒 Proteções em Múltiplas Camadas

### Camada 1: Detecção Local
- WebSocket health check a cada cast
- Contador de erros consecutivos
- Timeout em operações críticas

### Camada 2: Recuperação Automática
- Backoff exponencial no WebSocket
- Aguarda 5s para reconexão antes de falhar
- Reseta contadores em caso de sucesso

### Camada 3: Restart Automático
- Após 5 falhas consecutivas no cast loop
- Após 10 falhas consecutivas no state loop
- Após WebSocket falhar 5 tentativas

### Camada 4: Restart Programado
- Auto-restart a cada X minutos (configurável)
- Padrão: 240 minutos (4 horas)

## 📊 Logs de Monitoramento

### Logs Críticos (Indicam Problema):
```
❌ Service não disponível, encerrando...
❌ LogMonitor não disponível, encerrando...
❌ WebSocket falhou 5 vezes, reiniciando bot...
❌ Falha ao enviar cast 5 vezes, reiniciando bot...
❌ Muitos erros consecutivos, reiniciando bot...
❌ Falha ao buscar playerState 10 vezes, reiniciando bot...
```

### Logs de Atenção (Problema Temporário):
```
⚠️ WebSocket não está saudável (X/5), aguardando reconexão...
⚠️ Websocket fechado (code). Tentativa de reconexão #X...
⚠️ Usando capability dummy (serviço indisponível)
⚠️ Não foi possível buscar estado inicial
```

### Logs de Recuperação (Tudo OK):
```
✅ WebSocket recuperado!
✅ Websocket conectado
✅ Sponsor obtido
✅ Capability obtida
```

## 🎯 Fluxo de Recuperação

```
1. Problema detectado (WebSocket fecha, erro em cast, etc.)
   ↓
2. Contador de erros incrementa (1/5, 2/5, ...)
   ↓
3. Sistema aguarda e tenta recuperar automaticamente
   ↓
4a. SE recuperar: Reseta contador, loga sucesso, continua normal
4b. SE não recuperar após 5 tentativas:
   ↓
5. Chama restartCallback()
   ↓
6. Bot para, aguarda 2 segundos, reinicia do zero
   ↓
7. Novo ciclo começa com contadores zerados
```

## 🔧 Configurações Recomendadas

```typescript
// Delays entre casts
delayMin: 1500,  // 1.5 segundos mínimo
delayMax: 3000,  // 3 segundos máximo

// Auto-reparo
autoRepair: true,
autoRepairMin: 15,   // 15% mínimo
autoRepairMax: 25,   // 25% máximo

// Auto-restart
autoRestartMinutes: 240,  // 4 horas

// WebSocket
ws_timeout_ms: 15000,          // 15 segundos
ws_reconnect_ms: 1500,         // Backoff inicial 1.5s
ws_ping_interval_ms: 15000,    // Ping a cada 15s
```

## 🚨 Quando o Bot NÃO Deve Reiniciar Sozinho

Situações onde é melhor parar e alertar o usuário:
1. ❌ Conta de jogador não existe (precisa inicializar)
2. ❌ Durabilidade em 0 e sem FOGO para reparar
3. ❌ RPC endpoint completamente offline
4. ❌ Keypair inválido ou corrompido
5. ❌ Permissões de arquivo/pasta negadas

**Estas situações requerem intervenção manual e não são tratadas pelo auto-restart.**
