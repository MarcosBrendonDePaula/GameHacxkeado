import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import { getBot, getResults, getHistory, getAnalytics, startBot, stopBot, getPlayerState, startUpgrade, finishUpgrade, updateBotConfig, getWalletBalances, getBaitInventory, buyBait, equipBait, getBaitConfig, getGameConfig } from '../lib/api'
import LogsTab from './Logs'
import ConfigTab from './AddWallet'

interface BotStats {
  walletPubkey: string
  status: 'online' | 'offline'
  catches: number
  misses: number
  totalFish: number
  delayMin: number
  delayMax: number
  uptime: string
  pendingCasts?: number
  sessionPubkey?: string
  rodLevel?: number
  durability?: {
    current: number
    max: number
    percent: number
  }
}

interface BotInfo {
  sessionPubkey: string | null
  delayMin: number | null
  delayMax: number | null
  proxy: string | null
  enabled: boolean | null
  createdAt: Date | null
  updatedAt: Date | null
}

interface BotAutomationState {
  currentRepairThreshold: number
  currentWaitThreshold: number
  durabilityPauseUntil: number | null
  durabilityPauseRemainingMs: number
  isDurabilityPauseActive: boolean
}

interface CastResult {
  id: number
  type: 'catch' | 'miss'
  fishAmount: number | null
  timestamp: Date
}

interface HistoryPoint {
  id: number
  catches: number
  misses: number
  totalFish: number
  durability: number | null
  timestamp: Date
}

interface PlayerData {
  rodLevel: number
  boatTier: number
  power: string
  currentDurability: number
  maxDurability: number
  durabilityPercent: number
  castCount: string
  fishCaughtAllTime: string
  unprocessedFish: string
  supercastRemainingCasts: number
  upgradeInProgress: boolean
  upgradeTargetLevel: number
  upgradeCastsAtStart: string
}

interface BotAnalytics {
  sampledCatches: number
  sampledMisses: number
  sampledTotalFish: number
  windows: Array<{
    key: '5m' | '15m' | '1h' | '24h'
    label: string
    catches: number
    misses: number
    totalFish: number
    successRate: number
    fishPerHour: number
    avgFishPerCatch: number
    observedMinutes: number
  }>
  todayCatches: number
  todayMisses: number
  todayTotalFish: number
  yesterdayCatches: number
  yesterdayMisses: number
  yesterdayTotalFish: number
  comparison: {
    fishDelta: number
    fishDeltaPercent: number | null
    catchesDelta: number
    successRateDelta: number
  }
  projectedTotalFishToday: number
  projectedCatchesToday: number
  elapsedDayPercent: number
  streaks: {
    currentCatch: number
    currentMiss: number
    maxCatch: number
    maxMiss: number
  }
  hourlySeries: Array<{
    hour: number
    label: string
    fish: number
    catches: number
    cumulativeFish: number
  }>
  fishTypes: Array<{
    amount: number
    amountLabel: string
    count: number
    totalFish: number
    probability: number
    lastSeenAt: Date | null
    averageGapMs: number | null
    maxGapMs: number | null
    timeSinceLastMs: number | null
    overdueRatio: number | null
    status: 'normal' | 'attention' | 'late' | 'insufficient_data'
  }>
}

const EMPTY_ANALYTICS: BotAnalytics = {
  sampledCatches: 0,
  sampledMisses: 0,
  sampledTotalFish: 0,
  windows: [],
  todayCatches: 0,
  todayMisses: 0,
  todayTotalFish: 0,
  yesterdayCatches: 0,
  yesterdayMisses: 0,
  yesterdayTotalFish: 0,
  comparison: {
    fishDelta: 0,
    fishDeltaPercent: null,
    catchesDelta: 0,
    successRateDelta: 0,
  },
  projectedTotalFishToday: 0,
  projectedCatchesToday: 0,
  elapsedDayPercent: 0,
  streaks: {
    currentCatch: 0,
    currentMiss: 0,
    maxCatch: 0,
    maxMiss: 0,
  },
  hourlySeries: [],
  fishTypes: [],
}

function normalizeAnalytics(data: Partial<BotAnalytics> | null | undefined): BotAnalytics | null {
  if (!data) return null

  return {
    ...EMPTY_ANALYTICS,
    ...data,
    windows: Array.isArray(data.windows) ? data.windows : EMPTY_ANALYTICS.windows,
    comparison: {
      ...EMPTY_ANALYTICS.comparison,
      ...(data.comparison || {}),
    },
    streaks: {
      ...EMPTY_ANALYTICS.streaks,
      ...(data.streaks || {}),
    },
    hourlySeries: Array.isArray(data.hourlySeries) ? data.hourlySeries : EMPTY_ANALYTICS.hourlySeries,
    fishTypes: Array.isArray(data.fishTypes) ? data.fishTypes : EMPTY_ANALYTICS.fishTypes,
  }
}

function coerceNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

// Nomes dos baits (1-10)
const BAIT_NAMES: Record<number, string> = {
  1: "Mudwiggler", 2: "Skitterbug", 3: "River Scraps",
  4: "Scented Dough", 5: "Flash Spinner", 6: "Crankbait",
  7: "Live Flicker", 8: "Glow Ember", 9: "Ember Bait", 10: "River Charm",
}

// Custos de bait são dinâmicos (on-chain) - calculados via:
// actualFishCost = fishCostAtRefDifficulty * difficultyRef / currentDifficulty
// usdcFee é flat (on-chain)
interface BaitCostInfo {
  fishCost: number; // FISH real (já escalado por dificuldade)
  usdcFee: number;  // USDC flat fee
  unlockLevel: number;
  castsPerUnit: number;
}

// Formata números grandes: 75000 -> "75K", 1600000 -> "1.6M"
interface AutomationConfig {
  autoUpgrade: boolean
  autoRepair: boolean
  autoRepairMin: number
  autoRepairMax: number
  autoWaitDurability: boolean
  autoWaitDurabilityMin: number
  autoWaitDurabilityMax: number
  autoWaitMinutesMin: number
  autoWaitMinutesMax: number
  autoRestartMinutes: number
}

function buildAutomationSnapshot(config: AutomationConfig): string {
  return JSON.stringify(config)
}

function formatFish(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`
  return n.toString()
}

// Requisitos de casts por nível (L2-L60)
const UPGRADE_CAST_REQUIREMENTS = [
  0, 0, 3750, 3869, 3998, 4139, 4291, 4457, 4636, 4831, 5042, 5271, 5520, 5789, 6082, 6400, 6746, 7122, 7531,
  7976, 8461, 8991, 9569, 10200, 10891, 11647, 12476, 13384, 14382, 15480, 16687, 18017, 19484, 21104, 22895,
  24876, 27073, 29509, 32215, 35225, 38576, 42312, 46482, 51144, 56360, 62205, 68762, 76129, 84416, 93749, 104275,
  116162, 129602, 144820, 162073, 181659, 203924, 229267, 258152, 291119, 328795
]

// Custo em FOGO por nível (L2-L60) - em unidades inteiras (dividir por 1e6 para display)
const UPGRADE_FOGO_COSTS = [
  0, 0, 13083, 54216, 108126, 170760, 240352, 315848, 396526, 481859, 571436, 664931, 762075, 862640, 966434,
  1073290, 1183059, 1295613, 1410835, 1528622, 1648877, 1771517, 1896461, 2023637, 2152979, 2284425, 2417917,
  2553402, 2690829, 2830151, 2971325, 3114308, 3259061, 3405547, 3553731, 3703579, 3855059, 4008141, 4162796,
  4318997, 4476717, 4635930, 4796613, 4958743, 5122297, 5287253, 5453591, 5621292, 5790335, 5960703, 6132377,
  6305341, 6479578, 6655071, 6831806, 7009766, 7188937, 7369306, 7550858, 7733580, 7917459
]

export default function BotInfo() {
  const navigate = useNavigate()
  const { isConnected, walletPubkey } = useAuth()

  const [activeTab, setActiveTab] = useState<'dashboard' | 'estatisticas' | 'automacoes' | 'logs' | 'config'>('dashboard')
  const [botExists, setBotExists] = useState(false)
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null)
  const [botStats, setBotStats] = useState<BotStats | null>(null)
  const [playerData, setPlayerData] = useState<PlayerData | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<CastResult[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [analytics, setAnalytics] = useState<BotAnalytics | null>(null)
  const [automationState, setAutomationState] = useState<BotAutomationState | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [balances, setBalances] = useState<{ fogo: number; fish: number; usdc: number } | null>(null)
  const [autoUpgrade, setAutoUpgrade] = useState(false)
  const [autoRepair, setAutoRepair] = useState(false)
  const [autoRepairMin, setAutoRepairMin] = useState(15)
  const [autoRepairMax, setAutoRepairMax] = useState(25)
  const [autoWaitDurability, setAutoWaitDurability] = useState(false)
  const [autoWaitDurabilityMin, setAutoWaitDurabilityMin] = useState(15)
  const [autoWaitDurabilityMax, setAutoWaitDurabilityMax] = useState(25)
  const [autoWaitMinutesMin, setAutoWaitMinutesMin] = useState(0)
  const [autoWaitMinutesMax, setAutoWaitMinutesMax] = useState(0)
  const [autoRestartMinutes, setAutoRestartMinutes] = useState(240)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  // Bait states
  const [baitInventory, setBaitInventory] = useState<{ activeBait: number; remainingCasts: number[] } | null>(null)
  const [baitLoading, setBaitLoading] = useState<string | null>(null) // 'buy-3' or 'equip-5' etc
  const [baitError, setBaitError] = useState<string | null>(null)
  const [autoBuyBait, setAutoBuyBait] = useState(false)
  const [autoBuyBaitIds, setAutoBuyBaitIds] = useState('')
  const [autoUseBaitId, setAutoUseBaitId] = useState(0)
  const [autoBuyBaitThreshold, setAutoBuyBaitThreshold] = useState(100)
  const [autoBuyBaitThresholds, setAutoBuyBaitThresholds] = useState('')
  const [autoUseBaitOrder, setAutoUseBaitOrder] = useState('')
  const [autoBuyBaitQty, setAutoBuyBaitQty] = useState('')
  const [baitCosts, setBaitCosts] = useState<Record<number, BaitCostInfo>>({})
  const fetchAttemptsRef = useRef(0)
  const hydratedConfigWalletRef = useRef<string | null>(null)
  const lastAutomationSnapshotRef = useRef('')
  const [automationSyncReady, setAutomationSyncReady] = useState(false)
  const [isBanned, setIsBanned] = useState(false)
  const [banCertainty, setBanCertainty] = useState(0)

  const fetchData = useCallback(async () => {
    if (!isConnected || !walletPubkey) {
      setLoading(false)
      return
    }

    try {
      const data = await getBot()

      if (!data.exists) {
        fetchAttemptsRef.current++
        // Espera pelo menos 2 tentativas antes de mostrar "Nenhum Bot Configurado"
        // para evitar falso positivo por delay de autenticação
        if (fetchAttemptsRef.current < 2) {
          return // mantém loading=true, próximo interval tenta de novo
        }
      } else {
        fetchAttemptsRef.current = 0
      }

      setBotExists(data.exists)

      if (data.exists) {
        setBotInfo(data.bot)
        setBotStats(data.stats)
        setAutomationState(data.automationState || null)
        setIsRunning(data.isRunning || false)

        if (walletPubkey && hydratedConfigWalletRef.current !== walletPubkey) {
          hydratedConfigWalletRef.current = walletPubkey

          const hydratedAutomationConfig: AutomationConfig = {
            autoUpgrade: data.bot?.autoUpgrade ?? false,
            autoRepair: data.bot?.autoRepair ?? false,
            autoRepairMin: coerceNumber(data.bot?.autoRepairMin, 15),
            autoRepairMax: coerceNumber(data.bot?.autoRepairMax, 25),
            autoWaitDurability: data.bot?.autoWaitDurability ?? false,
            autoWaitDurabilityMin: coerceNumber(data.bot?.autoWaitDurabilityMin, 15),
            autoWaitDurabilityMax: coerceNumber(data.bot?.autoWaitDurabilityMax, 25),
            autoWaitMinutesMin: coerceNumber(data.bot?.autoWaitMinutesMin, 0),
            autoWaitMinutesMax: coerceNumber(data.bot?.autoWaitMinutesMax, 0),
            autoRestartMinutes: coerceNumber(data.bot?.autoRestartMinutes, 240),
          }

          // Busca configs de automacao do bot apenas na hidratacao inicial da wallet
          setAutoUpgrade(hydratedAutomationConfig.autoUpgrade)
          setAutoRepair(hydratedAutomationConfig.autoRepair)
          setAutoRepairMin(hydratedAutomationConfig.autoRepairMin)
          setAutoRepairMax(hydratedAutomationConfig.autoRepairMax)
          setAutoWaitDurability(hydratedAutomationConfig.autoWaitDurability)
          setAutoWaitDurabilityMin(hydratedAutomationConfig.autoWaitDurabilityMin)
          setAutoWaitDurabilityMax(hydratedAutomationConfig.autoWaitDurabilityMax)
          setAutoWaitMinutesMin(hydratedAutomationConfig.autoWaitMinutesMin)
          setAutoWaitMinutesMax(hydratedAutomationConfig.autoWaitMinutesMax)
          setAutoRestartMinutes(hydratedAutomationConfig.autoRestartMinutes)
          lastAutomationSnapshotRef.current = buildAutomationSnapshot(hydratedAutomationConfig)
          setAutomationSyncReady(true)

          // Busca config de auto-bait apenas uma vez para nao sobrescrever edicao local
          if (data.bot?.autoBuyBait !== undefined) setAutoBuyBait(data.bot.autoBuyBait)
          if (data.bot?.autoBuyBaitIds !== undefined) setAutoBuyBaitIds(data.bot.autoBuyBaitIds || '')
          if (data.bot?.autoUseBaitId !== undefined) setAutoUseBaitId(coerceNumber(data.bot.autoUseBaitId, 0))
          if (data.bot?.autoBuyBaitThreshold !== undefined) setAutoBuyBaitThreshold(coerceNumber(data.bot.autoBuyBaitThreshold, 100))
          if (data.bot?.autoBuyBaitThresholds !== undefined) setAutoBuyBaitThresholds(data.bot.autoBuyBaitThresholds || '')
          if (data.bot?.autoUseBaitOrder !== undefined) setAutoUseBaitOrder(data.bot.autoUseBaitOrder || '')
          if (data.bot?.autoBuyBaitQty !== undefined) setAutoBuyBaitQty(data.bot.autoBuyBaitQty || '')
        }

        // Busca resultados, historico, dados do player, balances, bait inventory, bait config e game config
        const [resultsData, historyData, analyticsData, playerStateData, balancesData, baitData, baitConfigData, gameConfigData] = await Promise.all([
          getResults({ limit: 50 }),
          getHistory({ limit: 100 }),
          getAnalytics(),
          getPlayerState(walletPubkey),
          getWalletBalances(walletPubkey).catch(() => null),
          getBaitInventory(walletPubkey).catch(() => null),
          getBaitConfig().catch(() => null),
          getGameConfig().catch(() => null),
        ])
        setResults(resultsData.results || [])
        setHistory(historyData.history || [])
        setAnalytics(normalizeAnalytics(analyticsData))
        if (playerStateData.exists && playerStateData.player) {
          setPlayerData(playerStateData.player)

          // Detecção de banimento:
          // Se na sessão atual a taxa de acerto está abaixo de 5%, a conta pode estar banida
          // A certeza aumenta com o número de casts (mais dados = menos chance de azar)
          // ~50 casts (~3min): 55% certeza | ~200 casts (~10min): 82% | ~600 casts (~30min): 98%
          const sessionCatches = data.stats?.catches || 0
          const sessionMisses = data.stats?.misses || 0
          const sessionTotal = sessionCatches + sessionMisses
          if (sessionTotal >= 30) {
            const sessionCatchRate = (sessionCatches / sessionTotal) * 100
            if (sessionCatchRate < 5) {
              // Certeza baseada em volume: curva exponencial de 50% a 99%
              const volumeCertainty = 50 + 50 * (1 - Math.exp(-sessionTotal / 200))
              // Bonus: quanto mais perto de 0% a taxa, mais certeza
              const rateBonus = (1 - sessionCatchRate / 5) * 5
              const certainty = Math.max(50, Math.min(99, Math.round(volumeCertainty + rateBonus)))
              setIsBanned(true)
              setBanCertainty(certainty)
            } else {
              setIsBanned(false)
              setBanCertainty(0)
            }
          }
        }
        if (balancesData && !balancesData.error) {
          setBalances(balancesData)
        }
        if (baitData?.exists && baitData.inventory) {
          setBaitInventory(baitData.inventory)
        }

        // Calcula custos dinâmicos das baits com dados on-chain
        if (baitConfigData?.baits && gameConfigData?.globalState?.currentDifficulty) {
          const diffRef = Number(baitConfigData.difficultyRef || '0')
          const curDiff = Number(gameConfigData.globalState.currentDifficulty)
          if (diffRef > 0 && curDiff > 0) {
            const costs: Record<number, BaitCostInfo> = {}
            baitConfigData.baits.forEach((b: any, i: number) => {
              const baitId = i + 1
              const refCostLamports = Number(b.fishCostAtRefDifficulty)
              const usdcFeeLamports = Number(b.usdcFee)
              // Formula: actualFishCost = fishCostAtRefDifficulty * difficultyRef / currentDifficulty
              const actualFishLamports = Math.round(refCostLamports * diffRef / curDiff)
              costs[baitId] = {
                fishCost: actualFishLamports / 1_000_000, // lamports -> FISH
                usdcFee: usdcFeeLamports / 1_000_000,     // lamports -> USDC
                unlockLevel: b.unlockLevel,
                castsPerUnit: b.castsPerUnit,
              }
            })
            setBaitCosts(costs)
          }
        }
      }
      setError(null)
      setLoading(false)
    } catch (err: any) {
      // Se a sessao ainda nao esta pronta, nao mostra erro - mantém loading e tenta de novo
      const msg = err.message || ''
      if (msg.includes('Sessão não conectada') || msg.includes('Sessao nao conectada')) {
        // mantém loading=true para nao mostrar "nenhum bot configurado"
        return // finally ainda roda, mas usamos flag abaixo
      } else {
        setError(msg)
        setLoading(false)
      }
    }
  }, [isConnected, walletPubkey])

  // Inicia o bot
  const handleStart = async () => {
    setActionLoading(true)
    setActionError(null)
    try {
      const result = await startBot()
      if (result.success) {
        setIsRunning(true)
        fetchData()
      } else {
        setActionError(result.error || 'Erro ao iniciar bot')
      }
    } catch (err: any) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Para o bot
  const handleStop = async () => {
    setActionLoading(true)
    setActionError(null)
    try {
      const result = await stopBot()
      if (result.success) {
        setIsRunning(false)
        fetchData()
      } else {
        setActionError(result.error || 'Erro ao parar bot')
      }
    } catch (err: any) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Inicia upgrade
  const handleStartUpgrade = async () => {
    if (!playerData) return
    const nextLevel = playerData.rodLevel + 1
    if (nextLevel > 60) return

    setUpgradeLoading(true)
    setUpgradeError(null)
    try {
      const result = await startUpgrade(nextLevel)
      if (result.success) {
        fetchData()
      } else {
        setUpgradeError(result.error || 'Erro ao iniciar upgrade')
      }
    } catch (err: any) {
      setUpgradeError(err.message)
    } finally {
      setUpgradeLoading(false)
    }
  }

  // Toggle auto-upgrade
  const handleToggleAutoUpgrade = async () => {
    const newValue = !autoUpgrade
    setAutoUpgrade(newValue)
    try {
      await updateBotConfig({ autoUpgrade: newValue })
    } catch (err: any) {
      setAutoUpgrade(!newValue) // revert on error
    }
  }

  // Compra bait
  const handleBuyBait = async (baitType: number) => {
    setBaitLoading(`buy-${baitType}`)
    setBaitError(null)
    try {
      const result = await buyBait(baitType, 1)
      if (result.success) {
        fetchData()
      } else {
        setBaitError(result.error || 'Erro ao comprar bait')
      }
    } catch (err: any) {
      setBaitError(err.message)
    } finally {
      setBaitLoading(null)
    }
  }

  // Equipa bait
  const handleEquipBait = async (baitType: number) => {
    setBaitLoading(`equip-${baitType}`)
    setBaitError(null)
    try {
      const result = await equipBait(baitType)
      if (result.success) {
        fetchData()
      } else {
        setBaitError(result.error || 'Erro ao equipar bait')
      }
    } catch (err: any) {
      setBaitError(err.message)
    } finally {
      setBaitLoading(null)
    }
  }

  // Toggle auto-buy bait
  const handleToggleAutoBuyBait = async () => {
    const newValue = !autoBuyBait
    setAutoBuyBait(newValue)
    try {
      await updateBotConfig({ autoBuyBait: newValue })
    } catch (err: any) {
      setAutoBuyBait(!newValue)
    }
  }

  // Atualiza auto-use bait (legacy single)
  const handleAutoUseBaitChange = async (baitId: number) => {
    const newValue = autoUseBaitId === baitId ? 0 : baitId
    setAutoUseBaitId(newValue)
    try {
      await updateBotConfig({ autoUseBaitId: newValue })
    } catch (err: any) {
      setAutoUseBaitId(autoUseBaitId)
    }
  }

  // Toggle bait na lista de prioridade (adiciona no final ou remove)
  const handleToggleBaitOrder = async (baitId: number) => {
    const currentOrder = autoUseBaitOrder ? autoUseBaitOrder.split(',').map(Number).filter(n => n >= 1 && n <= 10) : []
    let newOrder: number[]
    if (currentOrder.includes(baitId)) {
      newOrder = currentOrder.filter(id => id !== baitId)
    } else {
      newOrder = [...currentOrder, baitId]
    }
    const newValue = newOrder.join(',')
    setAutoUseBaitOrder(newValue)
    try {
      await updateBotConfig({ autoUseBaitOrder: newValue })
    } catch (err: any) {
      setAutoUseBaitOrder(autoUseBaitOrder)
    }
  }

  // Move bait para cima na lista de prioridade
  const handleMoveBaitUp = async (baitId: number) => {
    const currentOrder = autoUseBaitOrder ? autoUseBaitOrder.split(',').map(Number).filter(n => n >= 1 && n <= 10) : []
    const idx = currentOrder.indexOf(baitId)
    if (idx <= 0) return
    const newOrder = [...currentOrder]
    const currentValue = newOrder[idx]
    const previousValue = newOrder[idx - 1]
    if (currentValue === undefined || previousValue === undefined) return
    newOrder[idx - 1] = currentValue
    newOrder[idx] = previousValue
    const newValue = newOrder.join(',')
    setAutoUseBaitOrder(newValue)
    try {
      await updateBotConfig({ autoUseBaitOrder: newValue })
    } catch (err: any) {
      setAutoUseBaitOrder(autoUseBaitOrder)
    }
  }

  // Move bait para baixo na lista de prioridade
  const handleMoveBaitDown = async (baitId: number) => {
    const currentOrder = autoUseBaitOrder ? autoUseBaitOrder.split(',').map(Number).filter(n => n >= 1 && n <= 10) : []
    const idx = currentOrder.indexOf(baitId)
    if (idx < 0 || idx >= currentOrder.length - 1) return
    const newOrder = [...currentOrder]
    const currentValue = newOrder[idx]
    const nextValue = newOrder[idx + 1]
    if (currentValue === undefined || nextValue === undefined) return
    newOrder[idx] = nextValue
    newOrder[idx + 1] = currentValue
    const newValue = newOrder.join(',')
    setAutoUseBaitOrder(newValue)
    try {
      await updateBotConfig({ autoUseBaitOrder: newValue })
    } catch (err: any) {
      setAutoUseBaitOrder(autoUseBaitOrder)
    }
  }

  // Atualiza auto-buy bait IDs
  const handleAutoBuyBaitIdsChange = async (baitId: number) => {
    const currentIds = autoBuyBaitIds.split(',').filter(Boolean).map(Number)
    const newIds = currentIds.includes(baitId)
      ? currentIds.filter(id => id !== baitId)
      : [...currentIds, baitId].sort((a, b) => a - b)
    const newValue = newIds.join(',')
    setAutoBuyBaitIds(newValue)
    try {
      await updateBotConfig({ autoBuyBaitIds: newValue })
    } catch (err: any) {
      setAutoBuyBaitIds(autoBuyBaitIds)
    }
  }

  // Helper: parse per-bait thresholds map from string "1:100,3:50"
  const parseThresholdsMap = (): Record<number, number> => {
    const map: Record<number, number> = {}
    if (autoBuyBaitThresholds) {
      autoBuyBaitThresholds.split(',').forEach(entry => {
        const [id, t] = entry.split(':').map(Number)
        if (id !== undefined && t !== undefined && id >= 1 && id <= 10 && t > 0) map[id] = t
      })
    }
    return map
  }

  // Atualiza threshold individual por bait
  const handleBaitThresholdChange = async (baitId: number, value: number) => {
    const map = parseThresholdsMap()
    map[baitId] = value
    const newValue = Object.entries(map).map(([id, t]) => `${id}:${t}`).join(',')
    setAutoBuyBaitThresholds(newValue)
    try {
      await updateBotConfig({ autoBuyBaitThresholds: newValue })
    } catch (err: any) {
      setAutoBuyBaitThresholds(autoBuyBaitThresholds)
    }
  }

  // Atualiza quantidade de compra por bait (formato: "1:5,3:10")
  const handleBuyQtyChange = async (baitId: number, qty: number) => {
    const qtyMap: Record<number, number> = {}
    if (autoBuyBaitQty) {
      autoBuyBaitQty.split(',').forEach(entry => {
        const [id, q] = entry.split(':').map(Number)
        if (id !== undefined && q !== undefined && id >= 1 && id <= 10 && q > 0) qtyMap[id] = q
      })
    }
    if (qty <= 1) {
      delete qtyMap[baitId]
    } else {
      qtyMap[baitId] = Math.min(qty, 100)
    }
    const newValue = Object.entries(qtyMap).map(([id, q]) => `${id}:${q}`).join(',')
    setAutoBuyBaitQty(newValue)
    try {
      await updateBotConfig({ autoBuyBaitQty: newValue })
    } catch (err: any) {
      setAutoBuyBaitQty(autoBuyBaitQty)
    }
  }

  // Helper: parse qty map from string
  const parseBuyQtyMap = (): Record<number, number> => {
    const qtyMap: Record<number, number> = {}
    if (autoBuyBaitQty) {
      autoBuyBaitQty.split(',').forEach(entry => {
        const [id, q] = entry.split(':').map(Number)
        if (id !== undefined && q !== undefined && id >= 1 && id <= 10 && q > 0) qtyMap[id] = q
      })
    }
    return qtyMap
  }

  // Finaliza upgrade
  const handleFinishUpgrade = async () => {
    setUpgradeLoading(true)
    setUpgradeError(null)
    try {
      const result = await finishUpgrade()
      if (result.success) {
        fetchData()
      } else {
        setUpgradeError(result.error || 'Erro ao finalizar upgrade')
      }
    } catch (err: any) {
      setUpgradeError(err.message)
    } finally {
      setUpgradeLoading(false)
    }
  }

  // Quando conecta, reseta loading para evitar flash de "Nenhum Bot Configurado"
  // antes do primeiro fetch completar
  useEffect(() => {
    if (isConnected && walletPubkey) {
      setLoading(true)
      fetchAttemptsRef.current = 0
      hydratedConfigWalletRef.current = null
      lastAutomationSnapshotRef.current = ''
      setAutomationSyncReady(false)
    }
  }, [isConnected, walletPubkey])

  const automationConfig: AutomationConfig = {
    autoUpgrade,
    autoRepair,
    autoRepairMin,
    autoRepairMax,
    autoWaitDurability,
    autoWaitDurabilityMin,
    autoWaitDurabilityMax,
    autoWaitMinutesMin,
    autoWaitMinutesMax,
    autoRestartMinutes,
  }

  const automationSnapshot = buildAutomationSnapshot(automationConfig)

  useEffect(() => {
    if (!isConnected || !walletPubkey || !botExists || !automationSyncReady) return
    if (automationSnapshot === lastAutomationSnapshotRef.current) return

    const timeoutId = window.setTimeout(async () => {
      try {
        await updateBotConfig(automationConfig)
        lastAutomationSnapshotRef.current = automationSnapshot
        setActionError(null)
      } catch (err) {
        setActionError(getErrorMessage(err, 'Erro ao salvar automacao'))
      }
    }, 400)

    return () => window.clearTimeout(timeoutId)
  }, [automationConfig, automationSnapshot, automationSyncReady, botExists, isConnected, walletPubkey])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (!isConnected) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 'clamp(2rem, 5vw, 4rem) clamp(1rem, 3vw, 2rem)' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.8 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent)' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h3 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', marginBottom: '0.75rem', fontWeight: 600 }}>Conecte sua Carteira</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto', fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>
          Use o botao no canto superior direito para conectar sua wallet e acessar o dashboard.
        </p>
      </div>
    )
  }

  if (loading) {
    return <div className="loading">Carregando informacoes do bot...</div>
  }

  if (error) {
    // Se a carteira esta conectada mas a sessao ainda nao foi configurada, mostra loading
    if (isConnected && (error.includes('Sessão não conectada') || error.includes('Sessao nao conectada'))) {
      return <div className="loading">Carregando informacoes, aguarde...</div>
    }
    return (
      <div className="error">
        <h2 style={{ marginBottom: '12px' }}>Erro ao carregar dados</h2>
        <p style={{ marginBottom: '20px' }}>{error}</p>
        <button className="btn-secondary" onClick={() => navigate('/')}>
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!botExists) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 'clamp(2rem, 5vw, 4rem) clamp(1rem, 3vw, 2rem)' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.8 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--warning)' }}>
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
        </div>
        <h3 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', marginBottom: '0.75rem', fontWeight: 600 }}>Nenhum Bot Configurado</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.5rem', fontSize: 'clamp(0.85rem, 2vw, 1rem)' }}>
          Configure seu bot para comecar a pescar automaticamente.
        </p>
        <button className="btn-purple" onClick={() => navigate('/config')} style={{ padding: '12px 32px' }}>
          Configurar Bot
        </button>
      </div>
    )
  }

  // Stats do bot (quando rodando) ou da sessao atual
  const catches = botStats?.catches || 0
  const misses = botStats?.misses || 0
  const totalFish = botStats?.totalFish || 0
  const delayMin = botStats?.delayMin || botInfo?.delayMin || 1500
  const delayMax = botStats?.delayMax || botInfo?.delayMax || 3000
  const uptime = botStats?.uptime || '-'

  const totalCasts = catches + misses
  const successRate = totalCasts > 0 ? ((catches / totalCasts) * 100).toFixed(1) : '0.0'
  const avgFishPerCatch = catches > 0 ? (totalFish / catches).toFixed(2) : '0.00'

  // Dados do player vem da blockchain (sempre atualizado)
  const rodLevel = playerData?.rodLevel || botStats?.rodLevel
  const durability = playerData ? {
    current: playerData.currentDurability,
    max: playerData.maxDurability,
    percent: playerData.durabilityPercent
  } : botStats?.durability || null

  // Calcula cor da durabilidade
  const durabilityPercent = durability?.percent || 0
  const durabilityColor = durabilityPercent <= 20 ? 'var(--danger)' : durabilityPercent <= 50 ? 'var(--warning)' : 'var(--success)'
  const waitThresholdPercent = autoWaitDurability ? Math.max(0, Math.min(100, automationState?.currentWaitThreshold ?? autoWaitDurabilityMax)) : null
  const isDurabilityPauseActive = automationState?.isDurabilityPauseActive ?? false
  const durabilityPauseRemainingSeconds = Math.max(0, Math.ceil((automationState?.durabilityPauseRemainingMs ?? 0) / 1000))

  // Helper para formatar tempo
  const formatTime = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return 'Pronto!'
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatCountdown = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
    return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  }

  // Dados de upgrade computados
  const upgradeData = playerData ? (() => {
    if (playerData.upgradeInProgress) {
      const targetLevel = playerData.upgradeTargetLevel
      const castsRequired = UPGRADE_CAST_REQUIREMENTS[targetLevel] || 0
      const castsDone = Math.max(0, parseInt(playerData.castCount) - parseInt(playerData.upgradeCastsAtStart))
      const progress = castsRequired > 0 ? Math.min(100, (castsDone / castsRequired) * 100) : 0
      const castsRemaining = Math.max(0, castsRequired - castsDone)
      const isReady = castsDone >= castsRequired

      // Estima tempo restante baseado no delay do bot
      const avgDelay = (delayMin + delayMax) / 2
      const msPerCast = avgDelay + 500 // delay + ~500ms overhead
      const estimatedSeconds = Math.round((castsRemaining * msPerCast) / 1000)

      return { inProgress: true, targetLevel, castsRequired, castsDone, progress, castsRemaining, isReady, estimatedSeconds }
    }
    const nextLevel = playerData.rodLevel + 1
    const isMaxLevel = nextLevel > 60
    return {
      inProgress: false,
      nextLevel,
      isMaxLevel,
      castsRequired: !isMaxLevel ? UPGRADE_CAST_REQUIREMENTS[nextLevel] : 0,
      fogoCost: !isMaxLevel ? UPGRADE_FOGO_COSTS[nextLevel] : 0,
    }
  })() : null

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div className="dashboard-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h2
            onDoubleClick={() => setIsBanned(b => !b)}
            title="Duplo clique para testar alerta de ban"
            style={{
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            cursor: 'default',
            userSelect: 'none',
          }}>
            Dashboard
          </h2>
          <span className={`status-badge ${isRunning ? 'online' : 'offline'}`}>
            {isRunning ? 'Online' : 'Offline'}
          </span>
          {isBanned && (
            <span style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              background: 'rgba(248, 81, 73, 0.15)',
              color: 'var(--danger)',
              border: '1px solid rgba(248, 81, 73, 0.4)',
            }}>
              Banned ({banCertainty}%)
            </span>
          )}
        </div>

        <div className="actions" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {actionError && (
            <span style={{
              color: 'var(--danger)',
              fontSize: '0.85rem',
              padding: '8px 12px',
              background: 'rgba(248, 81, 73, 0.1)',
              borderRadius: '8px'
            }}>
              {actionError}
            </span>
          )}
          {isRunning ? (
            <button onClick={handleStop} disabled={actionLoading} className="btn-danger" style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
              {actionLoading ? 'Parando...' : 'Parar Bot'}
            </button>
          ) : (
            <button onClick={handleStart} disabled={actionLoading} className="btn-success" style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
              {actionLoading ? 'Iniciando...' : 'Iniciar Bot'}
            </button>
          )}
        </div>
      </div>

      {/* ============ ALERTA DE BANIMENTO ============ */}
      {isBanned && (
        <div className="card" style={{
          marginBottom: '20px',
          padding: '28px',
          background: 'linear-gradient(145deg, rgba(248, 81, 73, 0.12) 0%, rgba(248, 81, 73, 0.04) 100%)',
          border: '2px solid rgba(248, 81, 73, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          animation: 'fadeIn 0.5s ease',
          textAlign: 'center',
        }}>
          <img
            src="/ban-seal.png"
            alt="Conta Banida"
            style={{
              width: '200px',
              height: '200px',
              borderRadius: '16px',
              border: '3px solid rgba(248, 81, 73, 0.4)',
              objectFit: 'cover',
              boxShadow: '0 8px 32px rgba(248, 81, 73, 0.25)',
            }}
          />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            <span style={{
              color: 'var(--danger)',
              fontWeight: 700,
              fontSize: '1.3rem',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}>
              Conta Banida
            </span>
            <span style={{
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: banCertainty >= 90 ? 'rgba(248, 81, 73, 0.25)' : banCertainty >= 70 ? 'rgba(210, 153, 34, 0.25)' : 'rgba(88, 166, 255, 0.2)',
              color: banCertainty >= 90 ? 'var(--danger)' : banCertainty >= 70 ? 'var(--warning)' : 'var(--accent)',
            }}>
              {banCertainty}% certeza
            </span>
          </div>
          {/* Barra de certeza */}
          <div style={{
            width: '100%',
            maxWidth: '520px',
            height: '6px',
            borderRadius: '3px',
            background: 'rgba(255,255,255,0.05)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${banCertainty}%`,
              height: '100%',
              borderRadius: '3px',
              background: banCertainty >= 90 ? 'var(--danger)' : banCertainty >= 70 ? 'var(--warning)' : 'var(--accent)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <p style={{
            margin: 0,
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            maxWidth: '520px',
          }}>
            {banCertainty >= 90
              ? <>Com {totalCasts.toLocaleString()} casts e {successRate}% de acerto, e praticamente certo que esta conta esta banida. Entre no <a href="https://discord.gg/sPbZ7Z7EMf" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>Discord do Fogo Fish</a> e abra um ticket para solicitar o desbanimento.</>
              : banCertainty >= 70
              ? `Com ${totalCasts.toLocaleString()} casts e ${successRate}% de acerto, e muito provavel que esta conta esteja banida. Aguarde mais tempo para confirmar.`
              : `Com ${totalCasts.toLocaleString()} casts e ${successRate}% de acerto, pode ser azar ou banimento. Aguarde mais casts para ter certeza.`
            }
          </p>
          {banCertainty >= 90 && (
            <div style={{
              width: '100%',
              maxWidth: '520px',
              padding: '14px 18px',
              background: 'rgba(210, 153, 34, 0.15)',
              border: '2px solid rgba(210, 153, 34, 0.5)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{
                color: 'var(--warning)',
                fontWeight: 700,
                fontSize: '0.95rem',
                lineHeight: 1.5,
              }}>
                NAO mencione este sistema ou bot no Discord! Apenas diga que sua conta foi banida e peca para desbanir.
              </span>
            </div>
          )}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
            width: '100%',
            maxWidth: '520px',
            marginTop: '4px',
          }}>
            {[
              { label: 'Total Casts', value: totalCasts.toLocaleString(), color: 'var(--accent)' },
              { label: 'Catches', value: catches.toLocaleString(), color: 'var(--success)' },
              { label: 'Misses', value: misses.toLocaleString(), color: 'var(--danger)' },
              { label: 'Taxa de Acerto', value: `${successRate}%`, color: parseFloat(successRate) < 5 ? 'var(--danger)' : 'var(--warning)' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '10px 8px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '10px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ TABS ============ */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '20px',
        borderBottom: '2px solid var(--border)',
      }}>
        {([
          { id: 'dashboard' as const, label: 'Dashboard', color: 'var(--accent)' },
          { id: 'estatisticas' as const, label: 'Estatisticas', color: 'var(--warning)' },
          { id: 'automacoes' as const, label: 'Automacoes', color: 'var(--purple)' },
          { id: 'logs' as const, label: 'Logs', color: 'var(--warning)' },
          { id: 'config' as const, label: 'Config', color: 'var(--success)' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 24px',
              fontSize: '0.9rem',
              fontWeight: 600,
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
              marginBottom: '-2px',
              background: 'transparent',
              color: activeTab === tab.id ? tab.color : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'color 0.2s ease, border-color 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ TAB: DASHBOARD ============ */}
      {activeTab === 'dashboard' && (
      <div className="dashboard-grid" style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 320px',
        gap: '20px',
        marginBottom: '24px',
      }}>

        {/* ===== COLUNA ESQUERDA - Grafico de Pizza ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '20px', flex: 1 }}>
            <h3 style={{
              marginBottom: '16px',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ChartIcon />
              Taxa de Acerto
            </h3>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              {totalCasts > 0 ? (
                <PieChart catches={catches} misses={misses} />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <p>Nenhum cast ainda</p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px' }}>
              <LegendItem color="var(--success)" label="Catches" value={catches} />
              <LegendItem color="var(--danger)" label="Misses" value={misses} />
            </div>
          </div>

          {/* Progresso Bars */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{
              marginBottom: '16px',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <BarChartIcon />
              Resumo
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <MiniStat label="Total Fish" value={totalFish.toFixed(2)} color="var(--warning)" percent={80} />
              <MiniStat label="Total Catches" value={catches.toLocaleString()} color="var(--success)" percent={totalCasts > 0 ? (catches / totalCasts) * 100 : 0} />
              <MiniStat label="Media/Catch" value={avgFishPerCatch} color="var(--accent)" percent={50} />
            </div>
          </div>
        </div>

        {/* ===== COLUNA CENTRAL - Stats + Resultados ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Stats Grid Principal */}
          <div className="stats-row" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
          }}>
            <StatCard icon={<CheckIcon />} label="Catches" value={catches.toLocaleString()} color="var(--success)" />
            <StatCard icon={<XIcon />} label="Misses" value={misses.toLocaleString()} color="var(--danger)" />
            <StatCard icon={<CastIcon />} label="Total Casts" value={totalCasts.toLocaleString()} color="var(--accent)" />
            <StatCard icon={<TargetIcon />} label="Sucesso" value={`${successRate}%`} color="var(--accent)" />
          </div>

          {/* Stats Secundarios */}
          <div className="stats-row" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
          }}>
            <StatCard icon={<FishIcon />} label="Total Fish" value={totalFish.toFixed(2)} color="var(--warning)" />
            <StatCard icon={<AvgIcon />} label="Media/Catch" value={avgFishPerCatch} subvalue="fish" color="var(--text-secondary)" />
            <StatCard icon={<ClockIcon />} label="Uptime" value={uptime} color="var(--purple)" />
            <StatCard icon={<ZapIcon />} label="Delay" value={`${delayMin}-${delayMax}ms`} color="var(--text-secondary)" />
          </div>

          {/* Resultados Recentes */}
          <div className="card" style={{ padding: '20px', flex: 1 }}>
            <h3 style={{
              marginBottom: '16px',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ListIcon />
              Resultados Recentes
            </h3>
            {results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <p>Nenhum resultado ainda</p>
              </div>
            ) : (
              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                borderRadius: '10px',
                border: '1px solid var(--border)'
              }}>
                {results.map((r, index) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderBottom: index < results.length - 1 ? '1px solid var(--border)' : 'none',
                      background: r.type === 'catch' ? 'rgba(63, 185, 80, 0.05)' : 'rgba(248, 81, 73, 0.05)',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span className={`badge ${r.type === 'catch' ? 'success' : 'danger'}`}>
                        {r.type === 'catch' ? 'CATCH' : 'MISS'}
                      </span>
                      <span style={{
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: r.type === 'catch' ? 'var(--success)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                      }}>
                        {r.fishAmount ? `+${r.fishAmount.toFixed(3)}` : '-'}
                      </span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {formatDateTime(new Date(r.timestamp))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== COLUNA DIREITA - Vara & Bot Info ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card da Vara */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{
              marginBottom: '16px',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--gold)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FishingRodIcon />
              Vara de Pesca
            </h3>

            {/* Rod Level Visual */}
            <div style={{
              textAlign: 'center',
              padding: '20px 0',
              marginBottom: '16px',
              background: 'rgba(255, 215, 0, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 215, 0, 0.15)',
            }}>
              <div style={{
                fontSize: '3rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, var(--gold) 0%, #f59e0b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1,
              }}>
                Lv.{rodLevel || '-'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Power: {playerData?.power || '-'}
              </div>
            </div>

            {/* Durabilidade */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Durabilidade</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: durabilityColor }}>
                  {durability ? `${durability.current}/${durability.max}` : '-'}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '10px',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '5px',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  width: `${durabilityPercent}%`,
                  height: '100%',
                  background: durabilityColor,
                  borderRadius: '5px',
                  transition: 'width 0.5s ease',
                  boxShadow: `0 0 10px ${durabilityColor}60`,
                }} />
                {waitThresholdPercent !== null && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      bottom: '-2px',
                      left: `calc(${waitThresholdPercent}% - 1px)`,
                      width: '2px',
                      background: 'var(--danger)',
                      boxShadow: '0 0 8px rgba(248, 81, 73, 0.85)',
                      pointerEvents: 'none',
                    }}
                    title={`Pausa por durabilidade em ~${waitThresholdPercent}%`}
                  />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {waitThresholdPercent !== null && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '2px', background: 'var(--danger)', boxShadow: '0 0 6px rgba(248, 81, 73, 0.75)' }} />
                      Pausa em ~{waitThresholdPercent}%
                    </span>
                  )}
                  {isDurabilityPauseActive && (
                    <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                      Retoma em {formatCountdown(durabilityPauseRemainingSeconds)}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: durabilityColor }}>
                  {durabilityPercent}%
                </div>
              </div>
            </div>

            {/* On-chain stats */}
            {playerData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Boat Tier</span>
                  <span style={{ fontWeight: 600 }}>{playerData.boatTier}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Casts (on-chain)</span>
                  <span style={{ fontWeight: 600 }}>{parseInt(playerData.castCount).toLocaleString('pt-BR')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Fish (all-time)</span>
                  <span style={{ fontWeight: 600 }}>{(parseInt(playerData.fishCaughtAllTime) / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Unprocessed Fish</span>
                  <span style={{ fontWeight: 600 }}>{(parseInt(playerData.unprocessedFish) / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                </div>
                {playerData.supercastRemainingCasts > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Supercast</span>
                    <span style={{ fontWeight: 600, color: 'var(--purple)' }}>{playerData.supercastRemainingCasts} casts</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card de Upgrade */}
          {playerData && (
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{
                marginBottom: '16px',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--gold)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <UpgradeIcon />
                Upgrade
              </h3>

              {upgradeError && (
                <div style={{
                  padding: '8px 12px',
                  marginBottom: '12px',
                  background: 'rgba(248, 81, 73, 0.1)',
                  border: '1px solid rgba(248, 81, 73, 0.3)',
                  borderRadius: '8px',
                  color: 'var(--danger)',
                  fontSize: '0.8rem',
                }}>
                  {upgradeError}
                </div>
              )}

              {upgradeData?.inProgress ? (() => {
                const { targetLevel, castsRequired, castsDone, progress, castsRemaining, isReady, estimatedSeconds } = upgradeData as any
                const clampedProgress = Math.min(100, Math.max(0, progress))
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700 }}>
                        Lv.{playerData.rodLevel} → {targetLevel}
                      </span>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: isReady ? 'rgba(63, 185, 80, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: isReady ? 'var(--success)' : 'var(--accent)',
                      }}>
                        {isReady ? 'Pronto!' : `${clampedProgress.toFixed(1)}%`}
                      </span>
                    </div>

                    {/* Tempo restante estimado */}
                    {!isReady && estimatedSeconds > 0 && (
                      <div style={{
                        textAlign: 'center',
                        padding: '8px',
                        marginBottom: '12px',
                        background: 'rgba(251, 191, 36, 0.08)',
                        border: '1px solid rgba(251, 191, 36, 0.2)',
                        borderRadius: '8px',
                      }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '2px' }}>Tempo Estimado</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)' }}>{formatTime(estimatedSeconds)}</div>
                      </div>
                    )}

                    {/* Progress bar */}
                    <div style={{
                      width: '100%',
                      height: '20px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      marginBottom: '8px',
                    }}>
                      <div style={{
                        width: `${clampedProgress}%`,
                        height: '100%',
                        background: isReady
                          ? 'linear-gradient(90deg, var(--success) 0%, #4ade80 100%)'
                          : 'linear-gradient(90deg, var(--accent) 0%, var(--purple) 100%)',
                        borderRadius: '10px',
                        transition: 'width 0.5s ease',
                        boxShadow: isReady ? '0 0 15px rgba(63, 185, 80, 0.4)' : '0 0 15px rgba(59, 130, 246, 0.3)',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      <span>{castsDone.toLocaleString('pt-BR')} / {castsRequired.toLocaleString('pt-BR')}</span>
                      <span>{isReady ? 'Pode finalizar!' : `Faltam ${castsRemaining.toLocaleString('pt-BR')}`}</span>
                    </div>

                    {isReady && (
                      <button
                        onClick={handleFinishUpgrade}
                        disabled={upgradeLoading || !isRunning}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          border: 'none',
                          borderRadius: '10px',
                          cursor: upgradeLoading || !isRunning ? 'not-allowed' : 'pointer',
                          opacity: upgradeLoading || !isRunning ? 0.6 : 1,
                          background: 'linear-gradient(135deg, var(--success) 0%, #4ade80 100%)',
                          color: 'white',
                          boxShadow: '0 4px 12px rgba(63, 185, 80, 0.3)',
                        }}
                      >
                        {upgradeLoading ? 'Finalizando...' : `Finalizar → Lv.${targetLevel}`}
                      </button>
                    )}
                  </div>
                )
              })() : (() => {
                const { nextLevel, isMaxLevel, castsRequired, fogoCost } = upgradeData as any
                if (isMaxLevel) {
                  return (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--gold)' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>&#9733;</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Level Maximo!</div>
                    </div>
                  )
                }
                const upgradeFogoCostDisplay = (fogoCost / 1_000_000).toFixed(2)
                const canAffordUpgrade = balances ? balances.usdc >= fogoCost / 1_000_000 : null
                return (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div style={{
                        padding: '10px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '8px',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '2px' }}>Casts</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>{castsRequired.toLocaleString('pt-BR')}</div>
                      </div>
                      <div style={{
                        padding: '10px',
                        background: canAffordUpgrade === false ? 'rgba(248, 81, 73, 0.08)' : 'rgba(168, 85, 247, 0.08)',
                        border: `1px solid ${canAffordUpgrade === false ? 'rgba(248, 81, 73, 0.2)' : 'rgba(168, 85, 247, 0.2)'}`,
                        borderRadius: '8px',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '2px' }}>Custo USDC</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: canAffordUpgrade === false ? 'var(--danger)' : 'var(--purple)' }}>{upgradeFogoCostDisplay}</div>
                      </div>
                    </div>

                    {/* Indicador de saldo */}
                    {balances && (
                      <div style={{
                        padding: '6px 10px',
                        marginBottom: '12px',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        textAlign: 'center',
                        background: canAffordUpgrade ? 'rgba(63, 185, 80, 0.08)' : 'rgba(248, 81, 73, 0.08)',
                        border: `1px solid ${canAffordUpgrade ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 81, 73, 0.15)'}`,
                        color: canAffordUpgrade ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {canAffordUpgrade
                          ? `Saldo: ${balances.usdc.toFixed(2)} USDC - Pode pagar`
                          : `Saldo: ${balances.usdc.toFixed(2)} USDC - Insuficiente (faltam ${(fogoCost / 1_000_000 - balances.usdc).toFixed(2)})`
                        }
                      </div>
                    )}

                    <button
                      onClick={handleStartUpgrade}
                      disabled={upgradeLoading || !isRunning || canAffordUpgrade === false}
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '10px',
                        cursor: upgradeLoading || !isRunning || canAffordUpgrade === false ? 'not-allowed' : 'pointer',
                        opacity: upgradeLoading || !isRunning || canAffordUpgrade === false ? 0.6 : 1,
                        background: canAffordUpgrade === false
                          ? 'linear-gradient(135deg, #666 0%, #444 100%)'
                          : 'linear-gradient(135deg, var(--gold) 0%, #f59e0b 100%)',
                        color: canAffordUpgrade === false ? '#999' : '#1a1a2e',
                        boxShadow: canAffordUpgrade === false ? 'none' : '0 4px 12px rgba(255, 215, 0, 0.3)',
                      }}
                    >
                      {upgradeLoading ? 'Iniciando...' : canAffordUpgrade === false ? 'USDC Insuficiente' : `Upgrade → Lv.${nextLevel}`}
                    </button>
                    {!isRunning && (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '6px' }}>
                        Bot precisa estar rodando.
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Card de Iscas */}
          {playerData && (
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{
                marginBottom: '16px',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <BaitIcon />
                Iscas
              </h3>

              {baitError && (
                <div style={{
                  padding: '8px 12px',
                  marginBottom: '12px',
                  background: 'rgba(248, 81, 73, 0.1)',
                  border: '1px solid rgba(248, 81, 73, 0.3)',
                  borderRadius: '8px',
                  color: 'var(--danger)',
                  fontSize: '0.8rem',
                }}>
                  {baitError}
                </div>
              )}

              {/* Bait ativa */}
              <div style={{
                padding: '8px 12px',
                marginBottom: '12px',
                background: baitInventory?.activeBait ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${baitInventory?.activeBait ? 'rgba(59, 130, 246, 0.2)' : 'var(--border)'}`,
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Isca Ativa</span>
                <span style={{ fontWeight: 600, color: baitInventory?.activeBait ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {baitInventory?.activeBait ? BAIT_NAMES[baitInventory.activeBait] || `#${baitInventory.activeBait}` : 'Nenhuma'}
                </span>
              </div>

              {/* Grid de baits disponíveis */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(baitId => {
                  const casts = baitInventory?.remainingCasts?.[baitId - 1] || 0
                  const isActive = baitInventory?.activeBait === baitId
                  const costInfo = baitCosts[baitId]
                  const unlockLevel = costInfo?.unlockLevel || 0
                  const isUnlocked = playerData.rodLevel >= unlockLevel
                  const isBuying = baitLoading === `buy-${baitId}`
                  const isEquipping = baitLoading === `equip-${baitId}`
                  const fishCost = costInfo?.fishCost || 0
                  const usdcCost = costInfo?.usdcFee || 0
                  const hasCostData = !!costInfo
                  const canAffordFish = balances && hasCostData ? balances.fish >= fishCost : null
                  const canAffordUsdc = balances && hasCostData ? balances.usdc >= usdcCost : null
                  const canAfford = canAffordFish !== null ? (canAffordFish && canAffordUsdc) : null

                  return (
                    <div key={baitId} style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isActive ? 'rgba(59, 130, 246, 0.3)' : 'var(--border)'}`,
                      opacity: isUnlocked ? 1 : 0.4,
                    }}>
                      {/* Linha 1: Nome + casts + botões */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {BAIT_NAMES[baitId]}
                            {!isUnlocked && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: '4px' }}>Lv.{unlockLevel}</span>}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {casts > 0 ? `${casts} casts` : 'Sem estoque'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          {isUnlocked && isRunning && (
                            <>
                              <button
                                onClick={() => handleEquipBait(isActive ? 0 : baitId)}
                                disabled={!!baitLoading || (casts === 0 && !isActive)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: !!baitLoading || (casts === 0 && !isActive) ? 'not-allowed' : 'pointer',
                                  opacity: !!baitLoading || (casts === 0 && !isActive) ? 0.5 : 1,
                                  background: isActive ? 'rgba(248, 81, 73, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                  color: isActive ? 'var(--danger)' : 'var(--accent)',
                                }}
                              >
                                {isEquipping ? '...' : isActive ? 'Remover' : 'Usar'}
                              </button>
                              <button
                                onClick={() => handleBuyBait(baitId)}
                                disabled={!!baitLoading || canAfford === false}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: !!baitLoading || canAfford === false ? 'not-allowed' : 'pointer',
                                  opacity: !!baitLoading || canAfford === false ? 0.5 : 1,
                                  background: canAfford === false ? 'rgba(248, 81, 73, 0.15)' : 'rgba(63, 185, 80, 0.15)',
                                  color: canAfford === false ? 'var(--danger)' : 'var(--success)',
                                }}
                              >
                                {isBuying ? '...' : canAfford === false ? 'Sem saldo' : 'Comprar'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Linha 2: Custos */}
                      {isUnlocked && hasCostData && (
                        <div style={{
                          display: 'flex',
                          gap: '6px',
                          marginTop: '4px',
                          fontSize: '0.6rem',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: canAffordFish === false ? 'rgba(248, 81, 73, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                            color: canAffordFish === false ? 'var(--danger)' : 'var(--text-muted)',
                            fontWeight: 500,
                          }}>
                            {formatFish(Math.round(fishCost))} FISH
                          </span>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: canAffordUsdc === false ? 'rgba(248, 81, 73, 0.1)' : 'rgba(34, 197, 94, 0.08)',
                            color: canAffordUsdc === false ? 'var(--danger)' : 'var(--text-muted)',
                            fontWeight: 500,
                          }}>
                            {usdcCost.toFixed(2)} USDC
                          </span>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(168, 85, 247, 0.08)',
                            color: 'var(--text-muted)',
                            fontWeight: 500,
                          }}>
                            {costInfo.castsPerUnit} casts/un
                          </span>
                          {canAfford !== null && (
                            <span style={{
                              fontWeight: 600,
                              color: canAfford ? 'var(--success)' : 'var(--danger)',
                            }}>
                              {canAfford ? '\u2713' : '\u2717'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

            </div>
          )}

          {/* Balances Card */}
          {balances && (
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{
                marginBottom: '16px',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <WalletIcon />
                Carteira
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'rgba(255, 215, 0, 0.08)',
                  border: '1px solid rgba(255, 215, 0, 0.15)',
                  borderRadius: '8px',
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>FOGO</span>
                  <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{balances.fogo.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  borderRadius: '8px',
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>FISH</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{balances.fish.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.15)',
                  borderRadius: '8px',
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>USDC</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>{balances.usdc.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          )}

          {/* Bot Info Card */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{
              marginBottom: '16px',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <KeyIcon />
              Info do Bot
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Wallet</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.75rem' }}>
                  {walletPubkey?.slice(0, 6)}...{walletPubkey?.slice(-4)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Session</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.75rem' }}>
                  {botInfo?.sessionPubkey ? `${botInfo.sessionPubkey.slice(0, 6)}...${botInfo.sessionPubkey.slice(-4)}` : '-'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Proxy</span>
                <span style={{
                  fontWeight: 600,
                  color: botInfo?.proxy ? 'var(--success)' : 'var(--text-muted)',
                }}>
                  {botInfo?.proxy ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
      )}

      {/* ============ TAB: ESTATISTICAS ============ */}
      {activeTab === 'estatisticas' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
          gap: '20px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{
                marginBottom: '16px',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ChartIcon />
                Ritmo Recente
              </h3>

              {analytics ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {analytics.windows.map((windowStat) => (
                    <div key={windowStat.key} style={{
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.14)',
                      display: 'grid',
                      gap: '8px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{windowStat.label}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700 }}>{windowStat.successRate.toFixed(1)}%</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Baseado em {windowStat.observedMinutes} min observados
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fish/h</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--warning)' }}>{windowStat.fishPerHour.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Media/catch</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{windowStat.avgFishPerCatch.toFixed(3)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Catches</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{windowStat.catches}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Misses</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{windowStat.misses}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                  Sem dados recentes para calcular ritmo.
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{
                marginBottom: '16px',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <BarChartIcon />
                Projecao do Dia
              </h3>

              {analytics ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                  }}>
                    <MiniStat label="Fish Hoje" value={analytics.todayTotalFish.toFixed(2)} color="var(--warning)" percent={Math.max(4, analytics.elapsedDayPercent)} />
                    <MiniStat label="Proj. Fim do Dia" value={analytics.projectedTotalFishToday.toFixed(2)} color="var(--accent)" percent={Math.max(4, analytics.elapsedDayPercent)} />
                    <MiniStat label="Catches Hoje" value={analytics.todayCatches.toLocaleString()} color="var(--success)" percent={Math.max(4, analytics.elapsedDayPercent)} />
                  </div>

                  <DailyProjectionChart
                    series={analytics.hourlySeries}
                    todayTotalFish={analytics.todayTotalFish}
                    projectedTotalFish={analytics.projectedTotalFishToday}
                  />

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <span>Janela amostrada: {analytics.sampledCatches.toLocaleString()} catches e {analytics.sampledMisses.toLocaleString()} misses</span>
                    <span>Andamento do dia: {analytics.elapsedDayPercent.toFixed(1)}%</span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem' }}>
                  Sem dados suficientes para projetar o dia.
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{
                marginBottom: '16px',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AvgIcon />
                Hoje vs Ontem
              </h3>

              {analytics ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <ComparisonCard label="Fish" today={analytics.todayTotalFish.toFixed(2)} yesterday={analytics.yesterdayTotalFish.toFixed(2)} delta={analytics.comparison.fishDelta} percent={analytics.comparison.fishDeltaPercent} accent="var(--warning)" />
                  <ComparisonCard label="Catches" today={analytics.todayCatches.toString()} yesterday={analytics.yesterdayCatches.toString()} delta={analytics.comparison.catchesDelta} accent="var(--success)" />
                  <ComparisonCard label="Taxa" today={`${safeRate(analytics.todayCatches, analytics.todayMisses).toFixed(1)}%`} yesterday={`${safeRate(analytics.yesterdayCatches, analytics.yesterdayMisses).toFixed(1)}%`} delta={analytics.comparison.successRateDelta} accent="var(--accent)" suffix=" pp" />
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                  Sem base suficiente para comparar com ontem.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{
                marginBottom: '16px',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ZapIcon />
                Streaks
              </h3>

              {analytics ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <MiniStat label="Catch atual" value={analytics.streaks.currentCatch.toString()} color="var(--success)" percent={Math.min(100, analytics.streaks.currentCatch * 10)} />
                  <MiniStat label="Miss atual" value={analytics.streaks.currentMiss.toString()} color="var(--danger)" percent={Math.min(100, analytics.streaks.currentMiss * 10)} />
                  <MiniStat label="Maior catch streak" value={analytics.streaks.maxCatch.toString()} color="var(--success)" percent={Math.min(100, analytics.streaks.maxCatch * 5)} />
                  <MiniStat label="Maior miss streak" value={analytics.streaks.maxMiss.toString()} color="var(--danger)" percent={Math.min(100, analytics.streaks.maxMiss * 5)} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                  Sem dados de streak.
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{
                marginBottom: '8px',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FishIcon />
                Tipos Inferidos
              </h3>
              <p style={{ marginBottom: '14px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Agrupado por valor de catch. Serve como leitura estatistica do que saiu, nao como garantia do RNG.
              </p>

              {analytics && analytics.fishTypes.length > 0 ? (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {analytics.fishTypes.map((fishType) => (
                    <FishTypeCard key={fishType.amountLabel} fishType={fishType} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                  Ainda nao ha catches suficientes para separar tipos.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ TAB: AUTOMACOES ============ */}
      {activeTab === 'automacoes' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>

        {/* Row 1: Status geral das automacoes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
        }}>
          {[
            { label: 'Reparo', active: autoRepair, color: 'var(--success)', icon: <WrenchIcon size={16} /> },
            { label: 'Upgrade', active: autoUpgrade, color: 'var(--gold)', icon: <UpgradeIcon /> },
            { label: 'Restart', active: autoRestartMinutes > 0, color: 'var(--accent)', icon: <ClockIcon /> },
            { label: 'Equipar', active: (autoUseBaitOrder || '').split(',').filter(n => parseInt(n) >= 1).length > 0, color: 'var(--purple)', icon: <BaitIcon /> },
            { label: 'Compra', active: autoBuyBait, color: 'var(--warning)', icon: <BaitIcon /> },
          ].map((item, i) => (
            <div key={i} style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: item.active ? `${item.color}10` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${item.active ? `${item.color}30` : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ color: item.active ? item.color : 'var(--text-muted)', opacity: item.active ? 1 : 0.5, display: 'flex' }}>
                {item.icon}
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: item.active ? 'var(--text-primary)' : 'var(--text-muted)', flex: 1 }}>
                {item.label}
              </span>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: item.active ? item.color : 'var(--text-muted)',
                opacity: item.active ? 1 : 0.3,
                boxShadow: item.active ? `0 0 8px ${item.color}60` : 'none',
                animation: item.active ? 'pulse 2s ease-in-out infinite' : 'none',
              }} />
            </div>
          ))}
        </div>

        {/* Row 2: Cards principais */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px',
        }}>

        <div style={{
          gridColumn: '1 / -1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,184,77,0.06))',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Manutencao da Vara
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Escolha entre reparar automaticamente ou apenas pausar os casts quando a durabilidade entrar na faixa critica.
            </div>
          </div>
          <div style={{
            padding: '6px 10px',
            borderRadius: '999px',
            background: autoRepair ? 'rgba(63, 185, 80, 0.14)' : autoWaitDurability ? 'rgba(255, 184, 77, 0.14)' : 'rgba(255,255,255,0.05)',
            color: autoRepair ? 'var(--success)' : autoWaitDurability ? 'var(--warning)' : 'var(--text-muted)',
            fontSize: '0.74rem',
            fontWeight: 700,
          }}>
            {autoRepair ? 'Modo: Reparar' : autoWaitDurability ? 'Modo: Esperar' : 'Modo: Manual'}
          </div>
        </div>

        {/* Card: Auto-Repair */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <WrenchIcon size={20} />
              Auto-Reparo
            </h3>
            <div
              onClick={async () => {
                const newVal = !autoRepair
                setAutoRepair(newVal)
                try { await updateBotConfig({ autoRepair: newVal }) } catch { setAutoRepair(!newVal) }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                padding: '4px 12px', borderRadius: '20px',
                background: autoRepair ? 'rgba(63, 185, 80, 0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${autoRepair ? 'rgba(63, 185, 80, 0.3)' : 'var(--border)'}`,
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: autoRepair ? 'var(--success)' : 'var(--text-muted)' }}>
                {autoRepair ? 'ON' : 'OFF'}
              </span>
              <div style={{
                width: '32px', height: '18px', borderRadius: '9px',
                background: autoRepair ? 'var(--success)' : 'rgba(255,255,255,0.15)',
                position: 'relative', transition: 'background 0.2s ease',
              }}>
                <div style={{
                  width: '14px', height: '14px', borderRadius: '50%', background: 'white',
                  position: 'absolute', top: '2px', left: autoRepair ? '16px' : '2px',
                  transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </div>
            </div>
          </div>

          {/* Durabilidade atual */}
          {durability && (
            <div style={{
              padding: '10px 14px',
              marginBottom: '14px',
              borderRadius: '10px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Durabilidade Atual</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: durabilityColor }}>
                  {durability.current}/{durability.max} ({durabilityPercent}%)
                </span>
              </div>
              <div style={{
                width: '100%', height: '6px', background: 'rgba(0,0,0,0.3)',
                borderRadius: '3px', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${durabilityPercent}%`, height: '100%',
                  background: `linear-gradient(90deg, ${durabilityColor}, ${durabilityColor}cc)`,
                  borderRadius: '3px', transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}

          {autoRepair && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Range visual de reparo */}
              <div style={{
                padding: '14px',
                borderRadius: '10px',
                background: 'rgba(63, 185, 80, 0.04)',
                border: '1px solid rgba(63, 185, 80, 0.1)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--danger)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reparar abaixo de</span>
                  </div>
                  <span style={{
                    padding: '2px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700,
                    background: 'rgba(248, 81, 73, 0.15)', color: 'var(--danger)',
                  }}>{autoRepairMin}%</span>
                </div>
                <input
                  type="range"
                  min={5} max={50} step={5}
                  value={autoRepairMin}
                  onChange={async (e) => {
                    const val = parseInt(e.target.value)
                    setAutoRepairMin(val)
                    try { await updateBotConfig({ autoRepairMin: val }) } catch {}
                  }}
                  style={{ width: '100%', accentColor: 'var(--danger)' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--success)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reparar ate</span>
                  </div>
                  <span style={{
                    padding: '2px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700,
                    background: 'rgba(63, 185, 80, 0.15)', color: 'var(--success)',
                  }}>{autoRepairMax}%</span>
                </div>
                <input
                  type="range"
                  min={10} max={100} step={5}
                  value={autoRepairMax}
                  onChange={async (e) => {
                    const val = parseInt(e.target.value)
                    setAutoRepairMax(val)
                    try { await updateBotConfig({ autoRepairMax: val }) } catch {}
                  }}
                  style={{ width: '100%', accentColor: 'var(--success)' }}
                />
              </div>

              {/* Visualizacao do range */}
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <div style={{ flex: 1, position: 'relative', height: '24px' }}>
                  <div style={{
                    position: 'absolute', top: '10px', left: 0, right: 0, height: '4px',
                    background: 'rgba(255,255,255,0.08)', borderRadius: '2px',
                  }} />
                  <div style={{
                    position: 'absolute', top: '10px',
                    left: `${autoRepairMin}%`, width: `${autoRepairMax - autoRepairMin}%`,
                    height: '4px', background: 'linear-gradient(90deg, var(--danger), var(--success))',
                    borderRadius: '2px',
                  }} />
                  <div style={{
                    position: 'absolute', top: '4px', left: `${autoRepairMin}%`, transform: 'translateX(-50%)',
                    fontSize: '0.6rem', color: 'var(--danger)', fontWeight: 700,
                  }}>{autoRepairMin}%</div>
                  <div style={{
                    position: 'absolute', top: '4px', left: `${autoRepairMax}%`, transform: 'translateX(-50%)',
                    fontSize: '0.6rem', color: 'var(--success)', fontWeight: 700,
                  }}>{autoRepairMax}%</div>
                </div>
              </div>

            </div>
          )}
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <WrenchIcon size={20} />
              Espera por Durabilidade
            </h3>
            <div
              onClick={async () => {
                const newVal = !autoWaitDurability
                setAutoWaitDurability(newVal)
                try { await updateBotConfig({ autoWaitDurability: newVal }) } catch { setAutoWaitDurability(!newVal) }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                padding: '4px 12px', borderRadius: '20px',
                background: autoWaitDurability ? 'rgba(255, 184, 77, 0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${autoWaitDurability ? 'rgba(255, 184, 77, 0.3)' : 'var(--border)'}`,
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: autoWaitDurability ? 'var(--warning)' : 'var(--text-muted)' }}>
                {autoWaitDurability ? 'ON' : 'OFF'}
              </span>
              <div style={{
                width: '32px', height: '18px', borderRadius: '9px',
                background: autoWaitDurability ? 'var(--warning)' : 'rgba(255,255,255,0.15)',
                position: 'relative', transition: 'background 0.2s ease',
              }}>
                <div style={{
                  width: '14px', height: '14px', borderRadius: '50%', background: 'white',
                  position: 'absolute', top: '2px', left: autoWaitDurability ? '16px' : '2px',
                  transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </div>
            </div>
          </div>

          {autoWaitDurability && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                padding: '14px',
                borderRadius: '10px',
                background: 'rgba(255, 184, 77, 0.05)',
                border: '1px solid rgba(255, 184, 77, 0.12)',
              }}>
                <div style={{ marginBottom: '12px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Quando a durabilidade cair nessa faixa, o bot pausa sem reparar.
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Durabilidade minima</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning)' }}>{autoWaitDurabilityMin}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={autoWaitDurabilityMin}
                  onChange={async (e) => {
                    const val = parseInt(e.target.value)
                    setAutoWaitDurabilityMin(val)
                    try { await updateBotConfig({ autoWaitDurabilityMin: val }) } catch {}
                  }}
                  style={{ width: '100%', accentColor: 'var(--warning)' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Durabilidade maxima</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning)' }}>{autoWaitDurabilityMax}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={autoWaitDurabilityMax}
                  onChange={async (e) => {
                    const val = parseInt(e.target.value)
                    setAutoWaitDurabilityMax(val)
                    try { await updateBotConfig({ autoWaitDurabilityMax: val }) } catch {}
                  }}
                  style={{ width: '100%', accentColor: 'var(--warning)' }}
                />
              </div>

              <div style={{
                padding: '14px',
                borderRadius: '10px',
                background: 'rgba(255, 184, 77, 0.05)',
                border: '1px solid rgba(255, 184, 77, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Ao entrar nessa faixa, o bot espera esse tempo antes de voltar a castar.
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Tempo de pausa</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--warning)' }}>
                    Esperar {autoWaitMinutesMin}-{autoWaitMinutesMax} min
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Espera minima (min)</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={autoWaitMinutesMin}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value || '0', 10))
                        setAutoWaitMinutesMin(val)
                      }}
                      onBlur={async () => {
                        try {
                          await updateBotConfig({
                            autoWaitMinutesMin,
                          })
                        } catch {}
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        padding: '10px 12px',
                      }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Espera maxima (min)</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={autoWaitMinutesMax}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value || '0', 10))
                        setAutoWaitMinutesMax(val)
                      }}
                      onBlur={async () => {
                        try {
                          await updateBotConfig({
                            autoWaitMinutesMax,
                          })
                        } catch {}
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        padding: '10px 12px',
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card: Auto-Upgrade + Auto-Restart (combined compact) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Auto-Upgrade */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--gold)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <UpgradeIcon />
                Auto-Upgrade
              </h3>
              <div
                onClick={handleToggleAutoUpgrade}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                  padding: '4px 12px', borderRadius: '20px',
                  background: autoUpgrade ? 'rgba(63, 185, 80, 0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${autoUpgrade ? 'rgba(63, 185, 80, 0.3)' : 'var(--border)'}`,
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: autoUpgrade ? 'var(--success)' : 'var(--text-muted)' }}>
                  {autoUpgrade ? 'ON' : 'OFF'}
                </span>
                <div style={{
                  width: '32px', height: '18px', borderRadius: '9px',
                  background: autoUpgrade ? 'var(--success)' : 'rgba(255,255,255,0.15)',
                  position: 'relative', transition: 'background 0.2s ease',
                }}>
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', background: 'white',
                    position: 'absolute', top: '2px', left: autoUpgrade ? '16px' : '2px',
                    transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </div>
              </div>
            </div>

            {/* Rod level info */}
            {playerData && (
              <div style={{
                display: 'flex', gap: '10px', marginBottom: '12px',
              }}>
                <div style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  background: 'rgba(255, 215, 0, 0.06)', border: '1px solid rgba(255, 215, 0, 0.12)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Nivel Atual</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gold)' }}>Lv.{playerData.rodLevel}</div>
                </div>
                {upgradeData?.inProgress ? (
                  <div style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.12)',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Upgrade</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>
                      {(upgradeData as any).progress?.toFixed(0)}%
                    </div>
                  </div>
                ) : (
                  <div style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    background: 'rgba(168, 85, 247, 0.06)', border: '1px solid rgba(168, 85, 247, 0.12)',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Proximo</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--purple)' }}>
                      {playerData.rodLevel < 60 ? `Lv.${playerData.rodLevel + 1}` : 'MAX'}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 215, 0, 0.04)',
              border: '1px solid rgba(255, 215, 0, 0.08)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}>
              O bot inicia e finaliza upgrades automaticamente ao atingir os casts necessarios.
            </div>
          </div>

          {/* Auto-Restart */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ClockIcon />
                Auto-Restart
              </h3>
              <div
                onClick={async () => {
                  const newVal = autoRestartMinutes > 0 ? 0 : 240
                  setAutoRestartMinutes(newVal)
                  try { await updateBotConfig({ autoRestartMinutes: newVal }) } catch { setAutoRestartMinutes(autoRestartMinutes) }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                  padding: '4px 12px', borderRadius: '20px',
                  background: autoRestartMinutes > 0 ? 'rgba(63, 185, 80, 0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${autoRestartMinutes > 0 ? 'rgba(63, 185, 80, 0.3)' : 'var(--border)'}`,
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: autoRestartMinutes > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                  {autoRestartMinutes > 0 ? 'ON' : 'OFF'}
                </span>
                <div style={{
                  width: '32px', height: '18px', borderRadius: '9px',
                  background: autoRestartMinutes > 0 ? 'var(--success)' : 'rgba(255,255,255,0.15)',
                  position: 'relative', transition: 'background 0.2s ease',
                }}>
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', background: 'white',
                    position: 'absolute', top: '2px', left: autoRestartMinutes > 0 ? '16px' : '2px',
                    transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </div>
              </div>
            </div>

            {autoRestartMinutes > 0 && (
              <div>
                {/* Intervalo display grande */}
                <div style={{
                  padding: '12px',
                  marginBottom: '12px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.12)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Intervalo</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent)' }}>
                    {autoRestartMinutes >= 60
                      ? `${Math.floor(autoRestartMinutes / 60)}h ${autoRestartMinutes % 60 > 0 ? `${autoRestartMinutes % 60}m` : ''}`
                      : `${autoRestartMinutes}min`
                    }
                  </div>
                </div>
                <input
                  type="range"
                  min={30} max={720} step={30}
                  value={autoRestartMinutes}
                  onChange={async (e) => {
                    const val = parseInt(e.target.value)
                    setAutoRestartMinutes(val)
                    try { await updateBotConfig({ autoRestartMinutes: val }) } catch {}
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  <span>30min</span>
                  <span>6h</span>
                  <span>12h</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card: Auto-Equipar Isca */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h3 style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--purple)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <BaitIcon />
              Auto-Equipar Isca
            </h3>
            {(() => {
              const count = autoUseBaitOrder ? autoUseBaitOrder.split(',').map(Number).filter(n => n >= 1 && n <= 10).length : 0
              return count > 0 ? (
                <span style={{
                  padding: '3px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600,
                  background: 'rgba(168, 85, 247, 0.15)', color: 'var(--purple)',
                }}>
                  {count} {count === 1 ? 'isca' : 'iscas'}
                </span>
              ) : null
            })()}
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
            Ordem de prioridade: quando a isca ativa acabar, a proxima sera equipada automaticamente.
          </div>

          {/* Lista ordenada */}
          {(() => {
            const orderList = autoUseBaitOrder ? autoUseBaitOrder.split(',').map(Number).filter(n => n >= 1 && n <= 10) : []
            return orderList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                {orderList.map((baitId, idx) => {
                  const casts = baitInventory?.remainingCasts?.[baitId - 1] || 0
                  return (
                    <div key={baitId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: idx === 0 ? 'rgba(168, 85, 247, 0.12)' : 'rgba(59, 130, 246, 0.06)',
                      border: `1px solid ${idx === 0 ? 'rgba(168, 85, 247, 0.25)' : 'rgba(59, 130, 246, 0.12)'}`,
                      transition: 'all 0.2s ease',
                    }}>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '6px',
                        background: idx === 0 ? 'var(--purple)' : 'rgba(59, 130, 246, 0.2)',
                        color: idx === 0 ? 'white' : 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 800, flexShrink: 0,
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {BAIT_NAMES[baitId]}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: casts > 0 ? 'var(--text-muted)' : 'var(--danger)' }}>
                          {casts > 0 ? `${casts} casts restantes` : 'Sem estoque'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                        <button onClick={() => handleMoveBaitUp(baitId)} disabled={idx === 0} style={{
                          width: '26px', height: '26px', fontSize: '0.65rem', border: 'none', borderRadius: '6px',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.2 : 0.7,
                          background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'opacity 0.2s ease',
                        }}>&#9650;</button>
                        <button onClick={() => handleMoveBaitDown(baitId)} disabled={idx === orderList.length - 1} style={{
                          width: '26px', height: '26px', fontSize: '0.65rem', border: 'none', borderRadius: '6px',
                          cursor: idx === orderList.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === orderList.length - 1 ? 0.2 : 0.7,
                          background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'opacity 0.2s ease',
                        }}>&#9660;</button>
                        <button onClick={() => handleToggleBaitOrder(baitId)} style={{
                          width: '26px', height: '26px', fontSize: '0.85rem', border: 'none', borderRadius: '6px',
                          cursor: 'pointer', background: 'rgba(248, 81, 73, 0.1)', color: 'var(--danger)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.2s ease',
                        }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(248, 81, 73, 0.25)' }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'rgba(248, 81, 73, 0.1)' }}
                        >&times;</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{
                padding: '16px', textAlign: 'center', marginBottom: '12px',
                borderRadius: '10px', border: '1px dashed rgba(168, 85, 247, 0.2)',
                background: 'rgba(168, 85, 247, 0.03)',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Nenhuma isca na fila
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                  Adicione iscas abaixo para ativar
                </div>
              </div>
            )
          })()}

          {/* Botoes para adicionar */}
          <div style={{
            padding: '10px',
            borderRadius: '10px',
            background: 'rgba(0,0,0,0.1)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Adicionar Isca
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(id => {
                const orderList = autoUseBaitOrder ? autoUseBaitOrder.split(',').map(Number).filter(n => n >= 1 && n <= 10) : []
                const isInList = orderList.includes(id)
                const isUnlocked = playerData ? playerData.rodLevel >= (baitCosts[id]?.unlockLevel || 0) : true
                const casts = baitInventory?.remainingCasts?.[id - 1] || 0
                return (
                  <button
                    key={id}
                    onClick={() => handleToggleBaitOrder(id)}
                    disabled={!isUnlocked}
                    title={!isUnlocked ? `Requer Lv.${baitCosts[id]?.unlockLevel}` : isInList ? 'Remover da fila' : `${BAIT_NAMES[id]} (${casts} casts)`}
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '6px',
                      cursor: !isUnlocked ? 'not-allowed' : 'pointer',
                      background: isInList ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: isInList ? 'var(--purple)' : !isUnlocked ? 'var(--text-muted)' : 'var(--text-secondary)',
                      opacity: !isUnlocked ? 0.3 : isInList ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isInList ? '\u2713 ' : '+ '}{BAIT_NAMES[id]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Card: Auto-Compra de Isca */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <BaitIcon />
              Auto-Compra de Isca
            </h3>
            <div
              onClick={handleToggleAutoBuyBait}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                padding: '4px 12px', borderRadius: '20px',
                background: autoBuyBait ? 'rgba(63, 185, 80, 0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${autoBuyBait ? 'rgba(63, 185, 80, 0.3)' : 'var(--border)'}`,
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: autoBuyBait ? 'var(--success)' : 'var(--text-muted)' }}>
                {autoBuyBait ? 'ON' : 'OFF'}
              </span>
              <div style={{
                width: '32px', height: '18px', borderRadius: '9px',
                background: autoBuyBait ? 'var(--success)' : 'rgba(255,255,255,0.15)',
                position: 'relative', transition: 'background 0.2s ease',
              }}>
                <div style={{
                  width: '14px', height: '14px', borderRadius: '50%', background: 'white',
                  position: 'absolute', top: '2px', left: autoBuyBait ? '16px' : '2px',
                  transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </div>
            </div>
          </div>

          {autoBuyBait && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Iscas selecionaveis com threshold e quantidade individuais */}
              <div style={{
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(0,0,0,0.1)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Iscas para auto-compra
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(id => {
                    const isSelected = autoBuyBaitIds.split(',').filter(Boolean).map(Number).includes(id)
                    const qtyMap = parseBuyQtyMap()
                    const qty = qtyMap[id] || 1
                    const thresholdsMap = parseThresholdsMap()
                    const baitThreshold = thresholdsMap[id] ?? autoBuyBaitThreshold
                    const costInfo = baitCosts[id]
                    const casts = baitInventory?.remainingCasts?.[id - 1] || 0
                    const isUnlocked = playerData ? playerData.rodLevel >= (costInfo?.unlockLevel || 0) : true
                    return (
                      <div key={id} style={{
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(210, 153, 34, 0.08)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(210, 153, 34, 0.15)' : 'transparent'}`,
                        opacity: isUnlocked ? 1 : 0.3,
                        transition: 'all 0.15s ease',
                        overflow: 'hidden',
                      }}>
                        {/* Linha principal: checkbox + nome + info */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '6px 8px',
                        }}>
                          {/* Checkbox visual */}
                          <div
                            onClick={() => isUnlocked && handleAutoBuyBaitIdsChange(id)}
                            style={{
                              width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                              border: `2px solid ${isSelected ? 'var(--warning)' : 'var(--border)'}`,
                              background: isSelected ? 'var(--warning)' : 'transparent',
                              cursor: isUnlocked ? 'pointer' : 'not-allowed',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isSelected && <span style={{ color: '#000', fontSize: '0.65rem', fontWeight: 800 }}>{'\u2713'}</span>}
                          </div>

                          {/* Nome + info */}
                          <div
                            onClick={() => isUnlocked && handleAutoBuyBaitIdsChange(id)}
                            style={{ flex: 1, minWidth: 0, cursor: isUnlocked ? 'pointer' : 'not-allowed' }}
                          >
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {BAIT_NAMES[id]}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                              <span>{casts} casts</span>
                              {costInfo && <span>| {formatFish(Math.round(costInfo.fishCost))} FISH + {costInfo.usdcFee.toFixed(2)} USDC</span>}
                            </div>
                          </div>
                        </div>

                        {/* Sub-seção expandida: threshold slider + qty */}
                        {isSelected && (
                          <div style={{
                            padding: '8px 12px 10px',
                            background: 'rgba(210, 153, 34, 0.04)',
                            borderTop: '1px solid rgba(210, 153, 34, 0.1)',
                            display: 'flex', flexDirection: 'column', gap: '8px',
                          }}>
                            {/* Threshold slider */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Comprar quando &lt; casts</span>
                                <span style={{
                                  padding: '1px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700,
                                  background: 'rgba(210, 153, 34, 0.15)', color: 'var(--warning)',
                                }}>{baitThreshold}</span>
                              </div>
                              <input
                                type="range"
                                min={10} max={500} step={10}
                                value={baitThreshold}
                                onChange={(e) => handleBaitThresholdChange(id, parseInt(e.target.value))}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: '100%', accentColor: 'var(--warning)' }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                <span>10</span>
                                <span>250</span>
                                <span>500</span>
                              </div>
                            </div>

                            {/* Qty input */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Quantidade por compra</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>x</span>
                                <input
                                  type="number"
                                  min={1} max={100}
                                  value={qty}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleBuyQtyChange(id, parseInt(e.target.value) || 1)}
                                  style={{
                                    width: '48px', padding: '4px 6px', fontSize: '0.75rem',
                                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                    border: '1px solid var(--border)', borderRadius: '6px', textAlign: 'center',
                                    fontWeight: 600,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        </div>
      </div>
      )}

      {/* ============ TAB: LOGS ============ */}
      {activeTab === 'logs' && (
        <LogsTab embedded />
      )}

      {/* ============ TAB: CONFIG ============ */}
      {activeTab === 'config' && (
        <ConfigTab embedded />
      )}

    </div>
  )
}

// Funções auxiliares

function formatDateTime(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const time = date.toLocaleTimeString()
  return `${day}/${month} ${time}`
}

// Componentes auxiliares

function StatCard({ icon, label, value, subvalue, color, mono }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subvalue?: string;
  color: string;
  mono?: boolean;
}) {
  return (
    <div className="card" style={{
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'linear-gradient(145deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '2px'
        }}>
          {label}
        </div>
        <div style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          color: color,
          fontFamily: mono ? 'monospace' : 'inherit',
          display: 'flex',
          alignItems: 'baseline',
          gap: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {value}
          {subvalue && (
            <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.7 }}>
              {subvalue}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{
        width: '14px',
        height: '14px',
        backgroundColor: color,
        borderRadius: '4px',
        boxShadow: `0 2px 8px ${color}40`
      }} />
      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        {label} ({value})
      </span>
    </div>
  )
}

function PieChart({ catches, misses }: { catches: number; misses: number }) {
  const total = catches + misses
  const catchPercent = (catches / total) * 100

  const catchAngle = (catchPercent / 100) * 360
  const radius = 85
  const centerX = 100
  const centerY = 100

  const catchPath = describeArc(centerX, centerY, radius, 0, catchAngle)
  const missPath = describeArc(centerX, centerY, radius, catchAngle, 360)

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '200px' }}>
      <svg width="100%" height="100%" viewBox="0 0 200 200" style={{ display: 'block' }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path
          d={`M ${centerX} ${centerY} ${catchPath} Z`}
          fill="var(--success)"
          stroke="var(--bg-primary)"
          strokeWidth="3"
          filter="url(#glow)"
        />
        <path
          d={`M ${centerX} ${centerY} ${missPath} Z`}
          fill="var(--danger)"
          stroke="var(--bg-primary)"
          strokeWidth="3"
        />
        <circle cx={centerX} cy={centerY} r="55" fill="var(--bg-secondary)" />
        <text
          x={centerX}
          y={centerY - 8}
          textAnchor="middle"
          fill="var(--accent)"
          fontSize="28"
          fontWeight="bold"
        >
          {catchPercent.toFixed(1)}%
        </text>
        <text
          x={centerX}
          y={centerY + 16}
          textAnchor="middle"
          fill="var(--text-secondary)"
          fontSize="12"
        >
          sucesso
        </text>
      </svg>
    </div>
  )
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

function MiniStat({ label, value, color, percent }: { label: string; value: string; color: string; percent: number }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{
        width: '100%',
        height: '6px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, percent)}%`,
          height: '100%',
          background: color,
          borderRadius: '3px',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}

function ProgressChart({ totalFish, catches }: { totalFish: number; catches: number }) {
  const avgFish = catches > 0 ? totalFish / catches : 0

  return (
    <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
      <ProgressBar
        label="Total Pescado"
        value={totalFish}
        unit="FISH"
        color="var(--warning)"
        percent={80}
      />
      <ProgressBar
        label="Total Catches"
        value={catches}
        unit="catches"
        color="var(--success)"
        percent={60}
      />
      <ProgressBar
        label="Media/Catch"
        value={avgFish}
        unit="FISH"
        color="var(--accent)"
        percent={50}
      />
    </div>
  )
}

function ProgressBar({ label, value, unit, color, percent }: { label: string; value: number; unit: string; color: string; percent: number }) {
  return (
    <div style={{
      flex: 1,
      minWidth: '180px',
      maxWidth: '280px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px'
    }}>
      <div style={{
        width: '100%',
        height: '160px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{
          width: '100%',
          height: `${percent}%`,
          background: `linear-gradient(180deg, ${color} 0%, ${color}80 100%)`,
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '4px',
          transition: 'height 0.5s ease',
          boxShadow: `0 -4px 20px ${color}40`
        }}>
          <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {typeof value === 'number' ? (value >= 1000 ? value.toFixed(0) : value.toFixed(value % 1 === 0 ? 0 : 2)) : value}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', textTransform: 'lowercase' }}>{unit}</span>
        </div>
      </div>
      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
    </div>
  )
}

function DailyProjectionChart({
  series,
  todayTotalFish,
  projectedTotalFish,
}: {
  series: Array<{ label: string; cumulativeFish: number; fish: number }>
  todayTotalFish: number
  projectedTotalFish: number
}) {
  const width = 680
  const height = 220
  const paddingX = 20
  const topPadding = 18
  const bottomPadding = 28
  const chartHeight = height - topPadding - bottomPadding
  const nowHour = new Date().getHours()
  const clampedHour = Math.max(0, Math.min(23, nowHour))
  const maxBarValue = Math.max(1, ...series.map(point => point.fish))
  const maxLineValue = Math.max(1, todayTotalFish, projectedTotalFish, ...series.map(point => point.cumulativeFish))

  const getX = (index: number) =>
    paddingX + (index * (width - paddingX * 2)) / Math.max(1, series.length - 1)
  const getBarHeight = (value: number) => (value / maxBarValue) * (chartHeight * 0.45)
  const getLineY = (value: number) => topPadding + (1 - value / maxLineValue) * chartHeight

  const realPoints = series
    .map((point, index) => `${getX(index)},${getLineY(point.cumulativeFish)}`)
    .join(' ')

  const currentPointX = getX(clampedHour)
  const currentPointY = getLineY(todayTotalFish)
  const projectionPoints = Array.from({ length: 24 - clampedHour }, (_, offset) => {
    const hourIndex = clampedHour + offset
    const progress = offset / Math.max(1, 23 - clampedHour)
    const projectedValue = todayTotalFish + (projectedTotalFish - todayTotalFish) * progress
    return `${getX(hourIndex)},${getLineY(projectedValue)}`
  }).join(' ')

  return (
    <div style={{
      padding: '14px',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.45) 0%, rgba(0, 0, 0, 0.15) 100%)'
    }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '220px', display: 'block' }}>
        <defs>
          <linearGradient id="dailyFishLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--warning)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
          <linearGradient id="dailyFishBars" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(88, 166, 255, 0.65)" />
            <stop offset="100%" stopColor="rgba(88, 166, 255, 0.12)" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const y = topPadding + ratio * chartHeight
          return (
            <line
              key={index}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 6"
            />
          )
        })}
        {series.map((point, index) => {
          const barHeight = getBarHeight(point.fish)
          const x = getX(index) - 8
          const y = height - bottomPadding - barHeight
          return (
            <rect
              key={`${point.label}-bar`}
              x={x}
              y={y}
              width="16"
              height={barHeight}
              rx="5"
              fill="url(#dailyFishBars)"
              stroke="rgba(88, 166, 255, 0.18)"
            />
          )
        })}
        <polyline
          fill="none"
          stroke="url(#dailyFishLine)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={realPoints}
        />
        {projectionPoints.length > 0 && (
          <polyline
            fill="none"
            stroke="rgba(251, 191, 36, 0.9)"
            strokeWidth="3"
            strokeDasharray="8 8"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={`${currentPointX},${currentPointY} ${projectionPoints}`}
          />
        )}
        <circle cx={currentPointX} cy={currentPointY} r="4.5" fill="var(--accent)" stroke="white" strokeWidth="1.5" />
        {series.filter((_, index) => index % 4 === 0 || index === series.length - 1).map((point, index) => {
          const originalIndex = series.findIndex(item => item.label === point.label)
          const x = getX(originalIndex)
          return (
            <text
              key={`${point.label}-${index}`}
              x={x}
              y={height - 6}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="10"
            >
              {point.label.slice(0, 2)}
            </text>
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.76rem', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '10px' }}>
        <span>Barras: fish por hora | Linha: acumulado real | Tracejado: projeção</span>
        <span>Hoje: {todayTotalFish.toFixed(2)} | Estimado: {projectedTotalFish.toFixed(2)}</span>
      </div>
    </div>
  )
}

function FishTypeCard({ fishType }: { fishType: BotAnalytics['fishTypes'][number] }) {
  const statusColors = {
    normal: 'var(--success)',
    attention: 'var(--warning)',
    late: 'var(--danger)',
    insufficient_data: 'var(--text-secondary)',
  } as const

  const statusLabels = {
    normal: 'No ritmo',
    attention: 'Em atencao',
    late: 'Atrasado',
    insufficient_data: 'Pouca amostra',
  } as const

  const color = statusColors[fishType.status]

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: '12px',
      border: `1px solid ${color}33`,
      background: `${color}12`,
      display: 'grid',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color }}>
            +{fishType.amountLabel} fish
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            {fishType.count} ocorrencias | {fishType.probability.toFixed(1)}% dos catches
          </div>
        </div>
        <span className="badge" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
          {statusLabels[fishType.status]}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timer</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{formatDurationMs(fishType.timeSinceLastMs)}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Media</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{formatDurationMs(fishType.averageGapMs)}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Maior gap</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{formatDurationMs(fishType.maxGapMs)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
        <span>Ultimo: {fishType.lastSeenAt ? formatDateTime(new Date(fishType.lastSeenAt)) : '-'}</span>
        <span>Indice: {fishType.overdueRatio ? `${fishType.overdueRatio.toFixed(2)}x` : '-'}</span>
      </div>
    </div>
  )
}

function ComparisonCard({
  label,
  today,
  yesterday,
  delta,
  percent,
  accent,
  suffix = '',
}: {
  label: string
  today: string
  yesterday: string
  delta: number
  percent?: number | null
  accent: string
  suffix?: string
}) {
  const positive = delta >= 0
  const deltaColor = positive ? 'var(--success)' : 'var(--danger)'
  const decimals = Math.abs(delta) < 10 ? 2 : 0

  return (
    <div style={{
      padding: '12px',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      background: 'rgba(0,0,0,0.14)',
      display: 'grid',
      gap: '8px',
    }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: accent }}>{today}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ontem: {yesterday}</div>
      <div style={{ fontSize: '0.82rem', color: deltaColor, fontWeight: 700 }}>
        {positive ? '+' : ''}{delta.toFixed(decimals)}{suffix}
        {percent !== undefined && percent !== null ? ` (${positive ? '+' : ''}${percent.toFixed(1)}%)` : ''}
      </div>
    </div>
  )
}

function formatDurationMs(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  const totalSeconds = Math.max(0, Math.round(value / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function safeRate(catches: number, misses: number): number {
  return catches + misses > 0 ? (catches / (catches + misses)) * 100 : 0
}

// Icons (inline SVG)
function FishingRodIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l4-4 8 8"/>
      <path d="M21 3l-6 6"/>
      <path d="M15 9l-3 3"/>
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  )
}

function FishIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6-3.56 0-7.56-2.54-8.5-6z"/>
      <path d="M18 12v.5"/>
      <path d="M16 17.93a9.77 9.77 0 0 1-3 .07"/>
      <path d="M8 6a7.5 7.5 0 0 0-4 4 7.5 7.5 0 0 0 4 4"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  )
}

function WrenchIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
      <path d="M22 12A10 10 0 0 0 12 2v10z"/>
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  )
}

function BarChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"/>
      <line x1="18" y1="20" x2="18" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="16"/>
    </svg>
  )
}

function ZapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

function CastIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  )
}

function AvgIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/>
      <line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/>
      <line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/>
      <line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

function UpgradeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  )
}

function BaitIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
      <path d="M12 8v4"/>
      <path d="M9 12c0 3 1.5 6 3 8 1.5-2 3-5 3-8"/>
      <circle cx="12" cy="20" r="2"/>
    </svg>
  )
}
