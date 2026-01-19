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
import { upsertBot, updateBotConfig, getEncryptionSignature, getBot } from '../lib/api'

// Chave do localStorage para saber se bot já foi configurado
const BOT_CONFIGURED_KEY = 'fogo_bot_configured_'

export default function AddWallet() {
  const sessionState = useSession()
  const { isConnected, walletPubkey, refreshAccount, bot } = useAuth()
  const [status, setStatus] = useState<'idle' | 'saving' | 'creating' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string>('')

  // Configurações do bot
  const [proxy, setProxy] = useState('')
  const [delay, setDelay] = useState(2000)

  // Verifica se já configurou o bot (localStorage ou estado do backend)
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
          if (data.bot.delay) setDelay(data.bot.delay)
        }
      }).catch(err => {
        console.error('[AddWallet] Erro ao buscar bot:', err)
      })
    }
  }, [walletPubkey])

  // Também marca como configurado se o backend retornar bot
  useEffect(() => {
    console.log('[AddWallet] bot changed:', bot)
    if (bot) {
      setHasConfiguredBot(true)
      if (walletPubkey) {
        localStorage.setItem(BOT_CONFIGURED_KEY + walletPubkey, 'true')
      }
      console.log('[AddWallet] Setting proxy:', bot.proxy, 'delay:', bot.delay)
      if (bot.proxy) setProxy(bot.proxy)
      if (bot.delay) setDelay(bot.delay)
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

  // Salva apenas as configurações (proxy, delay)
  const handleSaveConfig = useCallback(async () => {
    if (!validateProxy()) return

    setStatus('saving')
    setError(null)

    try {
      const result = await updateBotConfig({
        proxy: proxy.trim(),
        delay,
      })

      if (result.success) {
        setStatus('success')
        setSuccessMessage('Configuracoes salvas!')
        refreshAccount()
      } else {
        throw new Error(result.error || 'Erro ao salvar')
      }
    } catch (err: any) {
      console.error('Erro ao salvar config:', err)
      setStatus('error')
      setError(err.message || 'Erro desconhecido')
    }
  }, [proxy, delay, refreshAccount])

  // Cria/recria a sessão do bot
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

      // Primeiro, tenta exportar a sessão atual
      let sessionSecretKey: string
      let sessionPublicKey: string

      try {
        const privateKeyJwk = await crypto.subtle.exportKey('jwk', sessionKey.privateKey)
        if (!privateKeyJwk.d) {
          throw new Error('Key nao exportavel')
        }
        // Sessão atual é exportável!
        sessionSecretKey = privateKeyJwk.d.replace(/-/g, '+').replace(/_/g, '/')

        // Exporta public key para base58
        const publicKeyRaw = await crypto.subtle.exportKey('raw', sessionKey.publicKey)
        const publicKeyBytes = new Uint8Array(publicKeyRaw)
        sessionPublicKey = encodeBase58(publicKeyBytes)

        console.log('Usando sessao atual (exportavel)')
      } catch {
        // Sessão atual não é exportável, cria uma nova
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

      // Obtém a assinatura de criptografia para proteger a session key
      const encryptionSignature = await getEncryptionSignature()

      // Envia para o backend com proxy e delay
      const apiResult = await upsertBot({
        sessionSecretKey,
        sessionPublicKey,
        encryptionSignature,
        proxy: proxy.trim(),
        delay,
      })

      if (apiResult.success) {
        setStatus('success')
        setSuccessMessage('Sessao criada com sucesso!')
        setHasConfiguredBot(true)
        if (walletPubkey) {
          localStorage.setItem(BOT_CONFIGURED_KEY + walletPubkey, 'true')
        }
        refreshAccount()
      } else {
        throw new Error(apiResult.error || 'Erro ao salvar')
      }
    } catch (err: any) {
      console.error('Erro ao criar sessao:', err)
      setStatus('error')
      setError(err.message || 'Erro desconhecido')
    }
  }, [sessionState, refreshAccount, proxy, delay])

  // Função auxiliar para converter bytes para Base58
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

  // Se não está conectado, mostra tela de conexão
  if (!isSessionEstablished) {
    return (
      <div>
        <h2>Configurar Bot</h2>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3>Conecte sua Carteira</h3>
          <p style={{ color: '#888', margin: '1.5rem 0' }}>
            Use sua carteira Phantom ou Solflare para criar uma sessao Fogo.
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
    <div>
      <h2>Configurar Bot</h2>

      {/* Mensagem de sucesso */}
      {status === 'success' && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '1rem',
          backgroundColor: 'rgba(74, 222, 128, 0.1)',
          border: '1px solid #4ade80',
          borderRadius: '8px',
          color: '#4ade80',
        }}>
          {successMessage}
        </div>
      )}

      <div className="card">
        {/* Info da Wallet */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '1.5rem',
          padding: '12px',
          backgroundColor: 'rgba(74, 222, 128, 0.1)',
          border: '1px solid #4ade80',
          borderRadius: '8px',
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            backgroundColor: '#4ade80',
            borderRadius: '50%',
          }} />
          <span style={{ color: '#4ade80' }}>
            Carteira conectada: {walletPubkey?.slice(0, 8)}...{walletPubkey?.slice(-8)}
          </span>
        </div>

        {/* Campo Proxy */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            color: '#c9d1d9',
            fontWeight: 'bold',
          }}>
            Proxy <span style={{ color: '#f85149' }}>*</span>
          </label>
          <input
            type="text"
            value={proxy}
            onChange={(e) => { setProxy(e.target.value); setStatus('idle'); setError(null); }}
            placeholder="http://host:porta ou usuario:senha@host:porta"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #30363d',
              backgroundColor: '#0d1117',
              color: '#c9d1d9',
              fontSize: '0.95rem',
              opacity: isLoading ? 0.6 : 1,
            }}
          />
          <p style={{ color: '#8b949e', fontSize: '0.85rem', marginTop: '6px' }}>
            Obrigatorio. Use um proxy residencial para evitar bloqueios.
          </p>
        </div>

        {/* Campo Delay */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            color: '#c9d1d9',
            fontWeight: 'bold',
          }}>
            Delay entre Casts (ms)
          </label>
          <input
            type="number"
            value={delay}
            onChange={(e) => { setDelay(Math.max(100, parseInt(e.target.value) || 500)); setStatus('idle'); }}
            min={100}
            max={5000}
            step={100}
            disabled={isLoading}
            style={{
              width: '200px',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #30363d',
              backgroundColor: '#0d1117',
              color: '#c9d1d9',
              fontSize: '0.95rem',
              opacity: isLoading ? 0.6 : 1,
            }}
          />
          <p style={{ color: '#8b949e', fontSize: '0.85rem', marginTop: '6px' }}>
            Tempo de espera entre cada cast. Minimo: 100ms. Padrao: 2000ms
          </p>
        </div>

        {/* Erro */}
        {error && (
          <div style={{
            padding: '12px',
            marginBottom: '1.5rem',
            backgroundColor: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid #f85149',
            borderRadius: '6px',
            color: '#f85149',
          }}>
            {error}
          </div>
        )}

        {/* Botões */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Botão principal: Salvar Config (se já tem bot) ou Criar Sessão (se não tem) */}
          {showBotConfig ? (
            <>
              <button
                onClick={handleSaveConfig}
                disabled={isLoading}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: isLoading ? 'wait' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  backgroundColor: '#238636',
                }}
              >
                {status === 'saving' ? 'Salvando...' : 'Salvar Configuracoes'}
              </button>
              <button
                onClick={handleCreateSession}
                disabled={isLoading}
                style={{
                  padding: '14px 20px',
                  fontSize: '0.95rem',
                  cursor: isLoading ? 'wait' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  backgroundColor: '#6e40c9',
                }}
              >
                {status === 'creating' ? 'Criando...' : 'Recriar Sessao'}
              </button>
            </>
          ) : (
            <button
              onClick={handleCreateSession}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: isLoading ? 'wait' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                backgroundColor: '#238636',
              }}
            >
              {status === 'creating' ? 'Criando Sessao...' : 'Criar Sessao e Configurar Bot'}
            </button>
          )}
        </div>

        {status === 'creating' && (
          <p style={{ color: '#fbbf24', marginTop: '1rem', textAlign: 'center' }}>
            Criando sessao... Pode ser necessario confirmar na carteira.
          </p>
        )}
      </div>

      {/* Info Box */}
      <div className="card" style={{ marginTop: '1rem', backgroundColor: '#1e293b' }}>
        <h4>Informacoes</h4>
        <ul style={{ color: '#888', lineHeight: 1.8, paddingLeft: '1.5rem', margin: 0 }}>
          <li>O proxy e necessario para evitar rate-limit do jogo</li>
          <li>A sessao expira em 7 dias - use "Recriar Sessao" para renovar</li>
          <li>Sua carteira principal nunca e exposta ao servidor</li>
          <li>Cada carteira pode ter apenas 1 bot configurado</li>
        </ul>
      </div>
    </div>
  )
}
