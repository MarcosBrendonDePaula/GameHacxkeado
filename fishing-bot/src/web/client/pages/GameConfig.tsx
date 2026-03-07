import { useEffect, useState } from 'react'
import { getGameConfig } from '../lib/api'

export default function GameConfig() {
  const [config, setConfig] = useState<any>(null)
  const [globalState, setGlobalState] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = async () => {
    try {
      setError(null)
      const data = await getGameConfig()
      setConfig(data.config)
      setGlobalState(data.globalState)
      setLastUpdate(new Date())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // atualiza a cada 30s
    return () => clearInterval(interval)
  }, [])

  const formatNumber = (val: string | number, decimals = 0) => {
    const n = typeof val === 'string' ? parseFloat(val) : val
    if (isNaN(n)) return val.toString()
    return n.toLocaleString('pt-BR', { maximumFractionDigits: decimals })
  }

  const formatFish = (val: string) => {
    const n = parseFloat(val) / 1_000_000
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  }

  const formatTimestamp = (ts: string) => {
    const n = parseInt(ts)
    if (n === 0) return 'N/A'
    const date = new Date(n * 1000)
    return date.toLocaleString('pt-BR')
  }

  const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>Carregando dados on-chain...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ color: 'var(--danger)', fontSize: '1.1rem', marginBottom: '16px' }}>Erro: {error}</div>
        <button onClick={fetchData} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Configuracoes On-Chain</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Dados lidos diretamente da blockchain Solana (Config + GlobalState PDAs)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastUpdate && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          )}
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Config do Programa */}
      {config && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>&#9881;</span> Config (Programa)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>

            <ConfigItem
              label="Basic Cooldown"
              value={`${config.basicCooldownMs}ms`}
              description="Tempo minimo entre casts (on-chain)"
              highlight
            />
            <ConfigItem
              label="Capability p/ Cast"
              value={config.requireCapabilityForCatch ? 'Sim' : 'Nao'}
              description="Requer capability token para pescar"
              status={config.requireCapabilityForCatch}
            />
            <ConfigItem
              label="Capability p/ Gastar"
              value={config.requireCapabilityForSpend ? 'Sim' : 'Nao'}
              description="Requer capability para upgrades/repair/supercast"
              status={config.requireCapabilityForSpend}
            />
            <ConfigItem
              label="Fee para Init"
              value={config.requireFeeForInit ? 'Sim' : 'Nao'}
              description="Requer taxa para criar conta (anti-DoS)"
              status={config.requireFeeForInit}
            />
            <ConfigItem
              label="Soft Gate Mode"
              value={config.softGateMode ? 'Ativo' : 'Inativo'}
              description="Modo de gate suave"
              status={config.softGateMode}
            />
            <ConfigItem
              label="Authority"
              value={shortAddr(config.authority)}
              description={config.authority}
              mono
            />
            <ConfigItem
              label="Issuer Pubkey"
              value={shortAddr(config.issuerPubkey)}
              description={config.issuerPubkey}
              mono
            />
          </div>
        </div>
      )}

      {/* Global State */}
      {globalState && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>&#127758;</span> Global State
          </h3>

          {/* Status badges */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <StatusBadge
              label="Jogo"
              active={globalState.gamePaused === 0}
              activeText="Online"
              inactiveText="Pausado"
            />
            <StatusBadge
              label="Yield Gate"
              active={globalState.yieldGateActive === 0}
              activeText="Aberto"
              inactiveText="Ativo"
            />
            <StatusBadge
              label="Halving"
              active={true}
              activeText={`#${globalState.halvingCount}`}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            <ConfigItem
              label="Dificuldade Atual"
              value={formatNumber(globalState.currentDifficulty)}
              description="Dificuldade de pesca atual do jogo"
              highlight
            />
            <ConfigItem
              label="Power Total da Rede"
              value={formatNumber(globalState.totalNetworkPower)}
              description="Soma do power de todos os jogadores"
            />
            <ConfigItem
              label="Taxa Emissao Base"
              value={formatFish(globalState.baseEmissionRate)}
              description="Fish por cast base"
            />
            <ConfigItem
              label="Emissao Diaria Alvo"
              value={formatFish(globalState.dailyTargetEmission)}
              description="Meta de emissao de fish por dia"
            />
            <ConfigItem
              label="Taxa de Decaimento"
              value={formatNumber(globalState.emissionDecayRate)}
              description="Decaimento da emissao"
            />
            <ConfigItem
              label="Total Fish Mintado"
              value={formatFish(globalState.totalFishMinted)}
              description="Total de FISH tokens ja emitidos"
            />
            <ConfigItem
              label="Fish Nao Processado"
              value={formatFish(globalState.totalUnprocessedFish)}
              description="Fish pendente de processamento"
            />
            <ConfigItem
              label="FOGO Coletado"
              value={formatNumber((parseFloat(globalState.totalFogoCollected) / 1_000_000).toString(), 2)}
              description="Total de FOGO coletado em taxas"
            />
            <ConfigItem
              label="Taxas Acumuladas"
              value={formatFish(globalState.accumulatedProcessingFees)}
              description="Taxas de processamento acumuladas"
            />
            <ConfigItem
              label="Ultimo Ajuste Dificuldade"
              value={formatTimestamp(globalState.lastDifficultyAdjustment)}
              description="Quando a dificuldade foi ajustada"
            />
            <ConfigItem
              label="Authority"
              value={shortAddr(globalState.authority)}
              description={globalState.authority}
              mono
            />
            <ConfigItem
              label="Fish Mint"
              value={shortAddr(globalState.fishMint)}
              description={globalState.fishMint}
              mono
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ConfigItem({ label, value, description, highlight, status, mono }: {
  label: string
  value: string
  description?: string
  highlight?: boolean
  status?: boolean
  mono?: boolean
}) {
  return (
    <div style={{
      padding: '14px 16px',
      background: highlight ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${highlight ? 'rgba(59, 130, 246, 0.25)' : 'var(--border)'}`,
      borderRadius: '10px',
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        fontSize: highlight ? '1.3rem' : '1rem',
        fontWeight: 700,
        fontFamily: mono ? 'monospace' : 'inherit',
        color: status !== undefined
          ? (status ? 'var(--success)' : 'var(--text-secondary)')
          : (highlight ? 'var(--accent)' : 'var(--text-primary)'),
      }}>
        {value}
      </div>
      {description && (
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          marginTop: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }} title={description}>
          {description}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ label, active, activeText, inactiveText }: {
  label: string
  active: boolean
  activeText: string
  inactiveText?: string
}) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 14px',
      borderRadius: '20px',
      background: active ? 'rgba(63, 185, 80, 0.1)' : 'rgba(248, 81, 73, 0.1)',
      border: `1px solid ${active ? 'rgba(63, 185, 80, 0.3)' : 'rgba(248, 81, 73, 0.3)'}`,
    }}>
      <div style={{
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: active ? 'var(--success)' : 'var(--danger)',
        boxShadow: `0 0 8px ${active ? 'var(--success)' : 'var(--danger)'}`,
      }} />
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: active ? 'var(--success)' : 'var(--danger)' }}>
        {label}: {active ? activeText : (inactiveText || 'Inativo')}
      </span>
    </div>
  )
}
