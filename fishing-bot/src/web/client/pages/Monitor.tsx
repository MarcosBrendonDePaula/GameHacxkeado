import { useState, useEffect, useCallback } from 'react'
import { getMonitoring } from '../lib/api'

type MonitoringData = Awaited<ReturnType<typeof getMonitoring>>

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ---- SVG Bar Chart (Hourly Activity) ----
function HourlyChart({ data }: { data: MonitoringData['hourlyHistory'] }) {
  const W = 720
  const H = 200
  const padL = 50
  const padR = 10
  const padT = 20
  const padB = 30
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const maxCpm = Math.max(1, ...data.map(d => d.castsPerMinute))
  const maxBots = Math.max(1, ...data.map(d => d.activeBots))
  const barW = data.length > 0 ? chartW / data.length : chartW

  // Bot line points
  const botPoints = data.map((d, i) => {
    const x = padL + i * barW + barW / 2
    const y = padT + chartH - (d.activeBots / maxBots) * chartH
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = padT + chartH * (1 - f)
        return (
          <g key={f}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize="9">
              {Math.round(maxCpm * f)}
            </text>
          </g>
        )
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x = padL + i * barW + 2
        const barHeight = (d.castsPerMinute / maxCpm) * chartH
        const y = padT + chartH - barHeight
        const w = Math.max(1, barW - 4)
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={barHeight} rx="2"
              fill="url(#barGradient)" opacity="0.85">
              <title>{d.hour} - {d.castsPerMinute.toFixed(1)} casts/min, {d.activeBots} bots, {d.totalFish.toFixed(1)} fish</title>
            </rect>
            {/* Hour label every 2-3 hours */}
            {(i % 3 === 0 || i === data.length - 1) && (
              <text x={x + w / 2} y={H - 6} textAnchor="middle" fill="var(--text-muted)" fontSize="8">
                {d.hour}
              </text>
            )}
          </g>
        )
      })}

      {/* Bot line overlay */}
      {data.length >= 2 && (
        <polyline points={botPoints} fill="none" stroke="var(--success)" strokeWidth="2" opacity="0.8" />
      )}

      {/* Gradient definition */}
      <defs>
        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--purple)" />
        </linearGradient>
      </defs>

      {/* Legend */}
      <rect x={padL + 4} y={4} width="8" height="8" rx="2" fill="url(#barGradient)" />
      <text x={padL + 16} y={12} fill="var(--text-secondary)" fontSize="9">Casts/min</text>
      <line x1={padL + 80} y1={8} x2={padL + 96} y2={8} stroke="var(--success)" strokeWidth="2" />
      <text x={padL + 100} y={12} fill="var(--text-secondary)" fontSize="9">Bots ativos</text>
    </svg>
  )
}

// ---- SVG Line Chart (CPU / RAM recent) ----
function SystemChart({ data }: { data: MonitoringData['recentMetrics'] }) {
  const W = 720
  const H = 160
  const padL = 50
  const padR = 50
  const padT = 20
  const padB = 25
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  if (data.length < 2) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Aguardando dados (min 2 pontos)...
      </div>
    )
  }

  const maxCpu = Math.max(10, ...data.map(d => d.cpuPercent))
  const maxMem = Math.max(64, ...data.map(d => d.memoryMB))

  const cpuPoints = data.map((d, i) => {
    const x = padL + (i / (data.length - 1)) * chartW
    const y = padT + chartH - (d.cpuPercent / maxCpu) * chartH
    return `${x},${y}`
  }).join(' ')

  const memPoints = data.map((d, i) => {
    const x = padL + (i / (data.length - 1)) * chartW
    const y = padT + chartH - (d.memoryMB / maxMem) * chartH
    return `${x},${y}`
  }).join(' ')

  // Time labels
  const first = data[0]!
  const last = data[data.length - 1]!
  const fmtTime = (ts: number) => {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid */}
      {[0, 0.5, 1].map(f => {
        const y = padT + chartH * (1 - f)
        return (
          <g key={f}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fill="var(--accent)" fontSize="9">
              {Math.round(maxCpu * f)}%
            </text>
            <text x={W - padR + 6} y={y + 4} textAnchor="start" fill="var(--purple)" fontSize="9">
              {Math.round(maxMem * f)}MB
            </text>
          </g>
        )
      })}

      {/* CPU line */}
      <polyline points={cpuPoints} fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.9" />
      {/* RAM line */}
      <polyline points={memPoints} fill="none" stroke="var(--purple)" strokeWidth="2" opacity="0.9" />

      {/* Time labels */}
      <text x={padL} y={H - 4} fill="var(--text-muted)" fontSize="9">{fmtTime(first.timestamp)}</text>
      <text x={W - padR} y={H - 4} textAnchor="end" fill="var(--text-muted)" fontSize="9">{fmtTime(last.timestamp)}</text>

      {/* Legend */}
      <line x1={padL + 4} y1={8} x2={padL + 20} y2={8} stroke="var(--accent)" strokeWidth="2" />
      <text x={padL + 24} y={12} fill="var(--text-secondary)" fontSize="9">CPU %</text>
      <line x1={padL + 70} y1={8} x2={padL + 86} y2={8} stroke="var(--purple)" strokeWidth="2" />
      <text x={padL + 90} y={12} fill="var(--text-secondary)" fontSize="9">RAM MB</text>
    </svg>
  )
}

// ---- Status Badge ----
function StatusBadge({ status }: { status: 'online' | 'paused' | 'offline' }) {
  const map = {
    online: { bg: 'rgba(63,185,80,0.15)', color: 'var(--success)', border: 'rgba(63,185,80,0.3)', label: 'Online' },
    paused: { bg: 'rgba(210,153,34,0.15)', color: 'var(--warning)', border: 'rgba(210,153,34,0.3)', label: 'Pausado' },
    offline: { bg: 'rgba(248,81,73,0.15)', color: 'var(--danger)', border: 'rgba(248,81,73,0.3)', label: 'Offline' },
  }
  const s = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '50px', fontSize: '0.72rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor',
        ...(status === 'online' ? { animation: 'pulse 2s ease infinite' } : {}),
      }} />
      {s.label}
    </span>
  )
}

// ---- DurabilityBar ----
function DurabilityBar({ percent }: { percent: number }) {
  const color = percent <= 20 ? 'var(--danger)' : percent <= 50 ? 'var(--warning)' : 'var(--success)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '60px', height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden',
      }}>
        <div style={{ width: `${percent}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{percent}%</span>
    </div>
  )
}

// ---- Main Component ----
export default function Monitor() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const d = await getMonitoring()
      setData(d)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar monitoring')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 5000)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading) {
    return <div className="loading">Carregando monitoring...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  if (!data) return null

  const totalBots = data.activeBots + data.pausedBots + data.offlineBots
  const successRate = (data.totalCatches + data.totalMisses) > 0
    ? ((data.totalCatches / (data.totalCatches + data.totalMisses)) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="container" style={{ maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px var(--accent-glow)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, var(--text-primary), var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Monitoring
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Uptime: {formatUptime(data.uptimeSeconds)}
            </span>
          </div>
        </div>
        <span style={{
          fontSize: '0.75rem', color: 'var(--text-muted)',
          padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: '6px', border: '1px solid var(--border)',
        }}>
          Auto-refresh 5s
        </span>
      </div>

      {/* Stat Cards - 4 columns */}
      <div className="monitor-stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard
          label="Bots Ativos"
          value={String(data.activeBots)}
          sub={`${totalBots} total / ${data.pausedBots} pausados`}
          color="var(--success)"
          glow="var(--success-glow)"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
        />
        <StatCard
          label="Casts/s"
          value={data.castsPerSecond.toFixed(2)}
          sub={`${data.totalCatches + data.totalMisses} total casts`}
          color="var(--accent)"
          glow="var(--accent-glow)"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
        />
        <StatCard
          label="Taxa Acerto"
          value={`${successRate}%`}
          sub={`${data.totalCatches} catches / ${data.totalMisses} misses`}
          color="var(--warning)"
          glow="var(--warning-glow)"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
        />
        <StatCard
          label="CPU / RAM"
          value={`${data.cpuPercent.toFixed(1)}%`}
          sub={`${data.memoryMB} MB RAM`}
          color="var(--purple)"
          glow="var(--purple-glow)"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>}
        />
      </div>

      {/* Charts row */}
      <div className="monitor-charts-grid" style={{ marginBottom: '24px' }}>
        {/* Hourly Activity */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Atividade por Hora (24h)
          </h3>
          <HourlyChart data={data.hourlyHistory} />
        </div>

        {/* CPU/RAM Chart */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--purple)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            CPU / RAM (30 min)
          </h3>
          <SystemChart data={data.recentMetrics} />
        </div>
      </div>

      {/* Fish summary card */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--warning)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6-3.56 0-7.56-2.54-8.5-6z"/>
            <path d="M18 12v.5"/>
            <path d="M8 6a7.5 7.5 0 0 0-4 4 7.5 7.5 0 0 0 4 4"/>
          </svg>
          Resumo de Producao
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <MiniStat label="Total Fish" value={data.totalFish.toLocaleString(undefined, { maximumFractionDigits: 2 })} color="var(--warning)" />
          <MiniStat label="Total Catches" value={data.totalCatches.toLocaleString()} color="var(--success)" />
          <MiniStat label="Total Misses" value={data.totalMisses.toLocaleString()} color="var(--danger)" />
          <MiniStat label="Bots Offline" value={String(data.offlineBots)} color="var(--text-muted)" />
        </div>
      </div>

      {/* Bot table */}
      {data.bots.length > 0 && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Bots Ativos ({data.bots.length})
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['#', 'Status', 'Rod', 'Catches', 'Misses', 'Fish', 'Durability', 'Uptime', 'Pending'].map(h => (
                    <th key={h} style={{
                      padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)',
                      fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.bots.map((bot, i) => (
                  <tr key={i} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s ease',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--accent)' }}>Bot {i + 1}</td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={bot.status} /></td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>Lv{bot.rodLevel}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>{bot.catches.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>{bot.misses.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--warning)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{bot.fish.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}><DurabilityBar percent={bot.durability} /></td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{bot.uptime}</td>
                    <td style={{ padding: '10px 12px', color: bot.pendingCasts > 0 ? 'var(--accent)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{bot.pendingCasts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Sub-components ----

function StatCard({ label, value, sub, color, glow, icon }: {
  label: string; value: string; sub: string; color: string; glow: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
        background: `linear-gradient(135deg, ${color}22, ${color}11)`,
        border: `1px solid ${color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: '2px' }}>
          {label}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          {sub}
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}
