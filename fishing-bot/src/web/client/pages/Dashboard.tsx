import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../providers/AuthProvider'
import {
  getGlobalStats,
  getBot,
  startBot,
  stopBot,
  getResults,
  getHistory,
  getEncryptionSignature
} from '../lib/api'

interface GlobalStats {
  totalBots: number
  activeBots: number
  totalCatches: number
  totalMisses: number
  totalFish: number
}

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

export default function Dashboard() {
  const { isConnected, walletPubkey, sessionState } = useAuth()

  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null)
  const [botStats, setBotStats] = useState<BotStats | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [botExists, setBotExists] = useState(false)
  const [results, setResults] = useState<CastResult[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Busca stats globais (público)
  const fetchGlobalStats = useCallback(async () => {
    try {
      const data = await getGlobalStats()
      setGlobalStats(data)
    } catch (err) {
      console.error('Erro ao buscar stats globais:', err)
    }
  }, [])

  // Busca dados do bot do usuário
  const fetchBotData = useCallback(async () => {
    if (!isConnected) {
      setBotInfo(null)
      setBotStats(null)
      setBotExists(false)
      setResults([])
      setHistory([])
      return
    }

    try {
      const data = await getBot()
      setBotExists(data.exists)

      if (data.exists) {
        setBotInfo(data.bot)
        setBotStats(data.stats)
        setIsRunning(data.isRunning || false)

        // Busca resultados e histórico
        const [resultsData, historyData] = await Promise.all([
          getResults({ limit: 20 }),
          getHistory({ limit: 50 })
        ])
        setResults(resultsData.results || [])
        setHistory(historyData.history || [])
      }
      setError(null)
    } catch (err: any) {
      console.error('Erro ao buscar dados do bot:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isConnected])

  // Efeito inicial e polling
  useEffect(() => {
    fetchGlobalStats()
    const interval = setInterval(fetchGlobalStats, 10000)
    return () => clearInterval(interval)
  }, [fetchGlobalStats])

  useEffect(() => {
    if (isConnected) {
      setLoading(true)
      fetchBotData()
      const interval = setInterval(fetchBotData, 3000)
      return () => clearInterval(interval)
    } else {
      setLoading(false)
    }
  }, [isConnected, fetchBotData])

  // Ações do bot
  const handleStartBot = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const encSig = await getEncryptionSignature()
      const result = await startBot(encSig)
      if (!result.success) {
        setError(result.error || 'Erro ao iniciar bot')
      } else {
        setIsRunning(true)
        fetchBotData()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleStopBot = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const result = await stopBot()
      if (!result.success) {
        setError(result.error || 'Erro ao parar bot')
      } else {
        setIsRunning(false)
        fetchBotData()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Calcula taxa de sucesso
  const successRate = botStats
    ? botStats.catches + botStats.misses > 0
      ? ((botStats.catches / (botStats.catches + botStats.misses)) * 100).toFixed(1)
      : '0.0'
    : '0.0'

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>

      {/* Stats Globais */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Bots Ativos</h3>
          <span className="stat-value">{globalStats?.activeBots || 0}/{globalStats?.totalBots || 0}</span>
        </div>
        <div className="stat-card">
          <h3>Total Catches</h3>
          <span className="stat-value">{globalStats?.totalCatches?.toLocaleString() || 0}</span>
        </div>
        <div className="stat-card">
          <h3>Total Fish</h3>
          <span className="stat-value">{globalStats?.totalFish?.toFixed(2) || '0.00'}</span>
        </div>
      </div>

      {/* Estado de conexão */}
      {!isConnected ? (
        <div className="card" style={{ marginTop: '2rem', textAlign: 'center', padding: '3rem' }}>
          <h3>Conecte sua carteira</h3>
          <p style={{ color: '#888', marginTop: '1rem' }}>
            Use o botão "+ Carteira" no menu para conectar sua wallet e gerenciar seu bot.
          </p>
        </div>
      ) : loading ? (
        <div className="card" style={{ marginTop: '2rem', textAlign: 'center', padding: '3rem' }}>
          <p>Carregando...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ marginTop: '2rem', textAlign: 'center', padding: '2rem', borderColor: '#f00' }}>
          <p style={{ color: '#f66' }}>Erro: {error}</p>
          <button onClick={fetchBotData} style={{ marginTop: '1rem' }}>Tentar novamente</button>
        </div>
      ) : !botExists ? (
        <div className="card" style={{ marginTop: '2rem', textAlign: 'center', padding: '3rem' }}>
          <h3>Nenhum bot configurado</h3>
          <p style={{ color: '#888', marginTop: '1rem' }}>
            Vá para "+ Carteira" para criar uma session e configurar seu bot.
          </p>
          <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Wallet: {walletPubkey?.slice(0, 8)}...{walletPubkey?.slice(-8)}
          </p>
        </div>
      ) : (
        <>
          {/* Meu Bot */}
          <div className="card" style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Meu Bot</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className={`status-badge ${isRunning ? 'online' : 'offline'}`}>
                  {isRunning ? 'Online' : 'Offline'}
                </span>
                {isRunning ? (
                  <button
                    onClick={handleStopBot}
                    disabled={actionLoading}
                    className="btn-danger"
                  >
                    {actionLoading ? 'Parando...' : 'Parar'}
                  </button>
                ) : (
                  <button
                    onClick={handleStartBot}
                    disabled={actionLoading}
                    className="btn-success"
                  >
                    {actionLoading ? 'Iniciando...' : 'Iniciar'}
                  </button>
                )}
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card small">
                <h4>🎣 Rod Level</h4>
                <span className="stat-value">{botStats?.rodLevel || '-'}</span>
              </div>
              <div className="stat-card small">
                <h4>🔧 Durabilidade</h4>
                <span className="stat-value" style={{ color: botStats?.durability?.percent && botStats.durability.percent <= 20 ? '#f85149' : '#4ade80' }}>
                  {botStats?.durability ? `${botStats.durability.percent}%` : '-'}
                </span>
              </div>
              <div className="stat-card small">
                <h4>Catches</h4>
                <span className="stat-value">{botStats?.catches || 0}</span>
              </div>
              <div className="stat-card small">
                <h4>Misses</h4>
                <span className="stat-value">{botStats?.misses || 0}</span>
              </div>
              <div className="stat-card small">
                <h4>Taxa</h4>
                <span className="stat-value">{successRate}%</span>
              </div>
              <div className="stat-card small">
                <h4>Fish</h4>
                <span className="stat-value">{botStats?.totalFish?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="stat-card small">
                <h4>Uptime</h4>
                <span className="stat-value">{botStats?.uptime || '-'}</span>
              </div>
              <div className="stat-card small">
                <h4>Pendentes</h4>
                <span className="stat-value">{botStats?.pendingCasts || 0}</span>
              </div>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#888' }}>
              <p>Wallet: {walletPubkey?.slice(0, 12)}...{walletPubkey?.slice(-12)}</p>
              <p>Session: {botInfo?.sessionPubkey?.slice(0, 12)}...{botInfo?.sessionPubkey?.slice(-12)}</p>
              <p>Delay: {botInfo?.delay || 500}ms</p>
            </div>
          </div>

          {/* Resultados Recentes */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3>Resultados Recentes</h3>
            {results.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '1rem' }}>
                Nenhum resultado ainda
              </p>
            ) : (
              <div className="results-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {results.map((r) => (
                  <div
                    key={r.id}
                    className={`result-item ${r.type}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.5rem',
                      borderBottom: '1px solid #333',
                      backgroundColor: r.type === 'catch' ? 'rgba(0,255,0,0.05)' : 'rgba(255,0,0,0.05)'
                    }}
                  >
                    <span>{r.type === 'catch' ? '🐟' : '🔴'} {r.type.toUpperCase()}</span>
                    <span>{r.fishAmount ? `+${r.fishAmount.toFixed(3)}` : '-'}</span>
                    <span style={{ color: '#888', fontSize: '0.8rem' }}>
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        .dashboard h2 {
          margin-bottom: 1.5rem;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }
        .stat-card {
          background: #1a1a2e;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        }
        .stat-card.small {
          padding: 1rem;
        }
        .stat-card h3, .stat-card h4 {
          color: #888;
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
        }
        .stat-value {
          font-size: 1.8rem;
          font-weight: bold;
          color: #fff;
        }
        .stat-card.small .stat-value {
          font-size: 1.4rem;
        }
        .card {
          background: #1a1a2e;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 1.5rem;
        }
        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: bold;
        }
        .status-badge.online {
          background: rgba(0, 255, 0, 0.2);
          color: #0f0;
        }
        .status-badge.offline {
          background: rgba(255, 0, 0, 0.2);
          color: #f66;
        }
        .btn-success {
          background: #0a0;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-success:hover {
          background: #0c0;
        }
        .btn-success:disabled {
          background: #555;
          cursor: not-allowed;
        }
        .btn-danger {
          background: #a00;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-danger:hover {
          background: #c00;
        }
        .btn-danger:disabled {
          background: #555;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
