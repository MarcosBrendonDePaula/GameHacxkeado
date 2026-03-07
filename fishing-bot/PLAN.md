# Plano: Separar IDL e Modularizar Dados do Jogo

## Problema
- IDL embutida num `.ts` gigante, dificil de editar
- CU_LIMITS hardcoded e desatualizado (bot usa 200k, jogo usa 48k)
- Constants espalhadas entre bot e game source sem sincronia
- Quando o jogo atualiza, precisa mexer em varios arquivos manualmente

## 1. Extrair IDL para JSON separado

**Arquivo:** `src/config/idl.json` (novo)
- IDL pura em JSON, facil de editar e diff
- Extrair a IDL completa do game source (todas as 10 instructions, todos os 24 types)

**Arquivo:** `src/config/idl.ts` (simplificar)
- Apenas importa e re-exporta o JSON:
```ts
import IDL from "./idl.json";
export const FOGO_FISHING_IDL = IDL;
export type FogoFishingIDL = typeof IDL;
```

## 2. Extrair CU_LIMITS do game source

**Arquivo:** `src/config/cu-limits.json` (novo)
- Todos os CU_LIMITS do jogo atual:
```json
{
  "CAST_LINE": 48000,
  "REPAIR_ROD": 48000,
  "BUY_SUPERCAST": 48000,
  "INITIALIZE_PLAYER": 150000,
  "PROCESS_FISH": 150000,
  ...
}
```

**Atualizar** `constants.ts` para importar de cu-limits.json

## 3. Extrair endpoints/URLs para config separada

**Arquivo:** `src/config/endpoints.json` (novo)
```json
{
  "capability_url": "https://cast.fogofishing.com/capability",
  "paymaster_url": "https://fogo-mainnet.dourolabs-paymaster.xyz/api/sponsor_and_send",
  "paymaster_domain": "https://fogofishing.com",
  "stats_api_url": "https://stats.fogofishing.com",
  "epochs_api_url": "https://epochs.fogofishing.com",
  "rpc_endpoint": "https://eu.fogo.fluxrpc.com/?key=..."
}
```

## 4. Script de sync automatico

**Arquivo:** `scripts/sync-from-game.js` (novo)
- Le o `source.js` (do projeto pai) e extrai automaticamente:
  - IDL completa -> `src/config/idl.json`
  - CU_LIMITS -> `src/config/cu-limits.json`
  - URLs/endpoints -> `src/config/endpoints.json`
  - Program ID, Mints, Treasury addresses
- Roda depois do auto-update para manter bot sincronizado

## Arquivos a modificar
- `src/config/idl.ts` - simplificar (import JSON)
- `src/config/constants.ts` - importar CU_LIMITS e endpoints dos JSONs
- `src/utils/capability.ts` - usar endpoint do config
- `src/utils/paymaster.ts` - usar endpoint do config

## Arquivos novos
- `src/config/idl.json`
- `src/config/cu-limits.json`
- `src/config/endpoints.json`
- `scripts/sync-from-game.js`
