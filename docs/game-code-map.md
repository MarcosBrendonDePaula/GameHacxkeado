# Mapa do Código do Jogo

Este arquivo resume como o `source.js` está organizado, indicando onde o fluxo principal do jogo começa/termina e em quais trechos estão os sistemas mais importantes (como a durabilidade da vara).

## Visão Geral por Blocos

| Bloco | Onde começa | Onde termina | Descrição |
|-------|-------------|--------------|-----------|
| **Boot/Vite runtime** | `source.js:1` | `source.js:5 300` | Loader criado pelo Vite para suportar `modulepreload` e inicializar os polyfills base. |
| **Bibliotecas empacotadas** | `source.js:5 301` | `source.js:189 900` | React, Anchor, Solana Web3, utilitários de áudio e todos os helpers externos usados pelo cliente. |
| **IDL + Providers** | `source.js:190 000` | `source.js:191 923` | Definições das contas on-chain (`PlayerState`, `GlobalState`, etc.) e criação do `ProgramProvider`/`useFogoProgram`. |
| **Gerenciamento de estado do jogador** | `source.js:191 924` | `source.js:194 500` | Hook `usePlayerState` que busca `globalState`/`playerState`, mantém cache e expõe `refresh/setPlayerStateFromDecoded`. |
| **Componentes de HUD e lógica de produção** | `source.js:230 110` | `source.js:234 200` | Inclui os helpers de durabilidade (`calculateExpectedDurability`, `checkRepairEligibility`) e o `ProductionHUD`. |
| **Modais de manutenção (repair/upgrade/supercast)** | `source.js:235 000` | `source.js:238 900` | Componentes como `RepairRodModal` e os fluxos de compra/upgrade. |
| **View principal** | `source.js:240 771` | `source.js:241 232` | `GameView` coordena sessões, modais, auto-cast e chama o HUD. |
| **App + Router + Render** | `source.js:241 289` | `source.js:241 424` | `AppRoutes`, `App` e o `ReactDOM.createRoot(...).render(<App />)` que fecha o bundle. |

## Fluxo do Jogo (alto nível)

1. **Inicialização do bundle** (`source.js:1-5 300`): Vite injeta o loader e registra os módulos compilados.
2. **Provisionamento Anchor/Solana** (`source.js:190 000-191 923`): o `ProgramProvider` abre a conexão RPC, constrói o Anchor `Program` a partir do IDL e oferece `useFogoProgram`.
3. **Sincronização do jogador** (`source.js:191 924+`): `usePlayerState` deriva as PDAs de `globalState`/`playerState` e expõe `refresh`, utilizado pelo `GameView`.
4. **UI principal** (`source.js:230 110-241 232`):
   - `ProductionHUD` exibe saldo, durabilidade, supercast e botões de ação.
   - `GameView` lê `playerState`, controla sessões, pausas e abre modais de upgrade/reparo/processamento.
5. **Shell + Rotas** (`source.js:241 289-241 424`): `AppRoutes` decide qual página renderizar e `App` aplica guards (Browser, Network, Session). O bundle termina com `ReactDOM.createRoot(...).render(<App />)`.

## Onde fica a durabilidade da vara

- **Dados on-chain**: `PlayerState` define `max_durability`, `current_durability` e `last_durability_ts` em `source.js:191 106`. Estes campos são atualizados pelo programa Anchor quando o jogador pesca, entra em supercast ou repara a vara.
- **Leitura para a UI**: o hook `usePlayerState` copia esses campos para o React state em `source.js:191 990-192 050`, permitindo que qualquer componente (`ProductionHUD`, modais, etc.) leia `playerState.currentDurability`.

## Sistema de renovação/reparo da vara

- **Regen passiva** (`source.js:230 110-230 128`):
  - Constantes `DURABILITY_REGEN_SECONDS_PER_CAST = 3` e `SLOW_REGEN_MULTIPLIER = 4`.
  - `calculateExpectedDurability(current, max, lastTs)` calcula quanto a vara já regenerou desde `last_durability_ts`. A regeneração é 1 ponto a cada 3 s enquanto você está acima de 20% do máximo, e 1 ponto a cada 12 s (3 s × 4) quando está em ≤20%, incentivando o reparo.

- **Checagem de elegibilidade** (`source.js:230 129-230 141`):
  - `checkRepairEligibility` reutiliza o cálculo acima; só libera reparo quando a durabilidade esperada está em ≤20% do máximo. Se já estiver cheia, retorna mensagem explicando o motivo do bloqueio.

- **Gatilhos no HUD** (`source.js:230 187-231 450`):
  - `ProductionHUD` calcula `lt = calculateExpectedDurability(...)` e `ht = (lt / maxDurability) * 100` para exibir barra e alertas. Se `ht < 10`, mostra aviso visual e impede casts.

- **Bloqueio de casts** (`source.js:232 705-232 744`):
  - Antes de mandar `castLine`, `GameView` chama `calculateExpectedDurability` e cancela o cast caso o valor seja ≤0 (a não ser que o jogador esteja em supercast, que não consome durabilidade).

- **Modal de reparo** (`source.js:237 075-237 350`):
  - `RepairRodModal` busca o `playerState` on-chain novamente, recalcula a durabilidade esperada e chama o método Anchor `repairRod` cobrando `REPAIR_COST_LAMPORTS = 99 0000` (USDC). Após enviar a transação, fica fazendo polling até o `currentDurability` atingir ~100% antes de fechar o modal e disparar `refresh`.

## Scripts auxiliares

- `src/utils/find_durability_lines.py`: Scanner que localiza pontos estratégicos para inserir monitoramento/patches de durabilidade dentro do bundle.
- `src/utils/auto_pause_system.js`: Exemplo de automação na camada de usuários (pausa auto cast quando detecta vara quebrada).
- `docs/COMO-USAR-AUTO-REPAIR.md`: Manual que explica como integrar scripts customizados com o fluxo descrito acima.

Use este mapa como ponto de partida sempre que precisar tocar no sistema de durabilidade ou entender onde inserir novos hooks no `source.js`.

