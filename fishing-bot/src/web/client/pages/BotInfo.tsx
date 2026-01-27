import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import { getBot, getResults, getHistory, startBot, stopBot, getEncryptionSignature, getPlayerState } from '../lib/api'

interface BotStats {
  walletPubkey: string
  status: 'online' | 'offline'
  catches: number
  misses: number
  totalFish: number
  delay: number
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
  delay: number | null
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
}

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
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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

        // Busca resultados, historico e dados do player da blockchain
        const [resultsData, historyData, playerStateData] = await Promise.all([
          getResults({ limit: 50 }),
          getHistory({ limit: 100 }),
          getPlayerState(walletPubkey)
        ])
        setResults(resultsData.results || [])
        setHistory(historyData.history || [])
        if (playerStateData.exists && playerStateData.player) {
          setPlayerData(playerStateData.player)
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
      const encryptionSignature = await getEncryptionSignature()
      const result = await startBot(encryptionSignature)
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

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (!isConnected) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.8 }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent)' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontWeight: 600 }}>Conecte sua Carteira</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
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
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.8 }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--warning)' }}>
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
        </div>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontWeight: 600 }}>Nenhum Bot Configurado</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
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
  const delay = botStats?.delay || botInfo?.delay || 500
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

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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

        {/* Botoes de Controle */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
            <button
              onClick={handleStop}
              disabled={actionLoading}
              className="btn-danger"
              style={{ padding: '12px 28px', fontSize: '0.95rem' }}
            >
              {actionLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="spinner" style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Parando...
                </span>
              ) : 'Parar Bot'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="btn-success"
              style={{ padding: '12px 28px', fontSize: '0.95rem' }}
            >
              {actionLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Iniciando...
                </span>
              ) : 'Iniciar Bot'}
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards - Principais */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <StatCard
          icon={<FishingRodIcon />}
          label="Rod Level"
          value={rodLevel?.toString() || '-'}
          color="var(--gold)"
        />
        <StatCard
          icon={<WrenchIcon />}
          label="Durabilidade"
          value={durability ? `${durability.current}/${durability.max}` : '-'}
          subvalue={durability ? `${durability.percent}%` : undefined}
          color={durabilityColor}
        />
        <StatCard
          icon={<TargetIcon />}
          label="Taxa de Sucesso"
          value={`${successRate}%`}
          color="var(--accent)"
        />
        <StatCard
          icon={<CheckIcon />}
          label="Catches"
          value={catches.toLocaleString()}
          color="var(--success)"
        />
        <StatCard
          icon={<XIcon />}
          label="Misses"
          value={misses.toLocaleString()}
          color="var(--danger)"
        />
        <StatCard
          icon={<FishIcon />}
          label="Total Fish"
          value={totalFish.toFixed(2)}
          color="var(--warning)"
        />
      </div>

      {/* Stats Cards - Detalhes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <StatCard
          icon={<ClockIcon />}
          label="Uptime"
          value={uptime}
          color="var(--purple)"
        />
        <StatCard
          icon={<ZapIcon />}
          label="Delay"
          value={`${delay}ms`}
          color="var(--text-secondary)"
        />
        <StatCard
          icon={<CastIcon />}
          label="Total Casts"
          value={totalCasts.toLocaleString()}
          color="var(--accent)"
        />
        <StatCard
          icon={<AvgIcon />}
          label="Media/Catch"
          value={`${avgFishPerCatch}`}
          subvalue="fish"
          color="var(--text-secondary)"
        />
        <StatCard
          icon={<WalletIcon />}
          label="Wallet"
          value={`${walletPubkey?.slice(0, 4)}...${walletPubkey?.slice(-4)}`}
          color="var(--text-secondary)"
          mono
        />
        <StatCard
          icon={<KeyIcon />}
          label="Session"
          value={botInfo?.sessionPubkey ? `${botInfo.sessionPubkey.slice(0, 4)}...${botInfo.sessionPubkey.slice(-4)}` : '-'}
          color="var(--text-secondary)"
          mono
        />
        <StatCard
          icon={<GlobeIcon />}
          label="Proxy"
          value={botInfo?.proxy ? 'Ativo' : 'Inativo'}
          color={botInfo?.proxy ? 'var(--success)' : 'var(--text-muted)'}
        />
      </div>

      {/* Grafico de Pizza */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h3 style={{
          marginBottom: '20px',
          fontSize: '1.1rem',
          fontWeight: 600,
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <ChartIcon />
          Taxa de Acerto
        </h3>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '220px' }}>
          {totalCasts > 0 ? (
            <PieChart catches={catches} misses={misses} />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', opacity: 0.5, marginBottom: '12px' }}>
                <ChartIcon />
              </div>
              <p>Nenhum cast realizado ainda</p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '20px' }}>
          <LegendItem color="var(--success)" label="Catches" value={catches} />
          <LegendItem color="var(--danger)" label="Misses" value={misses} />
        </div>
      </div>

      {/* Resultados Recentes */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h3 style={{
          marginBottom: '20px',
          fontSize: '1.1rem',
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
            maxHeight: '320px',
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
                  padding: '12px 16px',
                  borderBottom: index < results.length - 1 ? '1px solid var(--border)' : 'none',
                  background: r.type === 'catch'
                    ? 'rgba(63, 185, 80, 0.05)'
                    : 'rgba(248, 81, 73, 0.05)',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className={`badge ${r.type === 'catch' ? 'success' : 'danger'}`}>
                    {r.type === 'catch' ? 'CATCH' : 'MISS'}
                  </span>
                  <span style={{
                    fontWeight: 600,
                    color: r.type === 'catch' ? 'var(--success)' : 'var(--text-secondary)'
                  }}>
                    {r.fishAmount ? `+${r.fishAmount.toFixed(3)} fish` : '-'}
                  </span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                  {new Date(r.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grafico de Progresso */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{
          marginBottom: '24px',
          fontSize: '1.1rem',
          fontWeight: 600,
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <BarChartIcon />
          Progresso de Fish Pescado
        </h3>
        <ProgressChart totalFish={totalFish} catches={catches} />
      </div>
    </div>
  )
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
    <div style={{ position: 'relative' }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
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
