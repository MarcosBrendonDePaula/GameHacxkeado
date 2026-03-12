import { useNavigate } from 'react-router-dom'

interface Bot {
  id: string | number
  name: string
  status: 'online' | 'offline'
  wallet: string
  catches: number
  misses: number
  totalFish: number
  delay: number
  uptime: string
}

interface BotCardProps {
  bot: Bot
  onStart: () => void
  onStop: () => void
}

export default function BotCard({ bot, onStart, onStop }: BotCardProps) {
  const navigate = useNavigate()

  return (
    <div className={`bot-card ${bot.status}`}>
      <div className="bot-header">
        <h3>{bot.name}</h3>
        <span className={`status-badge ${bot.status}`}>{bot.status}</span>
      </div>

      <div className="bot-wallet" style={{ fontSize: '0.85rem', color: '#8b949e', marginBottom: '10px' }}>
        💼 {bot.wallet.slice(0, 4)}...{bot.wallet.slice(-4)}
      </div>

      <div className="bot-stats">
        <div className="stat">
          <span className="label">Catches:</span>
          <span className="value">{bot.catches}</span>
        </div>
        <div className="stat">
          <span className="label">Misses:</span>
          <span className="value">{bot.misses}</span>
        </div>
        <div className="stat">
          <span className="label">Total Fish:</span>
          <span className="value">{bot.totalFish.toFixed(2)}</span>
        </div>
        <div className="stat">
          <span className="label">Delay:</span>
          <span className="value">{bot.delay}ms</span>
        </div>
        <div className="stat">
          <span className="label">Uptime:</span>
          <span className="value">{bot.uptime}</span>
        </div>
      </div>

      <div className="bot-actions" style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {bot.status === 'online' ? (
            <button className="btn-danger" onClick={onStop}>
              ⏸️ Stop
            </button>
          ) : (
            <button className="btn-success" onClick={onStart}>
              ▶️ Start
            </button>
          )}
        </div>
        <button
          className="btn-secondary"
          onClick={() => navigate(`/bots/${bot.id}`)}
          style={{ width: '100%' }}
        >
          📊 Ver Detalhes
        </button>
      </div>
    </div>
  )
}
