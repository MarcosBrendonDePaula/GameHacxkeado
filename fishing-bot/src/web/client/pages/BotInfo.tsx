import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import { getBot, getResults, getHistory, startBot, stopBot, getEncryptionSignature } from '../lib/api'

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

export default function BotInfo() {
  const navigate = useNavigate()
  const { isConnected, walletPubkey } = useAuth()

  const [botExists, setBotExists] = useState(false)
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null)
  const [botStats, setBotStats] = useState<BotStats | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<CastResult[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!isConnected) {
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

        // Busca resultados e historico
        const [resultsData, historyData] = await Promise.all([
          getResults({ limit: 50 }),
          getHistory({ limit: 100 })
        ])
        setResults(resultsData.results || [])
        setHistory(historyData.history || [])
      }
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isConnected])

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
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h3>Conecte sua carteira</h3>
        <p style={{ color: '#888', marginTop: '1rem' }}>
          Use o botao "+ Carteira" no menu para conectar.
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
        <h2>Erro</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')} style={{ marginTop: '20px' }}>
          Voltar para o Dashboard
        </button>
      </div>
    )
  }

  if (!botExists) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h3>Nenhum bot configurado</h3>
        <p style={{ color: '#888', marginTop: '1rem' }}>
          Va para "Configurar Bot" para criar uma session e configurar seu bot.
        </p>
        <button onClick={() => navigate('/config')} style={{ marginTop: '1rem' }}>
          Configurar Bot
        </button>
      </div>
    )
  }

  // Stats podem ser null se o bot não estiver rodando
  const catches = botStats?.catches || 0
  const misses = botStats?.misses || 0
  const totalFish = botStats?.totalFish || 0
  const delay = botStats?.delay || botInfo?.delay || 500
  const uptime = botStats?.uptime || '-'

  const totalCasts = catches + misses
  const successRate = totalCasts > 0 ? ((catches / totalCasts) * 100).toFixed(1) : '0.0'
  const avgFishPerCatch = catches > 0 ? (totalFish / catches).toFixed(2) : '0.00'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h2 style={{ margin: 0 }}>Dashboard</h2>
          <span
            className={`status-badge ${isRunning ? 'online' : 'offline'}`}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}
          >
            {isRunning ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Botões de Controle */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {actionError && (
            <span style={{ color: '#f85149', fontSize: '0.85rem' }}>{actionError}</span>
          )}
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={actionLoading}
              style={{
                padding: '10px 24px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#da3633',
                color: 'white',
                fontWeight: 'bold',
                cursor: actionLoading ? 'wait' : 'pointer',
                opacity: actionLoading ? 0.7 : 1,
              }}
            >
              {actionLoading ? 'Parando...' : 'Parar Bot'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              style={{
                padding: '10px 24px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#238636',
                color: 'white',
                fontWeight: 'bold',
                cursor: actionLoading ? 'wait' : 'pointer',
                opacity: actionLoading ? 0.7 : 1,
              }}
            >
              {actionLoading ? 'Iniciando...' : 'Iniciar Bot'}
            </button>
          )}
        </div>
      </div>

      {/* Grid Principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Estatísticas Gerais */}
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '20px',
        }}>
          <h3 style={{ marginBottom: '20px', color: '#58a6ff' }}>Estatisticas Gerais</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <StatRow label="🎣 Rod Level" value={botStats?.rodLevel?.toString() || '-'} color="#ffd700" />
            <StatRow
              label="🔧 Durabilidade"
              value={botStats?.durability ? `${botStats.durability.current}/${botStats.durability.max} (${botStats.durability.percent}%)` : '-'}
              color={botStats?.durability?.percent && botStats.durability.percent <= 20 ? '#f85149' : '#4ade80'}
            />
            <StatRow label="Total de Casts" value={totalCasts.toLocaleString()} />
            <StatRow label="Catches" value={catches.toLocaleString()} color="#3fb950" />
            <StatRow label="Misses" value={misses.toLocaleString()} color="#f85149" />
            <StatRow label="Taxa de Sucesso" value={`${successRate}%`} color="#58a6ff" />
            <StatRow label="Total Fish Pescado" value={totalFish.toFixed(2)} color="#d29922" />
            <StatRow label="Media por Catch" value={`${avgFishPerCatch} fish`} color="#8b949e" />
            <StatRow label="Delay entre Casts" value={`${delay}ms`} />
            <StatRow label="Uptime" value={uptime} color="#bc8cff" />
            <StatRow label="Wallet" value={`${walletPubkey?.slice(0, 8)}...${walletPubkey?.slice(-6)}`} />
            {botInfo?.sessionPubkey && (
              <StatRow label="Session" value={`${botInfo.sessionPubkey.slice(0, 8)}...${botInfo.sessionPubkey.slice(-6)}`} />
            )}
            <StatRow
              label="Proxy"
              value={botInfo?.proxy ? `${botInfo.proxy.slice(0, 25)}${botInfo.proxy.length > 25 ? '...' : ''}` : 'Nao configurado'}
              color={botInfo?.proxy ? '#4ade80' : '#f85149'}
            />
          </div>
        </div>

        {/* Gráfico de Pizza - Taxa de Sucesso */}
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '20px',
        }}>
          <h3 style={{ marginBottom: '20px', color: '#58a6ff' }}>Taxa de Acerto</h3>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            {totalCasts > 0 ? (
              <PieChart catches={catches} misses={misses} />
            ) : (
              <p style={{ color: '#8b949e', textAlign: 'center' }}>
                Nenhum cast realizado ainda
              </p>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: '#3fb950', borderRadius: '4px' }} />
              <span style={{ fontSize: '0.9rem', color: '#8b949e' }}>
                Catches ({catches})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: '#f85149', borderRadius: '4px' }} />
              <span style={{ fontSize: '0.9rem', color: '#8b949e' }}>
                Misses ({misses})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Resultados Recentes */}
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
      }}>
        <h3 style={{ marginBottom: '20px', color: '#58a6ff' }}>Resultados Recentes</h3>
        {results.length === 0 ? (
          <p style={{ color: '#8b949e', textAlign: 'center', padding: '1rem' }}>
            Nenhum resultado ainda
          </p>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {results.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem',
                  borderBottom: '1px solid #333',
                  backgroundColor: r.type === 'catch' ? 'rgba(0,255,0,0.05)' : 'rgba(255,0,0,0.05)'
                }}
              >
                <span>{r.type === 'catch' ? 'CATCH' : 'MISS'}</span>
                <span>{r.fishAmount ? `+${r.fishAmount.toFixed(3)}` : '-'}</span>
                <span style={{ color: '#888', fontSize: '0.8rem' }}>
                  {new Date(r.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gráfico de Progresso */}
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '20px',
      }}>
        <h3 style={{ marginBottom: '20px', color: '#58a6ff' }}>Progresso de Fish Pescado</h3>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <ProgressChart totalFish={totalFish} catches={catches} />
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#8b949e', fontSize: '0.9rem' }}>{label}</span>
      <span style={{
        color: color || '#c9d1d9',
        fontWeight: 'bold',
        fontSize: '0.95rem',
      }}>
        {value}
      </span>
    </div>
  )
}

function PieChart({ catches, misses }: { catches: number; misses: number }) {
  const total = catches + misses
  const catchPercent = (catches / total) * 100

  const catchAngle = (catchPercent / 100) * 360
  const radius = 80
  const centerX = 100
  const centerY = 100

  const catchPath = describeArc(centerX, centerY, radius, 0, catchAngle)
  const missPath = describeArc(centerX, centerY, radius, catchAngle, 360)

  return (
    <div style={{ position: 'relative' }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        <path
          d={`M ${centerX} ${centerY} ${catchPath} Z`}
          fill="#3fb950"
          stroke="#0d1117"
          strokeWidth="2"
        />
        <path
          d={`M ${centerX} ${centerY} ${missPath} Z`}
          fill="#f85149"
          stroke="#0d1117"
          strokeWidth="2"
        />
        <circle cx={centerX} cy={centerY} r="50" fill="#161b22" />
        <text
          x={centerX}
          y={centerY - 10}
          textAnchor="middle"
          fill="#58a6ff"
          fontSize="24"
          fontWeight="bold"
        >
          {catchPercent.toFixed(1)}%
        </text>
        <text
          x={centerX}
          y={centerY + 15}
          textAnchor="middle"
          fill="#8b949e"
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
  return (
    <div style={{ width: '100%', maxWidth: '800px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', height: '200px', padding: '20px' }}>
        {/* Barra de Total Fish */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '100%',
            backgroundColor: '#0d1117',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            height: '100%',
            border: '1px solid #30363d',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '100%',
              height: '80%',
              backgroundColor: '#d29922',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '5px',
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                {totalFish.toFixed(1)}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>FISH</span>
            </div>
          </div>
          <span style={{ fontSize: '0.9rem', color: '#8b949e' }}>Total Pescado</span>
        </div>

        {/* Barra de Catches */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '100%',
            backgroundColor: '#0d1117',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            height: '100%',
            border: '1px solid #30363d',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '100%',
              height: '60%',
              backgroundColor: '#3fb950',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '5px',
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                {catches}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>catches</span>
            </div>
          </div>
          <span style={{ fontSize: '0.9rem', color: '#8b949e' }}>Total Catches</span>
        </div>

        {/* Barra de Média */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '100%',
            backgroundColor: '#0d1117',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            height: '100%',
            border: '1px solid #30363d',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '100%',
              height: '50%',
              backgroundColor: '#58a6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '5px',
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                {catches > 0 ? (totalFish / catches).toFixed(2) : '0'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>FISH</span>
            </div>
          </div>
          <span style={{ fontSize: '0.9rem', color: '#8b949e' }}>Media/Catch</span>
        </div>
      </div>
    </div>
  )
}
