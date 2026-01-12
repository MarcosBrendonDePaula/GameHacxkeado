import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

interface BotStats {
  id: string
  name: string
  status: 'online' | 'offline'
  wallet: string
  catches: number
  misses: number
  totalFish: number
  delay: number
  uptime: string
  startedAt?: Date
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
  bot: BotStats
  playerState: PlayerState | null
}

export default function BotInfo() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<BotDetailedInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBotInfo()
    const interval = setInterval(fetchBotInfo, 3000)
    return () => clearInterval(interval)
  }, [id])

  async function fetchBotInfo() {
    try {
      const res = await fetch(`/api/bots/${id}/detailed`)
      if (!res.ok) {
        throw new Error('Bot não encontrado')
      }
      const info = await res.json()
      setData(info)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Carregando informações do bot...</div>
  }

  if (error || !data) {
    return (
      <div className="error">
        <h2>❌ Erro</h2>
        <p>{error || 'Bot não encontrado'}</p>
        <button onClick={() => navigate('/bots')} style={{ marginTop: '20px' }}>
          ← Voltar para Bots
        </button>
      </div>
    )
  }

  const { bot, playerState } = data
  const totalCasts = bot.catches + bot.misses
  const successRate = totalCasts > 0 ? ((bot.catches / totalCasts) * 100).toFixed(1) : '0.0'
  const avgFishPerCatch = bot.catches > 0 ? (bot.totalFish / bot.catches).toFixed(2) : '0.00'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <button
          onClick={() => navigate('/bots')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #30363d',
            backgroundColor: '#21262d',
            color: '#c9d1d9',
            cursor: 'pointer',
          }}
        >
          ← Voltar
        </button>
        <h2 style={{ margin: 0 }}>
          🤖 {bot.name}
        </h2>
        <span
          className={`status-badge ${bot.status}`}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.85rem',
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
            <StatRow label="Wallet" value={`${bot.wallet.slice(0, 8)}...${bot.wallet.slice(-6)}`} />
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
        }}>
          ⚠️ Não foi possível carregar informações do jogador
        </div>
      )}

      {/* Gráfico de Histórico */}
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '20px',
      }}>
        <h3 style={{ marginBottom: '20px', color: '#58a6ff' }}>📈 Progresso de Fish Pescado</h3>
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

  // Cria um gráfico de pizza usando SVG
  const catchAngle = (catchPercent / 100) * 360
  const radius = 80
  const centerX = 100
  const centerY = 100

  // Calcula o path para o slice de catches
  const catchPath = describeArc(centerX, centerY, radius, 0, catchAngle)
  const missPath = describeArc(centerX, centerY, radius, catchAngle, 360)

  return (
    <div style={{ position: 'relative' }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        {/* Catch slice */}
        <path
          d={`M ${centerX} ${centerY} ${catchPath} Z`}
          fill="#3fb950"
          stroke="#0d1117"
          strokeWidth="2"
        />
        {/* Miss slice */}
        <path
          d={`M ${centerX} ${centerY} ${missPath} Z`}
          fill="#f85149"
          stroke="#0d1117"
          strokeWidth="2"
        />
        {/* Centro branco */}
        <circle cx={centerX} cy={centerY} r="50" fill="#161b22" />
        {/* Texto central */}
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
          <span style={{ fontSize: '0.9rem', color: '#8b949e' }}>Média/Catch</span>
        </div>
      </div>
    </div>
  )
}
