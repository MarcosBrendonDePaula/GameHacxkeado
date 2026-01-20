# 🎯 Análise do Sistema RNG - Fogo Fishing

## 📋 Visão Geral

Este documento analisa a possibilidade de **prever resultados de casts** antes de enviá-los no jogo Fogo Fishing.

---

## 🔍 Como Funciona o Cast

### Inputs do Programa
```rust
cast_line(
  owner: Pubkey,           // Sua carteira
  target_slot: u64,        // Slot da blockchain
  use_supercast: bool,     // Normal ou Supercast
  _nonce: u64              // Número aleatório
)
```

### Contas Utilizadas
1. **slot_hashes** (Sysvar) - Hashes dos últimos ~300 slots
2. **global_state** - Dificuldade global, power total da rede
3. **player_state** - Seu power, rod level, boat tier

---

## 🎲 Sistema de Aleatoriedade (RNG)

### Fatores que Determinam o Resultado

O programa provavelmente usa esta fórmula:

```
seed = hash(slot_hash + nonce + owner + cast_count)
random_value = sha256(seed) % 100

success_rate = (player_power / network_difficulty) * base_modifier

if (random_value < success_rate) {
  return CATCH
} else {
  return MISS
}
```

### Componentes da Aleatoriedade

| Componente | Controlável? | Previsível? | Descrição |
|------------|--------------|-------------|-----------|
| **owner** | ❌ Não | ✅ Sim | Sua public key (fixa) |
| **target_slot** | ⚠️ Parcial | ⚠️ Parcial | Você escolhe, mas muda constantemente |
| **nonce** | ✅ Sim | ✅ Sim | Você gera localmente |
| **slot_hash** | ❌ Não | ❌ Não | Hash do bloco (imprevisível) |
| **cast_count** | ❌ Não | ✅ Sim | Incrementa a cada cast |
| **player_power** | ❌ Não | ✅ Sim | Baseado no seu equipamento |
| **network_difficulty** | ❌ Não | ✅ Sim | Estado global |

---

## 🧮 Estratégias de Previsão

### ❌ IMPOSSÍVEL - Previsão Completa

**Por quê?**
- O **slot_hash** é o hash SHA256 do bloco
- Impossível prever o hash antes do bloco ser minerado
- É a fonte primária de aleatoriedade criptográfica

### ⚠️ LIMITADO - Otimização de Probabilidade

**O que PODE ser feito:**

#### 1. Calcular Taxa de Sucesso Estimada
```typescript
const successRate = (playerPower / networkDifficulty) * baseModifier
// Se successRate > 50%, teoricamente você tem mais chance de CATCH
```

**Problema:** Não sabemos o `baseModifier` exato usado pelo programa.

#### 2. Testar Múltiplos Nonces (Simulação Local)
```typescript
async function findBestNonce(slot: number): Promise<number> {
  let bestNonce = 0
  let bestEstimate = 0

  for (let nonce = 0; nonce < 1000; nonce++) {
    // Simula o RNG localmente
    const seed = hash(slotHash + nonce + owner + castCount)
    const randomValue = sha256(seed) % 100

    if (randomValue > bestEstimate) {
      bestEstimate = randomValue
      bestNonce = nonce
    }
  }

  return bestNonce
}
```

**Problema Crítico:**
- Não temos acesso ao **slot_hash** antes de escolher o slot!
- Quando pegamos o slot_hash, o slot já passou ou está passando
- Não dá tempo de calcular antes de enviar

#### 3. Timing Attack (Escolher Melhor Momento)

**Teoria:**
- Alguns slots podem ter hashes "mais favoráveis"
- Esperar por padrões nos hashes recentes

**Código:**
```typescript
async function waitForFavorableSlot(): Promise<number> {
  while (true) {
    const currentSlot = await connection.getSlot()
    const slotHash = await getSlotHash(currentSlot - 1) // Hash do slot anterior

    // Verifica se o hash tem características "boas"
    const hashValue = BigInt('0x' + slotHash)
    const lastByte = Number(hashValue % 256n)

    if (lastByte > 200) { // Exemplo: valores altos
      return currentSlot
    }

    await sleep(400) // Espera próximo slot (~400ms por slot)
  }
}
```

**Problemas:**
1. Slots mudam a cada ~400ms na Solana
2. Seu cast pode chegar atrasado
3. Conexão + latência podem fazer você perder o slot
4. **Não há garantia de que hashes "altos" = melhores resultados**

---

## 🚫 Por Que NÃO Funciona na Prática

### Problema 1: Slot Hashes são Imprevisíveis
```
Slot N-1 hash: 0x3a7f... (passado)  ← Podemos ver
Slot N hash: 0x????... (atual)     ← DESCONHECIDO quando você decide
Slot N+1 hash: 0x????... (futuro)  ← IMPOSSÍVEL de prever
```

### Problema 2: Timing
```
1. Você pega o slot atual: 12345
2. Calcula o melhor nonce: ~10ms
3. Monta a transação: ~5ms
4. Envia para a rede: ~50ms
5. Transação chega no validador: ~100ms
6. Validador processa: ~50ms
Total: ~215ms

Mas o slot muda a cada 400ms!
Seu cast pode ser processado no PRÓXIMO slot com hash diferente!
```

### Problema 3: Não Sabemos o Algoritmo Exato
O programa on-chain pode usar:
- Diferentes funções de hash
- Diferentes pesos para cada fator
- Salt secreto
- Lógica anti-bot

---

## ✅ O Que REALMENTE Podemos Fazer

### 1. Maximizar Seu Power
```typescript
// Mais power = maior chance base
const yourPower = rodLevel * rodMultiplier + boatTier * boatMultiplier
```

**Ação:** Upgrade seu equipamento!

### 2. Monitorar Network Difficulty
```typescript
const globalState = await fetchGlobalState()
const difficulty = globalState.current_difficulty

// Se difficulty estiver BAIXA, melhores chances para todos
if (difficulty < THRESHOLD) {
  console.log('🎯 Boa hora para pescar!')
}
```

### 3. Evitar Slots "Ruins" (Heurística)
```typescript
// Evita slots com muita atividade
const recentBlockPerformance = await connection.getRecentPerformanceSamples()
if (recentBlockPerformance[0].numTransactions > 3000) {
  console.log('⚠️ Rede congestionada, melhor esperar')
}
```

### 4. Estratégia de Volume
```typescript
// Ao invés de tentar prever, aumente o volume
// Com taxa de sucesso de 30%:
// - 10 casts = ~3 catches
// - 100 casts = ~30 catches
// - 1000 casts = ~300 catches

// Lei dos grandes números: volume > previsão
```

---

## 🧪 Experimento Proposto

### Teste Empírico de Nonce
Podemos testar se o nonce influencia significativamente:

```typescript
async function testNonceImpact() {
  const results = new Map<string, { catches: number, misses: number }>()

  for (let nonce = 0; nonce < 100; nonce++) {
    const signature = await castLine(false, nonce)
    const result = await checkCastResult(signature)

    const key = `nonce_${nonce % 10}` // Agrupa por último dígito
    if (!results.has(key)) {
      results.set(key, { catches: 0, misses: 0 })
    }

    const stats = results.get(key)!
    if (result.isCatch) {
      stats.catches++
    } else {
      stats.misses++
    }
  }

  // Analisa se algum padrão emerge
  for (const [key, stats] of results) {
    const rate = (stats.catches / (stats.catches + stats.misses)) * 100
    console.log(`${key}: ${rate.toFixed(1)}% success`)
  }
}
```

**Resultado Esperado:**
- ❌ Se todos nonces têm ~mesma taxa → Nonce não importa
- ✅ Se alguns nonces têm taxa significativamente maior → Podemos explorar

---

## 🎯 Conclusão

### ❌ Previsão Perfeita: IMPOSSÍVEL
- Slot hashes são criptograficamente seguros
- Não dá tempo de calcular antes do slot mudar
- Não sabemos o algoritmo completo do programa

### ⚠️ Otimização Limitada: POSSÍVEL
- Aumentar seu power (equipamento)
- Monitorar difficulty da rede
- Escolher momentos de baixa congestão
- Estratégia de volume

### ✅ Melhor Estratégia: VOLUME + TIMING
```typescript
while (true) {
  // Verifica condições favoráveis
  const difficulty = await getNetworkDifficulty()
  const congestion = await getNetworkCongestion()

  if (difficulty < THRESHOLD && congestion < MAX_TPS) {
    // Envia múltiplos casts em paralelo
    await castInBatch(10)
  }

  await sleep(delay)
}
```

---

## 🔬 Próximos Passos para Investigação

1. **Reverter o programa on-chain** (se público)
   - Ver código Rust real do programa
   - Entender exatamente como o RNG funciona

2. **Análise estatística de padrões**
   - Coletar 10.000+ casts
   - Analisar correlação entre:
     - Nonce → Resultado
     - Slot → Resultado
     - Horário → Resultado

3. **Testar exploit de timing**
   - Implementar sistema de espera por "bons slots"
   - Medir se há melhoria real na taxa de sucesso

---

## 📚 Referências Técnicas

- Solana Slot Hashes: https://docs.solana.com/developing/runtime-facilities/sysvars#slothashes
- SHA256 Cryptographic Hash: https://en.wikipedia.org/wiki/SHA-2
- RNG em Blockchain: https://blog.chain.link/verifiable-random-functions-vrf/

---

**TL;DR: É quase impossível prever resultados. Foque em volume, equipamento e timing macro (network difficulty).**
