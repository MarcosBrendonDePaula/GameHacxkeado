import { useState, useCallback, useEffect } from 'react'
import {
  useSession,
  SessionButton,
  isEstablished,
  SessionStateType
} from '@fogo/sessions-sdk-react'
import {
  establishSession,
  createSessionConnection,
  createSessionContext,
  Network,
  SessionResultType,
} from '@fogo/sessions-sdk'
import { useAuth } from '../providers/AuthProvider'
import { upsertBot, updateBotConfig, getBot } from '../lib/api'

// Chave do localStorage para saber se bot ja foi configurado
const BOT_CONFIGURED_KEY = 'fogo_bot_configured_'

export default function AddWallet({ embedded = false }: { embedded?: boolean }) {
  const sessionState = useSession()
  const { isConnected, walletPubkey, refreshAccount, bot } = useAuth()
  const [status, setStatus] = useState<'idle' | 'saving' | 'creating' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string>('')

  // Configuracoes do bot
  const [proxy, setProxy] = useState('')
  const [delayMin, setDelayMin] = useState(2300)
  const [delayMax, setDelayMax] = useState(2600)

  // Verifica se ja configurou o bot (localStorage ou estado do backend)
  const [hasConfiguredBot, setHasConfiguredBot] = useState(false)

  // Carrega do localStorage e busca config do bot ao montar
  useEffect(() => {
    if (walletPubkey) {
      const configured = localStorage.getItem(BOT_CONFIGURED_KEY + walletPubkey)
      if (configured === 'true') {
        setHasConfiguredBot(true)
      }

      // Busca config do bot diretamente
      getBot().then(data => {
        console.log('[AddWallet] getBot response:', data)
        if (data.exists && data.bot) {
          setHasConfiguredBot(true)
          localStorage.setItem(BOT_CONFIGURED_KEY + walletPubkey, 'true')
          if (data.bot.proxy) setProxy(data.bot.proxy)
          // Usa valores do banco ou padrões se não existirem
          setDelayMin(data.bot.delayMin ?? 2300)
          setDelayMax(data.bot.delayMax ?? 2600)
        }
      }).catch(err => {
        console.error('[AddWallet] Erro ao buscar bot:', err)
      })
    }
  }, [walletPubkey])

  // Tambem marca como configurado se o backend retornar bot
  useEffect(() => {
    console.log('[AddWallet] bot changed:', bot)
    if (bot) {
      setHasConfiguredBot(true)
      if (walletPubkey) {
        localStorage.setItem(BOT_CONFIGURED_KEY + walletPubkey, 'true')
      }
      console.log('[AddWallet] Setting proxy:', bot.proxy, 'delayMin:', bot.delayMin, 'delayMax:', bot.delayMax)
      if (bot.proxy) setProxy(bot.proxy)
      // Usa valores do bot ou mantém padrões
      setDelayMin(bot.delayMin ?? 2300)
      setDelayMax(bot.delayMax ?? 2600)
    }
  }, [bot, walletPubkey])

  // Valida proxy
  const validateProxy = () => {
    const p = proxy.trim()
    if (!p) {
      setError('Proxy e obrigatorio para rodar o bot')
      return false
    }
    // Aceita formatos: host:porta, usuario:senha@host:porta, http://host:porta, etc
    const hasPort = /:\d+/.test(p)
    if (!hasPort) {
      setError('Formato de proxy invalido. Use: host:porta, http://host:porta ou usuario:senha@host:porta')
      return false
    }
    return true
  }

  // Salva apenas as configuracoes (proxy, delay)
  const handleSaveConfig = useCallback(async () => {
    if (!validateProxy()) return

    setStatus('saving')
    setError(null)

    try {
      const result = await updateBotConfig({
        proxy: proxy.trim(),
        delayMin,
        delayMax,
      })

      if (result.success) {
        setStatus('success')
        setSuccessMessage('Configuracoes salvas com sucesso!')
        refreshAccount()
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        throw new Error(result.error || 'Erro ao salvar')
      }
    } catch (err: any) {
      console.error('Erro ao salvar config:', err)
      setStatus('error')
      setError(err.message || 'Erro desconhecido')
    }
  }, [proxy, delayMin, delayMax, refreshAccount])

  // Cria/recria a sessao do bot
  const handleCreateSession = useCallback(async () => {
    if (!isEstablished(sessionState)) {
      setError('Sessao nao estabelecida')
      return
    }

    if (!validateProxy()) return

    setStatus('creating')
    setError(null)

    try {
      const { walletPublicKey, sessionKey } = sessionState

      // Primeiro, tenta exportar a sessao atual
      let sessionSecretKey: string
      let sessionPublicKey: string

      try {
        const privateKeyJwk = await crypto.subtle.exportKey('jwk', sessionKey.privateKey)
        if (!privateKeyJwk.d) {
          throw new Error('Key nao exportavel')
        }
        // Sessao atual e exportavel!
        sessionSecretKey = privateKeyJwk.d.replace(/-/g, '+').replace(/_/g, '/')

        // Exporta public key para base58
        const publicKeyRaw = await crypto.subtle.exportKey('raw', sessionKey.publicKey)
        const publicKeyBytes = new Uint8Array(publicKeyRaw)
        sessionPublicKey = encodeBase58(publicKeyBytes)

        console.log('Usando sessao atual (exportavel)')
      } catch {
        // Sessao atual nao e exportavel, cria uma nova
        console.log('Sessao atual nao e exportavel, criando nova...')

        const connection = createSessionConnection({
          network: Network.Mainnet,
          rpc: `${window.location.origin}/api/rpc`,
          paymaster: window.location.origin,
        })

        const context = await createSessionContext({
          connection,
          domain: 'https://fogofishing.com',
        })

        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias

        const result = await establishSession({
          context,
          walletPublicKey,
          signMessage: async (message: Uint8Array) => {
            if (!isEstablished(sessionState)) {
              throw new Error('Sessao nao estabelecida')
            }
            const { solanaWallet } = sessionState
            if (!solanaWallet?.signMessage) {
              throw new Error('Carteira nao suporta signMessage')
            }
            const signature = await solanaWallet.signMessage(message)
            return { signedMessage: message, signature }
          },
          expires,
          unlimited: true,
          createUnsafeExtractableSessionKey: true,
        })

        if (result.type !== SessionResultType.Success) {
          throw new Error(result.error?.message || 'Erro ao criar sessao exportavel')
        }

        const { session } = result
        const privateKeyJwk = await crypto.subtle.exportKey('jwk', session.sessionKey.privateKey)
        if (!privateKeyJwk.d) {
          throw new Error('Falha ao exportar session key')
        }

        sessionSecretKey = privateKeyJwk.d.replace(/-/g, '+').replace(/_/g, '/')
        sessionPublicKey = session.sessionPublicKey.toBase58()
      }

      // Envia para o backend com proxy e delay
      const apiResult = await upsertBot({
        sessionSecretKey,
        sessionPublicKey,
        proxy: proxy.trim(),
        delayMin,
        delayMax,
      })

      if (apiResult.success) {
        setStatus('success')
        setSuccessMessage('Sessao criada com sucesso!')
        setHasConfiguredBot(true)
        if (walletPubkey) {
          localStorage.setItem(BOT_CONFIGURED_KEY + walletPubkey, 'true')
        }
        refreshAccount()
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        throw new Error(apiResult.error || 'Erro ao salvar')
      }
    } catch (err: any) {
      console.error('Erro ao criar sessao:', err)
      setStatus('error')
      setError(err.message || 'Erro desconhecido')
    }
  }, [sessionState, refreshAccount, proxy, delayMin, delayMax])

  // Funcao auxiliar para converter bytes para Base58
  function encodeBase58(bytes: Uint8Array): string {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    const digits: number[] = [0]
    for (const byte of bytes) {
      let carry = byte
      for (let j = 0; j < digits.length; j++) {
        carry += (digits[j] ?? 0) << 8
        digits[j] = carry % 58
        carry = (carry / 58) | 0
      }
      while (carry > 0) {
        digits.push(carry % 58)
        carry = (carry / 58) | 0
      }
    }
    let result = ""
    for (let i = digits.length - 1; i >= 0; i--) {
      result += ALPHABET[digits[i]!]
    }
    return result
  }

  const isSessionEstablished = isEstablished(sessionState)

  // Se nao esta conectado, mostra tela de conexao
  if (!isSessionEstablished && !embedded) {
    return (
      <div style={{ animation: 'fadeIn 0.4s ease' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <ConfigHeaderIcon />
          <h2 style={{
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Configurar Bot
          </h2>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <WalletIcon />
          </div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontWeight: 600 }}>Conecte sua Carteira</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 2rem' }}>
            Use sua carteira Phantom ou Solflare para criar uma sessao Fogo e configurar seu bot.
          </p>
          <SessionButton />
        </div>
      </div>
    )
  }

  // Usa localStorage OU estado do backend para saber se tem bot
  const showBotConfig = hasConfiguredBot || !!bot
  const isLoading = status === 'saving' || status === 'creating'

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header - only show if not embedded */}
      {!embedded && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <ConfigHeaderIcon />
        <h2 style={{
          margin: 0,
          fontSize: '1.75rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Configurar Bot
        </h2>
      </div>
      )}

      {/* Mensagem de sucesso */}
      {status === 'success' && (
        <div style={{
          padding: '16px 20px',
          marginBottom: '20px',
          background: 'rgba(63, 185, 80, 0.1)',
          border: '1px solid rgba(63, 185, 80, 0.3)',
          borderRadius: '12px',
          color: 'var(--success)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'fadeIn 0.3s ease',
        }}>
          <SuccessIcon />
          <span style={{ fontWeight: 500 }}>{successMessage}</span>
        </div>
      )}

      <div className="card" style={{ padding: '28px' }}>
        {/* Info da Wallet */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '28px',
          padding: '16px',
          background: 'rgba(63, 185, 80, 0.08)',
          border: '1px solid rgba(63, 185, 80, 0.2)',
          borderRadius: '12px',
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            background: 'var(--success)',
            borderRadius: '50%',
            boxShadow: '0 0 10px var(--success)',
            animation: 'pulse 2s ease infinite',
          }} />
          <span style={{ color: 'var(--success)', fontWeight: 500 }}>
            Carteira conectada:
          </span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}>
            {walletPubkey?.slice(0, 6)}...{walletPubkey?.slice(-6)}
          </span>
        </div>

        {/* Campo Proxy */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '0.95rem',
          }}>
            <ProxyIcon />
            Proxy
            <span style={{ color: 'var(--danger)', fontSize: '1.1rem' }}>*</span>
          </label>
          <input
            type="text"
            value={proxy}
            onChange={(e) => { setProxy(e.target.value); setStatus('idle'); setError(null); }}
            placeholder="http://host:porta ou usuario:senha@host:porta"
            disabled={isLoading}
            style={{
              opacity: isLoading ? 0.6 : 1,
            }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <InfoIcon />
            Obrigatorio. Use um proxy residencial para evitar bloqueios.
          </p>
        </div>

        {/* Campo Delay */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '14px',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '0.95rem',
          }}>
            <TimerIcon />
            Delay entre Casts
          </label>

          {/* Display do range atual */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '14px',
            marginBottom: '16px',
            borderRadius: '12px',
            background: 'rgba(88, 166, 255, 0.06)',
            border: '1px solid rgba(88, 166, 255, 0.12)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Min</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>{delayMin}</div>
            </div>
            <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 300 }}>-</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Max</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--purple)', fontFamily: 'monospace' }}>{delayMax}</div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>ms</div>
          </div>

          {/* Slider Min */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--accent)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Delay minimo</span>
              </div>
              <span style={{
                padding: '1px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700,
                background: 'rgba(88, 166, 255, 0.12)', color: 'var(--accent)', fontFamily: 'monospace',
              }}>{delayMin}ms</span>
            </div>
            <input
              type="range"
              min={1000} max={5000} step={100}
              value={delayMin}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                setDelayMin(val)
                if (val > delayMax) setDelayMax(val)
                setStatus('idle')
              }}
              disabled={isLoading}
              style={{ width: '100%', accentColor: 'var(--accent)', opacity: isLoading ? 0.6 : 1 }}
            />
          </div>

          {/* Slider Max */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--purple)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Delay maximo</span>
              </div>
              <span style={{
                padding: '1px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700,
                background: 'rgba(168, 85, 247, 0.12)', color: 'var(--purple)', fontFamily: 'monospace',
              }}>{delayMax}ms</span>
            </div>
            <input
              type="range"
              min={1000} max={5000} step={100}
              value={delayMax}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                setDelayMax(val)
                if (val < delayMin) setDelayMin(val)
                setStatus('idle')
              }}
              disabled={isLoading}
              style={{ width: '100%', accentColor: 'var(--purple)', opacity: isLoading ? 0.6 : 1 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span>1000ms</span>
              <span>3000ms</span>
              <span>5000ms</span>
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <InfoIcon />
            Delay randomizado entre min e max para parecer humano. Recomendado: 2300-2600ms
          </p>
        </div>

        {/* Erro */}
        {error && (
          <div style={{
            padding: '16px',
            marginBottom: '24px',
            background: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid rgba(248, 81, 73, 0.3)',
            borderRadius: '12px',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'fadeIn 0.3s ease',
          }}>
            <ErrorIcon />
            <span>{error}</span>
          </div>
        )}

        {/* Botoes */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          {/* Botao principal: Salvar Config (se ja tem bot) ou Criar Sessao (se nao tem) */}
          {showBotConfig ? (
            <>
              <button
                onClick={handleSaveConfig}
                disabled={isLoading}
                className="btn-success"
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '14px 24px',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                }}
              >
                {status === 'saving' ? (
                  <>
                    <Spinner />
                    Salvando...
                  </>
                ) : (
                  <>
                    <SaveIcon />
                    Salvar Configuracoes
                  </>
                )}
              </button>
              <button
                onClick={handleCreateSession}
                disabled={isLoading}
                className="btn-purple"
                style={{
                  padding: '14px 24px',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                }}
              >
                {status === 'creating' ? (
                  <>
                    <Spinner />
                    Criando...
                  </>
                ) : (
                  <>
                    <RefreshIcon />
                    Recriar Sessao
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleCreateSession}
              disabled={isLoading}
              className="btn-success"
              style={{
                width: '100%',
                padding: '16px 24px',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              {status === 'creating' ? (
                <>
                  <Spinner />
                  Criando Sessao...
                </>
              ) : (
                <>
                  <RocketIcon />
                  Criar Sessao e Configurar Bot
                </>
              )}
            </button>
          )}
        </div>

        {status === 'creating' && (
          <p style={{
            color: 'var(--warning)',
            marginTop: '16px',
            textAlign: 'center',
            padding: '12px',
            background: 'rgba(210, 153, 34, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(210, 153, 34, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}>
            <AlertIcon />
            Criando sessao... Pode ser necessario confirmar na carteira.
          </p>
        )}
      </div>

      {/* Info Box */}
      <div className="card" style={{
        marginTop: '20px',
        padding: '24px',
        background: 'linear-gradient(145deg, rgba(88, 166, 255, 0.05) 0%, var(--bg-secondary) 100%)',
        borderColor: 'rgba(88, 166, 255, 0.2)',
      }}>
        <h4 style={{
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: 'var(--accent)',
          fontSize: '1rem',
          fontWeight: 600,
        }}>
          <InfoCircleIcon />
          Informacoes Importantes
        </h4>
        <ul style={{
          color: 'var(--text-secondary)',
          lineHeight: 2,
          paddingLeft: '1.25rem',
          margin: 0,
        }}>
          <li>O proxy e necessario para evitar rate-limit do jogo</li>
          <li>A sessao expira em 7 dias - use "Recriar Sessao" para renovar</li>
          <li>Sua carteira principal nunca e exposta ao servidor</li>
          <li>Cada carteira pode ter apenas 1 bot configurado</li>
        </ul>
      </div>
    </div>
  )
}

// Icons
function ConfigHeaderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  )
}

function SuccessIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}

function ProxyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

function TimerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

function InfoCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  )
}


function Spinner() {
  return (
    <span style={{
      width: '16px',
      height: '16px',
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: 'white',
      borderRadius: '50%',
      display: 'inline-block',
      animation: 'spin 1s linear infinite',
    }} />
  )
}
