import { useState, useCallback } from 'react'
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

export default function AddWallet() {
  const sessionState = useSession()
  const [status, setStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [botName, setBotName] = useState('')
  const [createdBot, setCreatedBot] = useState<{ id: string; name: string; publicKey: string } | null>(null)

  // Cria uma NOVA sessão com chave exportável e envia para o backend
  const handleExportSession = useCallback(async () => {
    if (!isEstablished(sessionState)) {
      setError('Sessão não estabelecida')
      return
    }

    if (!botName.trim()) {
      setError('Digite um nome para a carteira')
      return
    }

    setStatus('exporting')
    setError(null)

    try {
      const { walletPublicKey } = sessionState

      // Cria conexão usando nossos proxies
      const connection = createSessionConnection({
        network: Network.Mainnet,
        rpc: `${window.location.origin}/api/rpc`,
        paymaster: window.location.origin,
      })

      const context = await createSessionContext({
        connection,
        domain: 'https://fogofishing.com',
      })

      // Cria NOVA sessão com chave EXPORTÁVEL
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias

      const result = await establishSession({
        context,
        walletPublicKey,
        signMessage: async (message: Uint8Array) => {
          // Usa o solanaWallet do sessionState estabelecido
          if (!isEstablished(sessionState)) {
            throw new Error('Sessão não estabelecida')
          }
          const { solanaWallet } = sessionState
          if (!solanaWallet?.signMessage) {
            throw new Error('Carteira não suporta signMessage')
          }
          const signature = await solanaWallet.signMessage(message)
          return { signedMessage: message, signature }
        },
        expires,
        unlimited: true,
        createUnsafeExtractableSessionKey: true, // IMPORTANTE: Permite exportar
      })

      if (result.type !== SessionResultType.Success) {
        throw new Error(result.error?.message || 'Erro ao criar sessão exportável')
      }

      const { session } = result

      // Exporta a session key
      const privateKeyJwk = await crypto.subtle.exportKey('jwk', session.sessionKey.privateKey)
      if (!privateKeyJwk.d) {
        throw new Error('Falha ao exportar session key')
      }

      // Converte base64url para base64 normal
      const sessionSecretKey = privateKeyJwk.d.replace(/-/g, '+').replace(/_/g, '/')

      // Envia para o backend
      const response = await fetch('/api/bots/add-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: botName.trim(),
          walletPublicKey: walletPublicKey.toBase58(),
          sessionPublicKey: session.sessionPublicKey.toBase58(),
          sessionSecretKey,
        }),
      })

      const apiResult = await response.json()

      if (apiResult.success) {
        setStatus('success')
        setCreatedBot({
          id: apiResult.bot.id,
          name: apiResult.bot.name,
          publicKey: session.sessionPublicKey.toBase58(),
        })
        setBotName('')
      } else {
        throw new Error(apiResult.error || 'Erro ao salvar')
      }
    } catch (err: any) {
      console.error('Erro ao exportar sessão:', err)
      setStatus('error')
      setError(err.message || 'Erro desconhecido')
    }
  }, [sessionState, botName])

  // Renderiza estado da sessão
  const renderSessionStatus = () => {
    switch (sessionState.type) {
      case SessionStateType.Initializing:
      case SessionStateType.CheckingStoredSession:
        return <p style={{ color: '#888' }}>Carregando...</p>

      case SessionStateType.NotEstablished:
        return (
          <div>
            <p style={{ color: '#888', marginBottom: '1rem' }}>
              Clique para conectar sua carteira e criar uma sessão Fogo.
            </p>
            <SessionButton />
          </div>
        )

      case SessionStateType.SelectingWallet:
      case SessionStateType.WalletConnecting:
        return <p style={{ color: '#fbbf24' }}>Conectando carteira...</p>

      case SessionStateType.RequestingLimits:
      case SessionStateType.SettingLimits:
        return <p style={{ color: '#fbbf24' }}>Configurando sessão...</p>

      case SessionStateType.Established:
      case SessionStateType.UpdatingSession:
        return (
          <div>
            <p style={{ color: '#4ade80', marginBottom: '0.5rem' }}>
              ✅ Sessão ativa!
            </p>
            <p style={{ color: '#888', fontSize: '0.9rem' }}>
              Carteira: {sessionState.walletPublicKey.toBase58().slice(0, 8)}...
              {sessionState.walletPublicKey.toBase58().slice(-8)}
            </p>
            <p style={{ color: '#888', fontSize: '0.9rem' }}>
              Expira: {sessionState.expiration.toLocaleString()}
            </p>
            <button
              onClick={() => {
                // Limpa storage da sessão (database: sessionsdb)
                indexedDB.deleteDatabase('sessionsdb')
                window.location.reload()
              }}
              style={{
                marginTop: '0.75rem',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                backgroundColor: '#dc2626',
              }}
            >
              Desconectar
            </button>
          </div>
        )

      default:
        return <SessionButton />
    }
  }

  const isSessionEstablished = isEstablished(sessionState)

  return (
    <div>
      <h2>Adicionar Carteira via Fogo Sessions</h2>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3>1. Conecte sua Carteira</h3>
        <p style={{ color: '#888', marginBottom: '1rem' }}>
          Use o SDK oficial da Fogo para criar uma sessão segura.
        </p>
        {renderSessionStatus()}
      </div>

      {isSessionEstablished && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>2. Salvar Session Key</h3>
          <p style={{ color: '#888', marginBottom: '1rem' }}>
            Cria uma nova sessão exportável e salva no servidor.
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Nome:
            </label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Ex: Carteira Principal"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #333',
                backgroundColor: '#1a1a2e',
                color: '#fff',
                fontSize: '1rem',
              }}
            />
          </div>

          <button
            onClick={handleExportSession}
            disabled={status === 'exporting' || !botName.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              cursor: status === 'exporting' ? 'wait' : 'pointer',
              opacity: status === 'exporting' || !botName.trim() ? 0.5 : 1,
            }}
          >
            {status === 'exporting' ? 'Criando sessão exportável...' : 'Criar e Salvar Session Key'}
          </button>

          {error && (
            <p style={{ color: '#f87171', marginTop: '1rem' }}>
              {error}
            </p>
          )}
        </div>
      )}

      {status === 'success' && createdBot && (
        <div className="card" style={{ backgroundColor: '#064e3b', border: '1px solid #10b981' }}>
          <h3 style={{ color: '#4ade80' }}>Carteira Adicionada!</h3>
          <p><strong>Nome:</strong> {createdBot.name}</p>
          <p><strong>ID:</strong> {createdBot.id}</p>
          <p><strong>Session:</strong> {createdBot.publicKey.slice(0, 16)}...</p>
          <p style={{ color: '#888', marginTop: '1rem' }}>
            Já está disponível na lista.
          </p>
          <button
            onClick={() => {
              setStatus('idle')
              setCreatedBot(null)
            }}
            style={{ marginTop: '1rem' }}
          >
            Adicionar Outra
          </button>
        </div>
      )}

      <div className="card" style={{ marginTop: '1rem', backgroundColor: '#1e293b' }}>
        <h4>Como funciona?</h4>
        <ol style={{ color: '#888', lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Conecte sua carteira (Phantom/Solflare)</li>
          <li>A Fogo cria uma sessão inicial</li>
          <li>Ao salvar, criamos uma <strong>nova sessão exportável</strong></li>
          <li>A session key é salva no servidor</li>
          <li>O sistema usa a session key automaticamente</li>
        </ol>
        <p style={{ color: '#fbbf24', marginTop: '1rem' }}>
          ⚠️ A sessão tem tempo limitado (7 dias). Sua carteira principal fica segura!
        </p>
      </div>
    </div>
  )
}
