import { useState, useCallback, useEffect } from 'react'
import {
  establishSession,
  createSessionConnection,
  createSessionContext,
  revokeSession,
  Network,
  SessionResultType,
} from '@fogo/sessions-sdk'
import {
  getStoredSession,
  setStoredSession,
  clearStoredSession,
} from '@fogo/sessions-sdk-web'
import { PublicKey } from '@solana/web3.js'

export interface ExportableSessionData {
  sessionPublicKey: string
  sessionSecretKey: string // Base64 encoded
  walletPublicKey: string
  expiration: Date
}

export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'establishing'
  | 'active'
  | 'error'

interface WalletAdapter {
  publicKey: PublicKey | null
  connected: boolean
  connect(): Promise<void>
  disconnect(): Promise<void>
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

interface UseExportableSessionOptions {
  wallet: WalletAdapter | null
  rpcUrl: string
  paymasterUrl: string
  domain: string
  sessionDurationMs?: number
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_SESSION_DURATION = 7 * ONE_DAY_MS

export function useExportableSession(options: UseExportableSessionOptions) {
  const {
    wallet,
    rpcUrl,
    paymasterUrl,
    domain,
    sessionDurationMs = DEFAULT_SESSION_DURATION,
  } = options

  const [status, setStatus] = useState<SessionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<ExportableSessionData | null>(null)

  // Cria conexão com o SDK
  const createConnection = useCallback(() => {
    return createSessionConnection({
      network: Network.Mainnet,
      rpc: rpcUrl,
      paymaster: paymasterUrl,
    })
  }, [rpcUrl, paymasterUrl])

  // Verifica sessão armazenada ao iniciar
  useEffect(() => {
    const checkStoredSession = async () => {
      if (!wallet?.publicKey) return

      try {
        const stored = await getStoredSession(Network.Mainnet, wallet.publicKey)
        if (stored && stored.expiration > new Date()) {
          // Sessão válida existe, mas precisamos re-exportar a chave
          // porque o storage não guarda a chave privada exportável
          setStatus('active')
          // Nota: não temos a sessionSecretKey aqui, precisa reconectar
        }
      } catch (e) {
        console.log('Nenhuma sessão armazenada')
      }
    }

    checkStoredSession()
  }, [wallet?.publicKey])

  // Estabelece nova sessão com chave EXPORTÁVEL
  const establish = useCallback(async (): Promise<ExportableSessionData | null> => {
    if (!wallet?.publicKey || !wallet.connected) {
      setError('Carteira não conectada')
      return null
    }

    setStatus('establishing')
    setError(null)

    try {
      const connection = createConnection()
      const context = await createSessionContext({
        connection,
        domain,
      })

      const expires = new Date(Date.now() + sessionDurationMs)

      // Estabelece sessão COM CHAVE EXPORTÁVEL
      const result = await establishSession({
        context,
        walletPublicKey: wallet.publicKey,
        signMessage: async (message: Uint8Array) => {
          const signature = await wallet.signMessage(message)
          return { signedMessage: message, signature }
        },
        expires,
        unlimited: true,
        createUnsafeExtractableSessionKey: true, // IMPORTANTE!
      })

      if (result.type === SessionResultType.Success) {
        const { session } = result

        // Exporta a session key (agora possível porque é extractable)
        const privateKeyJwk = await crypto.subtle.exportKey(
          'jwk',
          session.sessionKey.privateKey
        )

        if (!privateKeyJwk.d) {
          throw new Error('Falha ao exportar session key')
        }

        // Converte base64url para base64 normal
        const sessionSecretKey = privateKeyJwk.d
          .replace(/-/g, '+')
          .replace(/_/g, '/')

        const data: ExportableSessionData = {
          sessionPublicKey: session.sessionPublicKey.toBase58(),
          sessionSecretKey,
          walletPublicKey: wallet.publicKey.toBase58(),
          expiration: expires,
        }

        // Salva no storage (para reconexão, mas sem a chave privada)
        await setStoredSession(Network.Mainnet, {
          sessionKey: session.sessionKey,
          sessionPublicKey: session.sessionPublicKey,
          walletPublicKey: wallet.publicKey,
          expiration: expires,
        })

        setSessionData(data)
        setStatus('active')
        return data
      } else {
        const errorMsg = result.error?.message || 'Erro ao estabelecer sessão'
        throw new Error(errorMsg)
      }
    } catch (err: any) {
      console.error('Erro ao estabelecer sessão:', err)
      setError(err.message || 'Erro desconhecido')
      setStatus('error')
      return null
    }
  }, [wallet, createConnection, domain, sessionDurationMs])

  // Desconecta e revoga sessão
  const disconnect = useCallback(async () => {
    if (!wallet?.publicKey) return

    try {
      await clearStoredSession(Network.Mainnet, wallet.publicKey)
      setSessionData(null)
      setStatus('idle')
      setError(null)
    } catch (e) {
      console.error('Erro ao desconectar:', e)
    }
  }, [wallet?.publicKey])

  return {
    status,
    error,
    sessionData,
    establish,
    disconnect,
    isConnected: wallet?.connected ?? false,
    walletPublicKey: wallet?.publicKey?.toBase58() ?? null,
  }
}
