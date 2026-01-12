import { useEffect, useState } from 'react'

interface Stats {
  totalBots: number
  activeBots: number
  totalCatches: number
  totalMisses: number
  totalFish: number
  successRate: string
  totalPendingCasts: number
}

interface Bot {
  id: string
  name: string
  status: 'online' | 'offline'
  wallet: string
  catches: number
  misses: number
  totalFish: number
  delay: number
  uptime: string
  pendingCasts?: number
}

interface PlayerState {
  owner: string
  rodLevel: number
  boatTier: number
  castCount: string
  fishCaughtAllTime: string
  power: string
  maxDurability: number
  currentDurability: number
  supercastRemainingCasts: number
  lastDurabilityTs: string
  unprocessedFish: string
}

interface BotDetailedInfo {
  bot: Bot
  playerState: PlayerState | null
}

interface HistoryPoint {
  timestamp: string
  catches: number
  misses: number
  totalFish: number
  durability?: number
}

type SelectedView = 'overview' | string // 'overview' ou bot id

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [bots, setBots] = useState<Bot[]>([])
  const [selectedView, setSelectedView] = useState<SelectedView>('overview')
  const [botDetails, setBotDetails] = useState<BotDetailedInfo | null>(null)
  const [botHistory, setBotHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedView !== 'overview') {
      // Primeira busca com loading
      fetchBotDetails(selectedView, true)
      fetchBotHistory(selectedView)

      // Atualiza detalhes do bot a cada 2 segundos (sem loading para não piscar)
      const detailsInterval = setInterval(() => fetchBotDetails(selectedView, false), 2000)

      // Atualiza histórico a cada 5 segundos
      const historyInterval = setInterval(() => fetchBotHistory(selectedView), 5000)

      return () => {
        clearInterval(detailsInterval)
        clearInterval(historyInterval)
      }
    }
  }, [selectedView])

  async function fetchData() {
    try {
      const [statsRes, botsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/bots')
      ])
      const statsData = await statsRes.json()
      const botsData = await botsRes.json()

      setStats(statsData)
      setBots(botsData.bots)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchBotDetails(botId: string, showLoading: boolean = true) {
    if (showLoading) {
      setDetailsLoading(true)
    }
    try {
      const res = await fetch(`/api/bots/${botId}/detailed`)
      const data = await res.json()
      setBotDetails(data)
    } catch (error) {
      console.error('Erro ao buscar detalhes do bot:', error)
    } finally {
      if (showLoading) {
        setDetailsLoading(false)
      }
    }
  }

  async function fetchBotHistory(botId: string) {
    try {
      const res = await fetch(`/api/bots/${botId}/history`)
      const data = await res.json()
      setBotHistory(data.history)
    } catch (error) {
      console.error('Erro ao buscar histórico do bot:', error)
    }
  }

  async function handleStartBot(id: string) {
    try {
      const res = await fetch(`/api/bots/${id}/start`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        // Atualiza lista de bots
        await fetchData()
      }
    } catch (error) {
      console.error('Erro ao iniciar bot:', error)
    }
  }

  async function handleStopBot(id: string) {
    try {
      const res = await fetch(`/api/bots/${id}/stop`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        // Atualiza lista de bots
        await fetchData()
      }
    } catch (error) {
      console.error('Erro ao parar bot:', error)
    }
  }

  async function handleStartAll() {
    try {
      const res = await fetch('/api/bots/start-all', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        // Atualiza lista de bots
        await fetchData()
      }
    } catch (error) {
      console.error('Erro ao iniciar todos os bots:', error)
    }
  }

  async function handleStopAll() {
    try {
      const res = await fetch('/api/bots/stop-all', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        // Atualiza lista de bots
        await fetchData()
      }
    } catch (error) {
      console.error('Erro ao parar todos os bots:', error)
    }
  }

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  if (!stats) {
    return <div className="error">Erro ao carregar estatísticas</div>
  }

  return (
    <div>
      <h2>📊 Dashboard</h2>

      {/* Tabs para alternar visualização */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '20px',
        marginBottom: '20px',
        overflowX: 'auto',
        paddingBottom: '10px',
        borderBottom: '2px solid #30363d',
      }}>
        <button
          onClick={() => setSelectedView('overview')}
          style={{
            padding: '10px 20px',
            borderRadius: '6px 6px 0 0',
            border: 'none',
            backgroundColor: selectedView === 'overview' ? '#21262d' : 'transparent',
            color: selectedView === 'overview' ? '#58a6ff' : '#8b949e',
            cursor: 'pointer',
            fontWeight: selectedView === 'overview' ? 'bold' : 'normal',
            borderBottom: selectedView === 'overview' ? '3px solid #58a6ff' : 'none',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}
        >
          📊 Visão Geral
        </button>

        {bots.map(bot => (
          <button
            key={bot.id}
            onClick={() => setSelectedView(bot.id)}
            style={{
              padding: '10px 20px',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              backgroundColor: selectedView === bot.id ? '#21262d' : 'transparent',
              color: selectedView === bot.id ? '#58a6ff' : '#8b949e',
              cursor: 'pointer',
              fontWeight: selectedView === bot.id ? 'bold' : 'normal',
              borderBottom: selectedView === bot.id ? '3px solid #58a6ff' : 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: bot.status === 'online' ? '#3fb950' : '#f85149',
            }} />
            {bot.name}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {selectedView === 'overview' ? (
        <OverviewContent
          stats={stats}
          bots={bots}
          onStartBot={handleStartBot}
          onStopBot={handleStopBot}
          onStartAll={handleStartAll}
          onStopAll={handleStopAll}
        />
      ) : (
        <BotDetailsContent
          botDetails={botDetails}
          botHistory={botHistory}
          loading={detailsLoading}
        />
      )}
    </div>
  )
}

function OverviewContent({ stats, bots, onStartBot, onStopBot, onStartAll, onStopAll }: {
  stats: Stats
  bots: Bot[]
  onStartBot: (id: string) => void
  onStopBot: (id: string) => void
  onStartAll: () => void
  onStopAll: () => void
}) {
  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: '30px' }}>
        <div className="stat-card">
          <div className="stat-icon">🤖</div>
          <div className="stat-info">
            <h3>Total de Bots</h3>
            <p className="stat-value">{stats.totalBots}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>Bots Ativos</h3>
            <p className="stat-value">{stats.activeBots}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🐟</div>
          <div className="stat-info">
            <h3>Total Catches</h3>
            <p className="stat-value">{stats.totalCatches}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <h3>Total Fish</h3>
            <p className="stat-value">{stats.totalFish.toFixed(2)}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <h3>Taxa de Sucesso</h3>
            <p className="stat-value">{stats.successRate}%</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔴</div>
          <div className="stat-info">
            <h3>Total Misses</h3>
            <p className="stat-value">{stats.totalMisses}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <h3>Casts Pendentes</h3>
            <p className="stat-value">{stats.totalPendingCasts || 0}</p>
          </div>
        </div>
      </div>

      {/* Controle de Bots */}
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '20px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <h3 style={{ margin: 0, color: '#58a6ff' }}>🎮 Controle dos Bots</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onStartAll}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#3fb950',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              ▶️ Ligar Todos
            </button>
            <button
              onClick={onStopAll}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#f85149',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              ⏸️ Desligar Todos
            </button>
          </div>
        </div>

        {/* Lista de Bots */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '15px',
        }}>
          {bots.map(bot => (
            <div
              key={bot.id}
              style={{
                backgroundColor: '#0d1117',
                border: `2px solid ${bot.status === 'online' ? '#3fb950' : '#30363d'}`,
                borderRadius: '8px',
                padding: '15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* Header do Bot */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: bot.status === 'online' ? '#3fb950' : '#f85149',
                    boxShadow: bot.status === 'online' ? '0 0 8px #3fb950' : 'none',
                  }} />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{bot.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>
                      {bot.wallet.slice(0, 6)}...{bot.wallet.slice(-4)}
                    </div>
                  </div>
                </div>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  backgroundColor: bot.status === 'online' ? 'rgba(63, 185, 80, 0.2)' : 'rgba(248, 81, 73, 0.2)',
                  color: bot.status === 'online' ? '#3fb950' : '#f85149',
                  textTransform: 'uppercase',
                }}>
                  {bot.status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Stats Resumidos */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '0.85rem',
              }}>
                <div>
                  <span style={{ color: '#8b949e' }}>Catches: </span>
                  <span style={{ color: '#3fb950', fontWeight: 'bold' }}>{bot.catches}</span>
                </div>
                <div>
                  <span style={{ color: '#8b949e' }}>Misses: </span>
                  <span style={{ color: '#f85149', fontWeight: 'bold' }}>{bot.misses}</span>
                </div>
                <div>
                  <span style={{ color: '#8b949e' }}>Fish: </span>
                  <span style={{ color: '#d29922', fontWeight: 'bold' }}>{bot.totalFish.toFixed(1)}</span>
                </div>
                <div>
                  <span style={{ color: '#8b949e' }}>Uptime: </span>
                  <span style={{ color: '#bc8cff', fontWeight: 'bold' }}>{bot.uptime}</span>
                </div>
                {bot.status === 'online' && bot.pendingCasts !== undefined && (
                  <div>
                    <span style={{ color: '#8b949e' }}>Fila: </span>
                    <span style={{ color: '#58a6ff', fontWeight: 'bold' }}>⏳ {bot.pendingCasts}</span>
                  </div>
                )}
              </div>

              {/* Botão de Controle */}
              <button
                onClick={() => bot.status === 'online' ? onStopBot(bot.id) : onStartBot(bot.id)}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: bot.status === 'online' ? '#f85149' : '#3fb950',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)'
                }}
              >
                {bot.status === 'online' ? '⏸️ Desligar' : '▶️ Ligar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BotDetailsContent({ botDetails, botHistory, loading }: {
  botDetails: BotDetailedInfo | null
  botHistory: HistoryPoint[]
  loading: boolean
}) {
  const [timeRange, setTimeRange] = useState<string>('1h') // Padrão: última 1 hora

  if (loading) {
    return <div className="loading">Carregando detalhes do bot...</div>
  }

  if (!botDetails) {
    return <div className="error">Erro ao carregar detalhes do bot</div>
  }

  // Filtra histórico baseado no período de tempo selecionado
  const getFilteredHistory = () => {
    if (timeRange === 'all') return botHistory

    const now = Date.now()
    let maxAge: number

    switch (timeRange) {
      case '10m':
        maxAge = 10 * 60 * 1000 // 10 minutos
        break
      case '30m':
        maxAge = 30 * 60 * 1000 // 30 minutos
        break
      case '1h':
        maxAge = 60 * 60 * 1000 // 1 hora
        break
      case '6h':
        maxAge = 6 * 60 * 60 * 1000 // 6 horas
        break
      case '1d':
        maxAge = 24 * 60 * 60 * 1000 // 1 dia
        break
      default:
        maxAge = 60 * 60 * 1000 // 1 hora (padrão)
    }

    return botHistory.filter(point => {
      const pointTime = new Date(point.timestamp).getTime()
      return now - pointTime <= maxAge
    })
  }

  const filteredHistory = getFilteredHistory()

  const { bot, playerState } = botDetails
  const totalCasts = bot.catches + bot.misses
  const successRate = totalCasts > 0 ? ((bot.catches / totalCasts) * 100).toFixed(1) : '0.0'
  const avgFishPerCatch = bot.catches > 0 ? (bot.totalFish / bot.catches).toFixed(2) : '0.00'

  return (
    <div>
      {/* Header do Bot */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, marginBottom: '5px' }}>🤖 {bot.name}</h3>
          <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>
            💼 {bot.wallet.slice(0, 8)}...{bot.wallet.slice(-6)}
          </div>
        </div>
        <span
          className={`status-badge ${bot.status}`}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          {bot.status === 'online' ? '🟢 Online' : '🔴 Offline'}
        </span>
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
          <h3 style={{ marginBottom: '20px', color: '#58a6ff' }}>📊 Estatísticas Gerais</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <StatRow label="Total de Casts" value={totalCasts.toLocaleString()} />
            <StatRow label="Catches" value={bot.catches.toLocaleString()} color="#3fb950" />
            <StatRow label="Misses" value={bot.misses.toLocaleString()} color="#f85149" />
            <StatRow label="Taxa de Sucesso" value={`${successRate}%`} color="#58a6ff" />
            <StatRow label="Total Fish Pescado" value={bot.totalFish.toFixed(2)} color="#d29922" />
            <StatRow label="Média por Catch" value={`${avgFishPerCatch} fish`} color="#8b949e" />
            <StatRow label="Delay entre Casts" value={`${bot.delay}ms`} />
            <StatRow label="Uptime" value={bot.uptime} color="#bc8cff" />
            {bot.status === 'online' && bot.pendingCasts !== undefined && (
              <StatRow label="Casts na Fila" value={`⏳ ${bot.pendingCasts}`} color="#58a6ff" />
            )}
          </div>
        </div>

        {/* Gráfico de Pizza - Taxa de Sucesso */}
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '20px',
        }}>
          <h3 style={{ marginBottom: '20px', color: '#58a6ff' }}>🎯 Taxa de Acerto</h3>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            {totalCasts > 0 ? (
              <PieChart catches={bot.catches} misses={bot.misses} />
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
                Catches ({bot.catches})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: '#f85149', borderRadius: '4px' }} />
              <span style={{ fontSize: '0.9rem', color: '#8b949e' }}>
                Misses ({bot.misses})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dados do Pescador */}
      {playerState ? (
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
        }}>
          <h3 style={{ marginBottom: '20px', color: '#58a6ff' }}>🎣 Informações do Pescador</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            {/* Equipamento */}
            <div>
              <h4 style={{ fontSize: '0.95rem', color: '#8b949e', marginBottom: '12px' }}>🎣 Equipamento</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <StatRow label="Rod Level" value={playerState.rodLevel.toString()} color="#d29922" />
                <StatRow label="Boat Tier" value={playerState.boatTier.toString()} color="#bc8cff" />
                <StatRow label="Power" value={playerState.power} color="#58a6ff" />
              </div>
            </div>

            {/* Durabilidade */}
            <div>
              <h4 style={{ fontSize: '0.95rem', color: '#8b949e', marginBottom: '12px' }}>🔧 Durabilidade</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <StatRow
                  label="Durabilidade Atual"
                  value={`${playerState.currentDurability}/${playerState.maxDurability}`}
                  color={playerState.currentDurability > playerState.maxDurability * 0.5 ? '#3fb950' : '#f85149'}
                />
                <div style={{ marginTop: '8px' }}>
                  <DurabilityBar
                    current={playerState.currentDurability}
                    max={playerState.maxDurability}
                  />
                </div>
                <StatRow
                  label="Supercasts Restantes"
                  value={playerState.supercastRemainingCasts.toString()}
                />
              </div>
            </div>

            {/* Estatísticas de Pesca */}
            <div>
              <h4 style={{ fontSize: '0.95rem', color: '#8b949e', marginBottom: '12px' }}>📈 Estatísticas</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <StatRow
                  label="Total de Casts (Chain)"
                  value={parseInt(playerState.castCount).toLocaleString()}
                />
                <StatRow
                  label="Fish Total (Chain)"
                  value={(parseInt(playerState.fishCaughtAllTime) / 1_000_000).toFixed(2)}
                  color="#d29922"
                />
                <StatRow
                  label="Fish Não Processado"
                  value={(parseInt(playerState.unprocessedFish) / 1_000_000).toFixed(2)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          color: '#8b949e',
          marginBottom: '20px',
        }}>
          ⚠️ Não foi possível carregar informações do jogador
        </div>
      )}

      {/* Gráfico Temporal */}
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
      }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#58a6ff' }}>⏱️ Evolução Temporal</h3>
            {botHistory.length > 1 && (
              <span style={{
                fontSize: '0.85rem',
                color: '#8b949e',
                backgroundColor: '#0d1117',
                padding: '4px 12px',
                borderRadius: '12px',
                border: '1px solid #30363d',
              }}>
                🔮 Com previsão baseada em spline cúbica (Catmull-Rom)
              </span>
            )}
          </div>

          {/* Controles de Período de Tempo */}
          {botHistory.length > 5 && (
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              marginBottom: '15px',
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '0.85rem', color: '#8b949e' }}>Período:</span>
              {[
                { value: '10m', label: '10 min' },
                { value: '30m', label: '30 min' },
                { value: '1h', label: '1 hora' },
                { value: '6h', label: '6 horas' },
                { value: '1d', label: '1 dia' },
                { value: 'all', label: 'Tudo' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTimeRange(value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: timeRange === value ? '2px solid #58a6ff' : '1px solid #30363d',
                    backgroundColor: timeRange === value ? 'rgba(88, 166, 255, 0.1)' : '#0d1117',
                    color: timeRange === value ? '#58a6ff' : '#8b949e',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: timeRange === value ? 'bold' : 'normal',
                    transition: 'all 0.2s',
                  }}
                >
                  {label}
                </button>
              ))}
              <span style={{ fontSize: '0.75rem', color: '#6e7681', marginLeft: '8px' }}>
                ({filteredHistory.length} pontos)
              </span>
            </div>
          )}
        </div>

        {filteredHistory.length > 1 ? (
          <TimelineChart history={filteredHistory} />
        ) : (
          <div style={{ textAlign: 'center', color: '#8b949e', padding: '40px' }}>
            Aguardando mais dados... (mínimo 2 pontos)
          </div>
        )}
      </div>

      {/* Gráfico de Histórico */}
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '20px',
      }}>
        <h3 style={{ marginBottom: '20px', color: '#58a6ff' }}>📈 Resumo Geral</h3>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <ProgressChart totalFish={bot.totalFish} catches={bot.catches} />
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
  const missPercent = (misses / total) * 100

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

function DurabilityBar({ current, max }: { current: number; max: number }) {
  const percent = (current / max) * 100
  const color = percent > 50 ? '#3fb950' : percent > 25 ? '#d29922' : '#f85149'

  return (
    <div style={{
      width: '100%',
      height: '24px',
      backgroundColor: '#0d1117',
      borderRadius: '6px',
      overflow: 'hidden',
      position: 'relative',
      border: '1px solid #30363d',
    }}>
      <div
        style={{
          width: `${percent}%`,
          height: '100%',
          backgroundColor: color,
          transition: 'width 0.3s ease',
        }}
      />
      <span style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        color: '#c9d1d9',
        textShadow: '0 0 4px rgba(0,0,0,0.8)',
      }}>
        {percent.toFixed(1)}%
      </span>
    </div>
  )
}

function ProgressChart({ totalFish, catches }: { totalFish: number; catches: number }) {
  return (
    <div style={{ width: '100%', maxWidth: '800px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', height: '200px', padding: '20px' }}>
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
          <span style={{ fontSize: '0.9rem', color: '#8b949e' }}>Média/Catch</span>
        </div>
      </div>
    </div>
  )
}

function TimelineChart({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) return null

  const width = 900
  const height = 300
  const padding = { top: 20, right: 40, bottom: 50, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Função para calcular spline cúbica de Catmull-Rom
  const catmullRomSpline = (p0: number, p1: number, p2: number, p3: number, t: number) => {
    const t2 = t * t
    const t3 = t2 * t

    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    )
  }

  // Calcula velocidade (derivada) no último ponto usando spline
  const calculateVelocity = (values: number[]) => {
    const n = values.length
    if (n < 3) {
      // Fallback para diferença simples se não tiver pontos suficientes
      return values[n - 1] - values[n - 2]
    }

    // Usa os últimos 4 pontos para calcular a derivada da spline
    const p0 = values[n - 4] || values[0]
    const p1 = values[n - 3] || values[0]
    const p2 = values[n - 2]
    const p3 = values[n - 1]

    // Derivada da spline de Catmull-Rom em t=1
    const velocity = 0.5 * (-p1 + p3)
    return velocity
  }

  // Calcula aceleração (segunda derivada) para extrapolação mais precisa
  const calculateAcceleration = (values: number[]) => {
    const n = values.length
    if (n < 4) return 0

    const p0 = values[n - 4]
    const p1 = values[n - 3]
    const p2 = values[n - 2]
    const p3 = values[n - 1]

    // Segunda derivada aproximada
    return 0.5 * (p0 - 2 * p1 + p2)
  }

  // Calcula previsões usando spline cúbica
  const predictionPoints = 5
  const pointsForPrediction = Math.min(15, history.length)
  const recentHistory = history.slice(-pointsForPrediction)

  // Previsão para fish usando spline
  const fishValues = recentHistory.map(h => h.totalFish)
  const fishVelocity = calculateVelocity(fishValues)
  const fishAcceleration = calculateAcceleration(fishValues)
  const fishPredictions = []

  for (let i = 1; i <= predictionPoints; i++) {
    const lastValue = fishValues[fishValues.length - 1]
    // Extrapolação quadrática: y = y0 + v*t + 0.5*a*t²
    const predictedValue = lastValue + fishVelocity * i + 0.5 * fishAcceleration * i * i
    fishPredictions.push(Math.max(0, predictedValue))
  }

  // Previsão para catches usando spline
  const catchValues = recentHistory.map(h => h.catches)
  const catchVelocity = calculateVelocity(catchValues)
  const catchAcceleration = calculateAcceleration(catchValues)
  const catchPredictions = []

  for (let i = 1; i <= predictionPoints; i++) {
    const lastValue = catchValues[catchValues.length - 1]
    const predictedValue = lastValue + catchVelocity * i + 0.5 * catchAcceleration * i * i
    catchPredictions.push(Math.max(0, predictedValue))
  }

  // Previsão para durabilidade (se disponível)
  const durabilityValues = recentHistory.map(h => h.durability).filter((d): d is number => d !== undefined)
  const hasDurability = durabilityValues.length > 0
  let durabilityPredictions: number[] = []

  if (hasDurability && durabilityValues.length >= 3) {
    const durabilityVelocity = calculateVelocity(durabilityValues)
    const durabilityAcceleration = calculateAcceleration(durabilityValues)

    for (let i = 1; i <= predictionPoints; i++) {
      const lastValue = durabilityValues[durabilityValues.length - 1]
      const predictedValue = lastValue + durabilityVelocity * i + 0.5 * durabilityAcceleration * i * i
      // Limita entre 0 e 100
      durabilityPredictions.push(Math.max(0, Math.min(100, predictedValue)))
    }
  }

  // Encontra valores min/max (incluindo previsões)
  const allFishValues = [...history.map(h => h.totalFish), ...fishPredictions]
  const allCatchValues = [...history.map(h => h.catches), ...catchPredictions]
  const maxFish = Math.max(...allFishValues, 1)
  const maxCatches = Math.max(...allCatchValues, 1)

  // Escala Y para fish (à esquerda)
  const scaleYFish = (value: number) => {
    return chartHeight - (value / maxFish) * chartHeight
  }

  // Escala Y para catches (à direita)
  const scaleYCatches = (value: number) => {
    return chartHeight - (value / maxCatches) * chartHeight
  }

  // Escala Y para durabilidade (0-100%, eixo direito)
  const scaleYDurability = (value: number) => {
    return chartHeight - (value / 100) * chartHeight
  }

  // Escala X (agora incluindo pontos de previsão)
  const totalPoints = history.length + predictionPoints
  const scaleX = (index: number) => {
    return (index / (totalPoints - 1)) * chartWidth
  }

  // Cria curva suave para linha de fish (histórico) usando Catmull-Rom
  const createSmoothPath = (
    values: number[],
    scaleY: (v: number) => number,
    isStartPath: boolean = false
  ) => {
    if (values.length < 2) return ''

    const segments: string[] = []

    // Primeiro ponto
    const x0 = scaleX(0)
    const y0 = scaleY(values[0])
    segments.push(`M ${x0} ${y0}`)

    if (values.length === 2) {
      // Se só tem 2 pontos, usa linha reta
      const x1 = scaleX(1)
      const y1 = scaleY(values[1])
      segments.push(`L ${x1} ${y1}`)
      return segments.join(' ')
    }

    // Usa spline de Catmull-Rom para criar curvas suaves
    for (let i = 0; i < values.length - 1; i++) {
      const p0 = values[Math.max(0, i - 1)]
      const p1 = values[i]
      const p2 = values[i + 1]
      const p3 = values[Math.min(values.length - 1, i + 2)]

      // Gera pontos intermediários da curva
      const steps = 10
      for (let t = 0; t <= steps; t++) {
        const tNorm = t / steps
        const value = catmullRomSpline(p0, p1, p2, p3, tNorm)
        const x = scaleX(i + tNorm)
        const y = scaleY(value)

        if (t === 0 && i === 0) continue // Pula o primeiro ponto (já foi adicionado com M)
        segments.push(`L ${x} ${y}`)
      }
    }

    return segments.join(' ')
  }

  const fishPath = createSmoothPath(
    history.map(h => h.totalFish),
    scaleYFish,
    true
  )

  const catchesPath = createSmoothPath(
    history.map(h => h.catches),
    scaleYCatches,
    true
  )

  // Cria path suave para previsão de fish
  const createPredictionPath = (
    lastHistoricValue: number,
    predictions: number[],
    scaleY: (v: number) => number
  ) => {
    const allValues = [lastHistoricValue, ...predictions]
    const segments: string[] = []

    // Começa do último ponto histórico
    const x0 = scaleX(history.length - 1)
    const y0 = scaleY(lastHistoricValue)
    segments.push(`M ${x0} ${y0}`)

    if (predictions.length === 1) {
      const x1 = scaleX(history.length)
      const y1 = scaleY(predictions[0])
      segments.push(`L ${x1} ${y1}`)
      return segments.join(' ')
    }

    // Usa spline para criar curva suave na previsão
    for (let i = 0; i < predictions.length; i++) {
      const p0 = allValues[Math.max(0, i - 1)]
      const p1 = allValues[i]
      const p2 = allValues[i + 1]
      const p3 = allValues[Math.min(allValues.length - 1, i + 2)]

      const steps = 10
      for (let t = 0; t <= steps; t++) {
        const tNorm = t / steps
        const value = catmullRomSpline(p0, p1, p2, p3, tNorm)
        const x = scaleX(history.length - 1 + i + tNorm)
        const y = scaleY(value)

        if (t === 0 && i === 0) continue
        segments.push(`L ${x} ${y}`)
      }
    }

    return segments.join(' ')
  }

  const fishPredictionPath = createPredictionPath(
    history[history.length - 1].totalFish,
    fishPredictions,
    scaleYFish
  )

  const catchPredictionPath = createPredictionPath(
    history[history.length - 1].catches,
    catchPredictions,
    scaleYCatches
  )

  // Paths de durabilidade (se disponível)
  const durabilityPath = hasDurability ? createSmoothPath(
    history.map(h => h.durability || 0).filter((_, i) => history[i].durability !== undefined),
    scaleYDurability,
    true
  ) : ''

  const durabilityPredictionPath = hasDurability && durabilityPredictions.length > 0 ? createPredictionPath(
    durabilityValues[durabilityValues.length - 1],
    durabilityPredictions,
    scaleYDurability
  ) : ''

  // Formata timestamp para exibição
  const formatTime = (timestamp: string | Date) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  // Calcula intervalo médio entre pontos históricos (em ms)
  let avgInterval = 5000 // Padrão: 5 segundos
  if (history.length > 1) {
    const firstTime = new Date(history[0].timestamp).getTime()
    const lastTime = new Date(history[history.length - 1].timestamp).getTime()
    avgInterval = (lastTime - firstTime) / (history.length - 1)
  }

  // Calcula timestamps futuros para previsões
  const lastHistoryTime = new Date(history[history.length - 1].timestamp)
  const predictionTimestamps: Date[] = []
  for (let i = 1; i <= predictionPoints; i++) {
    predictionTimestamps.push(new Date(lastHistoryTime.getTime() + avgInterval * i))
  }

  // Labels do eixo X (mostra histórico + previsões)
  const xLabels = []
  const totalPointsForLabels = history.length + predictionPoints
  const labelCount = Math.min(8, totalPointsForLabels)

  for (let i = 0; i < labelCount; i++) {
    const index = Math.floor((i / (labelCount - 1)) * (totalPointsForLabels - 1))
    let label: string
    let isPrediction = false

    if (index < history.length) {
      // Ponto histórico
      label = formatTime(history[index].timestamp)
    } else {
      // Ponto de previsão
      const predIndex = index - history.length
      label = formatTime(predictionTimestamps[predIndex])
      isPrediction = true
    }

    xLabels.push({
      index,
      x: scaleX(index),
      label,
      isPrediction,
    })
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px', overflowX: 'auto' }}>
      <svg width={width} height={height} style={{ minWidth: '900px' }}>
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Grid horizontal */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <line
              key={ratio}
              x1={0}
              y1={chartHeight * ratio}
              x2={chartWidth}
              y2={chartHeight * ratio}
              stroke="#30363d"
              strokeWidth="1"
              strokeDasharray="4"
            />
          ))}

          {/* Eixo X */}
          <line
            x1={0}
            y1={chartHeight}
            x2={chartWidth}
            y2={chartHeight}
            stroke="#8b949e"
            strokeWidth="2"
          />

          {/* Eixo Y esquerdo */}
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={chartHeight}
            stroke="#8b949e"
            strokeWidth="2"
          />

          {/* Eixo Y direito */}
          <line
            x1={chartWidth}
            y1={0}
            x2={chartWidth}
            y2={chartHeight}
            stroke="#8b949e"
            strokeWidth="2"
          />

          {/* Área sombreada de previsão */}
          <rect
            x={scaleX(history.length - 1)}
            y={0}
            width={chartWidth - scaleX(history.length - 1)}
            height={chartHeight}
            fill="#58a6ff"
            opacity="0.05"
          />

          {/* Linha vertical separando histórico de previsão */}
          <line
            x1={scaleX(history.length - 1)}
            y1={0}
            x2={scaleX(history.length - 1)}
            y2={chartHeight}
            stroke="#58a6ff"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.3"
          />

          {/* Labels X */}
          {xLabels.map(({ index, x, label, isPrediction }) => (
            <g key={index}>
              <line
                x1={x}
                y1={chartHeight}
                x2={x}
                y2={chartHeight + 5}
                stroke={isPrediction ? "#58a6ff" : "#8b949e"}
                strokeWidth="2"
                strokeDasharray={isPrediction ? "2 2" : "0"}
              />
              <text
                x={x}
                y={chartHeight + 20}
                textAnchor="middle"
                fill={isPrediction ? "#58a6ff" : "#8b949e"}
                fontSize="11"
                fontStyle={isPrediction ? "italic" : "normal"}
              >
                {label}
              </text>
            </g>
          ))}

          {/* Labels Y esquerdo (Fish) */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const value = maxFish * (1 - ratio)
            return (
              <text
                key={ratio}
                x={-10}
                y={chartHeight * ratio + 4}
                textAnchor="end"
                fill="#d29922"
                fontSize="11"
                fontWeight="bold"
              >
                {value.toFixed(1)}
              </text>
            )
          })}

          {/* Labels Y direito (Catches) */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const value = Math.round(maxCatches * (1 - ratio))
            return (
              <text
                key={ratio}
                x={chartWidth + 10}
                y={chartHeight * ratio + 4}
                textAnchor="start"
                fill="#3fb950"
                fontSize="11"
                fontWeight="bold"
              >
                {value}
              </text>
            )
          })}

          {/* Linha de Fish */}
          <path
            d={fishPath}
            fill="none"
            stroke="#d29922"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Linha de previsão de Fish (tracejada) */}
          <path
            d={fishPredictionPath}
            fill="none"
            stroke="#d29922"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeDasharray="8 4"
            opacity="0.7"
          />

          {/* Pontos de Fish */}
          {history.map((point, i) => (
            <circle
              key={`fish-${i}`}
              cx={scaleX(i)}
              cy={scaleYFish(point.totalFish)}
              r="4"
              fill="#d29922"
              stroke="#0d1117"
              strokeWidth="2"
            />
          ))}

          {/* Pontos de previsão de Fish */}
          {fishPredictions.map((value, i) => (
            <circle
              key={`fish-pred-${i}`}
              cx={scaleX(history.length + i)}
              cy={scaleYFish(value)}
              r="3"
              fill="none"
              stroke="#d29922"
              strokeWidth="2"
              strokeDasharray="2 2"
              opacity="0.7"
            />
          ))}

          {/* Linha de Catches */}
          <path
            d={catchesPath}
            fill="none"
            stroke="#3fb950"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Linha de previsão de Catches (tracejada) */}
          <path
            d={catchPredictionPath}
            fill="none"
            stroke="#3fb950"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeDasharray="8 4"
            opacity="0.7"
          />

          {/* Pontos de Catches */}
          {history.map((point, i) => (
            <circle
              key={`catch-${i}`}
              cx={scaleX(i)}
              cy={scaleYCatches(point.catches)}
              r="4"
              fill="#3fb950"
              stroke="#0d1117"
              strokeWidth="2"
            />
          ))}

          {/* Pontos de previsão de Catches */}
          {catchPredictions.map((value, i) => (
            <circle
              key={`catch-pred-${i}`}
              cx={scaleX(history.length + i)}
              cy={scaleYCatches(value)}
              r="3"
              fill="none"
              stroke="#3fb950"
              strokeWidth="2"
              strokeDasharray="2 2"
              opacity="0.7"
            />
          ))}

          {/* Linha de Durabilidade */}
          {hasDurability && durabilityPath && (
            <path
              d={durabilityPath}
              fill="none"
              stroke="#a371f7"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          )}

          {/* Linha de previsão de Durabilidade (tracejada) */}
          {hasDurability && durabilityPredictionPath && (
            <path
              d={durabilityPredictionPath}
              fill="none"
              stroke="#a371f7"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeDasharray="8 4"
              opacity="0.7"
            />
          )}

          {/* Pontos de Durabilidade */}
          {hasDurability && history.map((point, i) => {
            if (point.durability === undefined) return null
            return (
              <circle
                key={`durability-${i}`}
                cx={scaleX(i)}
                cy={scaleYDurability(point.durability)}
                r="4"
                fill="#a371f7"
                stroke="#0d1117"
                strokeWidth="2"
              />
            )
          })}

          {/* Pontos de previsão de Durabilidade */}
          {hasDurability && durabilityPredictions.map((value, i) => (
            <circle
              key={`durability-pred-${i}`}
              cx={scaleX(history.length + i)}
              cy={scaleYDurability(value)}
              r="3"
              fill="none"
              stroke="#a371f7"
              strokeWidth="2"
              strokeDasharray="2 2"
              opacity="0.7"
            />
          ))}
        </g>

        {/* Legenda */}
        <g transform={`translate(${width / 2 - 200}, ${height - 15})`}>
          {/* Linha sólida */}
          <line x1={0} y1={0} x2={20} y2={0} stroke="#8b949e" strokeWidth="2" />
          <text x={25} y={4} fill="#8b949e" fontSize="11">
            Histórico
          </text>

          {/* Linha tracejada */}
          <line x1={90} y1={0} x2={110} y2={0} stroke="#8b949e" strokeWidth="2" strokeDasharray="8 4" />
          <text x={115} y={4} fill="#8b949e" fontSize="11">
            Previsão
          </text>

          {/* Fish */}
          <circle cx={200} cy={0} r="5" fill="#d29922" />
          <text x={210} y={4} fill="#d29922" fontSize="11" fontWeight="bold">
            Fish
          </text>

          {/* Catches */}
          <circle cx={260} cy={0} r="5" fill="#3fb950" />
          <text x={270} y={4} fill="#3fb950" fontSize="11" fontWeight="bold">
            Catches
          </text>

          {/* Durabilidade */}
          {hasDurability && (
            <>
              <circle cx={350} cy={0} r="5" fill="#a371f7" />
              <text x={360} y={4} fill="#a371f7" fontSize="11" fontWeight="bold">
                Durabilidade %
              </text>
            </>
          )}
        </g>
      </svg>
    </div>
  )
}
