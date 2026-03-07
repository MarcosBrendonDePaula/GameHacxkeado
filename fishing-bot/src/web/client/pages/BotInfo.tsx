import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import { getBot, getResults, getHistory, startBot, stopBot, getPlayerState, startUpgrade, finishUpgrade, updateBotConfig, getWalletBalances } from '../lib/api'

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

  const [botExists, setBotExists] = useState(false)
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null)
  const [botStats, setBotStats] = useState<BotStats | null>(null)
  const [playerData, setPlayerData] = useState<PlayerData | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<CastResult[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [balances, setBalances] = useState<{ fogo: number; fish: number; usdc: number } | null>(null)
  const [autoUpgrade, setAutoUpgrade] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!isConnected || !walletPubkey) {
      setLoading(false)
      return
    }

    try {
      const data = await getBot()
      setBotExists(data.exists)

      if (data.exists) {
        setBotInfo(data.bot)
        setBotStats(data.stats)
        setIsRunning(data.isRunning || false)

        // Busca autoUpgrade do bot
        if (data.bot?.autoUpgrade !== undefined) {
          setAutoUpgrade(data.bot.autoUpgrade)
        }

        // Busca resultados, historico, dados do player e balances
        const [resultsData, historyData, playerStateData, balancesData] = await Promise.all([
          getResults({ limit: 50 }),
          getHistory({ limit: 100 }),
          getPlayerState(walletPubkey),
          getWalletBalances(walletPubkey).catch(() => null)
        ])
        setResults(resultsData.results || [])
        setHistory(historyData.history || [])
        if (playerStateData.exists && playerStateData.player) {
          setPlayerData(playerStateData.player)
        }
        if (balancesData && !balancesData.error) {
          setBalances(balancesData)
        }
      }
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
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
          <h2 style={{
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Dashboard
          </h2>
          <span className={`status-badge ${isRunning ? 'online' : 'offline'}`}>
            {isRunning ? 'Online' : 'Offline'}
          </span>
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

      {/* ============ LAYOUT 3 COLUNAS ============ */}
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
              }}>
                <div style={{
                  width: `${durabilityPercent}%`,
                  height: '100%',
                  background: durabilityColor,
                  borderRadius: '5px',
                  transition: 'width 0.5s ease',
                  boxShadow: `0 0 10px ${durabilityColor}60`,
                }} />
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: durabilityColor, marginTop: '2px' }}>
                {durabilityPercent}%
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

              {/* Auto-upgrade toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                marginBottom: '12px',
                background: autoUpgrade ? 'rgba(63, 185, 80, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${autoUpgrade ? 'rgba(63, 185, 80, 0.2)' : 'var(--border)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
              }} onClick={handleToggleAutoUpgrade}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Auto-upgrade</span>
                <div style={{
                  width: '36px',
                  height: '20px',
                  borderRadius: '10px',
                  background: autoUpgrade ? 'var(--success)' : 'rgba(255,255,255,0.15)',
                  position: 'relative',
                  transition: 'background 0.2s ease',
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: autoUpgrade ? '18px' : '2px',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </div>
              </div>

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
                return (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
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
                        background: 'rgba(168, 85, 247, 0.08)',
                        border: '1px solid rgba(168, 85, 247, 0.2)',
                        borderRadius: '8px',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '2px' }}>FOGO</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--purple)' }}>{fogoCost.toLocaleString('pt-BR')}</div>
                      </div>
                    </div>

                    <button
                      onClick={handleStartUpgrade}
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
                        background: 'linear-gradient(135deg, var(--gold) 0%, #f59e0b 100%)',
                        color: '#1a1a2e',
                        boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)',
                      }}
                    >
                      {upgradeLoading ? 'Iniciando...' : `Upgrade → Lv.${nextLevel}`}
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
